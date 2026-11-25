import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { countries } from "countries-list";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";
import { appUrl, renderEmail } from "@/lib/email-layout";
import { SIRAH_BATCH, SIRAH_SLUG, SIRAH_TITLE, decimalToMinor, formatSirahMoney, priceFor } from "@/lib/sirah/catalog";
import { SCHOLARSHIP_ORDER_VERSION, approvedMoney, scholarshipApplicationSchema } from "@/lib/sirah/scholarship-application";
import { serializable } from "./sirah-confirmation.service";
import { auditSirah, SirahError } from "./sirah-registration.service";

type Input = z.infer<typeof scholarshipApplicationSchema>;
export async function notifyApplication(id: string) {
  const row = await prisma.sirahScholarshipApplication.findUniqueOrThrow({ where: { id }, select: { id: true, fullName: true, email: true, status: true, approvedFeeMinor: true, approvedMonthlyMinor: true, currency: true, orderId: true } });
  const paragraphs = row.status === "PENDING"
    ? ["We received your application. Our team will review it and get back to you.", "Do not submit or pay any amount until your application has been approved."]
    : row.status === "REJECTED"
      ? ["Thank you for applying. We are sorry that we cannot approve your application at this time. We appreciate your interest in the course."]
      : ["Your application has been approved.", row.approvedFeeMinor === 0 ? "Your approved course fee is fully waived; no payment is due." : `Your agreed total is ${formatSirahMoney(row.approvedFeeMinor!, row.currency)}.${row.approvedMonthlyMinor ? ` Your agreed monthly amount is ${formatSirahMoney(row.approvedMonthlyMinor, row.currency)}.` : ""} The TGA team will send you a secure payment link. Please contact the team if you have not received it.`, "To access your account, sign in with your existing password. If you need a password, use the password reset page with this email address."];
  const message = renderEmail(row.status === "PENDING" ? "Application received" : row.status === "APPROVED" ? "Your application was approved" : "Your application decision", { masthead: "The Global Awakening", heading: row.status === "PENDING" ? "Application received" : row.status === "APPROVED" ? "Application approved" : "Application decision", paragraphs, ...(row.status === "APPROVED" ? { action: { label: "Sign in or set your password", href: `${appUrl()}/forgot-password` } } : {}) });
  let state = "FAILED";
  try { const result = await sendTransactionalEmail({ ...message, to: row.email, emailType: `SIRAH_APPLICATION_${row.status}`, idempotencyKey: `sirah-application:${row.id}:${row.status}` }); state = result.status; } catch { state = "FAILED"; }
  await prisma.sirahScholarshipApplication.updateMany({ where: { id, status: row.status }, data: { notificationState: state } });
  return state;
}
export async function submitApplication(input: Input, document: { name: string; data: Uint8Array } | null, actor?: string) {
  const requestedAmountMinor = input.arrangementType !== "FULL" && input.requestedAmount ? decimalToMinor(input.requestedAmount, input.currency) : null;
  const created = await prisma.sirahScholarshipApplication.create({ data: { fullName: input.fullName, email: input.email, phone: input.phone, countryCode: input.countryCode, courseSlug: SIRAH_SLUG, batchCode: SIRAH_BATCH, arrangementType: input.arrangementType, requestedAmountMinor, currency: input.currency, reason: input.reason, documentName: document?.name.slice(0, 191), documentData: document ? Buffer.from(document.data) : undefined, createdBy: actor || null, notificationState: "PENDING" }, select: { id: true } });
  return { id: created.id, emailState: await notifyApplication(created.id) };
}
export async function reviewApplication(input: { id: string; decision: "APPROVED" | "REJECTED"; notes: string; fee?: string; monthly?: string }, actor: string) {
  const application = await prisma.sirahScholarshipApplication.findUnique({ where: { id: input.id }, select: { id: true, email: true, status: true, fullName: true, countryCode: true, phone: true, currency: true, batchCode: true, courseSlug: true } });
  if (!application) throw new SirahError("Application not found.", 404);
  if (application.status !== "PENDING") throw new SirahError("This application has already been reviewed.", 409);
  let fee = 0, monthly: number | null = null;
  if (input.decision === "APPROVED") {
    try { fee = approvedMoney(input.fee || "", application.currency, true); monthly = input.monthly ? approvedMoney(input.monthly, application.currency, false) : null; }
    catch { throw new SirahError("Enter valid amounts in the application currency."); }
    if (monthly !== null && (fee === 0 || monthly > fee)) throw new SirahError("The agreed monthly amount must not exceed the total fee.");
  }
  // Random unusable initial password; applicant chooses a password via email reset.
  const passwordHash = input.decision === "APPROVED" ? await bcrypt.hash(randomBytes(32).toString("base64url"), 12) : "";
  const result = await serializable(async (tx) => {
    await tx.$queryRaw`SELECT id FROM SirahScholarshipApplication WHERE id = ${input.id} FOR UPDATE`;
    const current = await tx.sirahScholarshipApplication.findUniqueOrThrow({ where: { id: input.id } });
    if (current.status !== "PENDING") throw new SirahError("This application has already been reviewed.", 409);
    let orderId: string | null = null;
    if (input.decision === "APPROVED") {
      const course = await tx.course.upsert({ where: { slug: SIRAH_SLUG }, create: { slug: SIRAH_SLUG, title: SIRAH_TITLE, basePrice: 2999, currency: "GBP", isActive: true }, update: {} });
      let user = await tx.user.findUnique({ where: { email: application.email } });
      if (user && user.status !== "ACTIVE") throw new SirahError("This student account is not active; review it before approval.", 409);
      const phone = parsePhoneNumberFromString(application.phone)!;
      if (!user) user = await tx.user.create({ data: { fullName: application.fullName, email: application.email, phoneCountryCode: `+${phone.countryCallingCode}`, phoneNumber: String(phone.nationalNumber), passwordHash, studentProfile: { create: { countryCode: application.countryCode, countryName: countries[application.countryCode as keyof typeof countries].name } } } });
      const existing = await tx.sirahOrder.findUnique({ where: { userId_courseId_batchCode: { userId: user.id, courseId: course.id, batchCode: application.batchCode } }, select: { id: true } });
      if (existing) throw new SirahError("This student already has an order for this cohort. Review the existing order; no payment data was changed.", 409);
      const order = await tx.sirahOrder.create({ data: { userId: user.id, courseId: course.id, batchCode: application.batchCode, reference: `SIRAH-${randomUUID().toUpperCase()}`, requestKey: `scholarship:${application.id}`, phoneCountry: phone.country || application.countryCode, phoneE164: application.phone, countryCode: application.countryCode, countryName: countries[application.countryCode as keyof typeof countries].name, marketCode: priceFor(application.countryCode, "ANNUAL", "STRIPE").market, plan: "ANNUAL", method: null, pricingVersion: SCHOLARSHIP_ORDER_VERSION, currency: application.currency, amountMinor: fee, totalMinor: fee, ledgerFeeMinor: fee, ledgerFeeCurrency: application.currency, paymentState: "UNPAID", enrolmentState: "ACTIVE" } });
      orderId = order.id;
      await auditSirah(tx, order.id, actor, "SCHOLARSHIP_APPLICATION_APPROVED", { applicationId: application.id, feeMinor: fee, monthlyMinor: monthly, currency: application.currency });
    }
    return tx.sirahScholarshipApplication.update({ where: { id: input.id }, data: { status: input.decision, reviewedBy: actor, reviewedAt: new Date(), reviewNotes: input.notes || null, approvedFeeMinor: input.decision === "APPROVED" ? fee : null, approvedMonthlyMinor: monthly, orderId, notificationState: "PENDING" }, select: { id: true, status: true, orderId: true } });
  });
  return { ...result, emailState: await notifyApplication(result.id) };
}
