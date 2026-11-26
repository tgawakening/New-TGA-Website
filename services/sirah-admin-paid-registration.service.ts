import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { countries } from "countries-list";
import { getCountryCallingCode, type CountryCode } from "libphonenumber-js/max";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decimalToMinor, priceFor, SIRAH_BATCH, SIRAH_MONTHS } from "@/lib/sirah/catalog";
import { normalizeSirahPhone } from "@/lib/sirah/phone";
import { pakistanCalendarDate } from "@/lib/sirah/cohort-dates";
import { readDirectUpload, verifyDirectUpload } from "@/lib/sirah/direct-upload";
import { validateSirahReceipt } from "./sirah-receipts.service";
import { auditSirah, createSirahOrderRecord, ensureSirahCourse, SirahError } from "./sirah-registration.service";
import { confirmSirahPaymentInTransaction, serializable } from "./sirah-confirmation.service";
import { savePaymentPlan } from "./sirah-payment-plan.service";

export const adminPaidRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform(value => value.trim().toLowerCase()),
  phone: z.string().trim().min(5).max(40),
  country: z.string().length(2).transform(value => value.toUpperCase()).refine(value => value in countries),
  cohort: z.string().min(1).max(191),
  plan: z.enum(["MONTHLY", "ANNUAL"]),
  amount: z.string().regex(/^\d+(\.\d{1,3})?$/).max(20),
  method: z.enum(["BANK_TRANSFER", "JAZZCASH", "EASYPAISA", "STRIPE", "CASH", "OTHER"]),
  paymentDate: z.iso.date(),
  note: z.string().trim().max(1000).optional(),
  scope: z.uuid(),
  receiptToken: z.string().max(8192).optional(),
}).strict();

export class ExistingSirahRegistration extends SirahError {
  constructor(readonly existing: { id: string; reference: string; archived: boolean; excluded: boolean }) {
    super("A registration for this email and cohort already exists.", 409);
  }
}
export async function adminRegistrationCohorts() {
  const rows = await prisma.sirahCohort.findMany({ select: { batchCode: true }, orderBy: { updatedAt: "desc" } });
  return [...new Set([SIRAH_BATCH, ...rows.map(row => row.batchCode)])];
}

export async function createAdminPaidRegistration(input: z.infer<typeof adminPaidRegistrationSchema>, actor: string) {
  if (!(await adminRegistrationCohorts()).includes(input.cohort)) throw new SirahError("Choose an available cohort.");
  const receivedAt = new Date(`${input.paymentDate}T12:00:00.000Z`);
  if (!Number.isFinite(receivedAt.getTime()) || receivedAt.toISOString().slice(0, 10) !== input.paymentDate || input.paymentDate > pakistanCalendarDate(new Date())) throw new SirahError("Choose a valid payment date that is not in the future.");
  let phone;
  try { phone = normalizeSirahPhone(input.country, `+${getCountryCallingCode(input.country as CountryCode)}`, input.phone); }
  catch { throw new SirahError("Enter a valid phone number for the selected country."); }
  const countryName = countries[input.country as keyof typeof countries].name;
  const price = priceFor(input.country, input.plan, null);
  let amountMinor: number;
  try { amountMinor = decimalToMinor(input.amount, price.currency); } catch { throw new SirahError("Enter a valid amount for the selected currency."); }
  if (amountMinor <= 0 || amountMinor > 2147483647 || (input.plan === "MONTHLY" && amountMinor * SIRAH_MONTHS > 2147483647)) throw new SirahError("Enter an amount above zero within the supported limit.");
  let receipt: { filename: string; mime: string; sha256: string; storageKey: string; data: Uint8Array<ArrayBuffer> } | undefined;
  if (input.receiptToken) {
    const uploaded = await verifyDirectUpload(input.receiptToken, "admin-registration", input.scope, actor);
    const validated = await validateSirahReceipt(await readDirectUpload(uploaded.key), uploaded.filename);
    receipt = { ...validated, storageKey: uploaded.key, data: new Uint8Array(0) };
  }
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
  return serializable(async tx => {
    const course = await ensureSirahCourse(tx);
    let user = await tx.user.findUnique({ where: { email: input.email }, select: { id: true, status: true } });
    const newAccount = !user;
    if (user && user.status !== "ACTIVE") throw new SirahError("This account is not active; resolve its status first.", 409);
    if (user) {
      const existing = await tx.sirahOrder.findUnique({ where: { userId_courseId_batchCode: { userId: user.id, courseId: course.id, batchCode: input.cohort } }, select: { id: true, reference: true, archivedAt: true, excludedAt: true } });
      if (existing) throw new ExistingSirahRegistration({ id: existing.id, reference: existing.reference, archived: !!existing.archivedAt, excluded: !!existing.excludedAt });
    } else {
      user = await tx.user.create({ data: { fullName: input.fullName, email: input.email, passwordHash, phoneCountryCode: phone.phoneCountryCode, phoneNumber: phone.phoneNumber, studentProfile: { create: { countryCode: input.country, countryName } } }, select: { id: true, status: true } });
    }
    const order = await createSirahOrderRecord(tx, {
      userId: user.id, courseId: course.id, batchCode: input.cohort, requestKey: `admin-paid:${input.scope}`,
      phoneCountry: phone.phoneCountry, phoneE164: phone.phoneE164, countryCode: input.country, countryName, marketCode: price.market,
      plan: input.plan, method: input.method, currency: price.currency, amountMinor,
      totalMinor: input.plan === "MONTHLY" ? amountMinor * SIRAH_MONTHS : amountMinor,
      pricingVersion: "admin-paid-registration-v1", ledgerFeeMinor: input.plan === "ANNUAL" ? amountMinor : null, ledgerFeeCurrency: input.plan === "ANNUAL" ? price.currency : null,
    });
    if (receipt) await tx.sirahReceipt.create({ data: { orderId: order.id, revision: 1, ...receipt } });
    await tx.sirahLedgerPayment.create({ data: { orderId: order.id, amountMinor, currency: price.currency, method: input.method, receivedAt, note: input.note || null, createdBy: actor } });
    if (input.plan === "MONTHLY") await savePaymentPlan(tx, order.id, price.currency, { monthly: input.amount, arrearsPart: "0", billingDay: receivedAt.getUTCDate(), firstDue: input.paymentDate, openingArrears: "0", changeAt: "" });
    await auditSirah(tx, order.id, actor, "ADMIN_PAID_REGISTRATION_CREATED", { method: input.method, paymentDate: input.paymentDate, amountMinor, currency: price.currency, note: input.note || null, receipt: !!receipt });
    await confirmSirahPaymentInTransaction(tx, { orderId: order.id, eventId: `admin-paid:${randomUUID()}`, provider: input.method, amountMinor, currency: price.currency, actor, note: input.note, receivedAt, suppressNotices: true });
    return { id: order.id, reference: order.reference, newAccount };
  });
}
