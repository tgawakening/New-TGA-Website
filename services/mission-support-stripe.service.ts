import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { Prisma, type MissionSupportDonation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyAdmins, sendTransactionalEmail } from "@/lib/email";
import { missionPurposeLabel, type GivingFrequency, type MissionPurpose } from "@/lib/mission-support";
import { buildMissionCheckoutParams, paidSessionMatches } from "@/lib/mission-support-checkout";

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || /xxx|replace/i.test(key)) throw new Error("Secure checkout is not configured.");
  return new Stripe(key);
}

function baseUrl() {
  const url = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("The application URL must use HTTPS.");
  return url.origin;
}

function idOf(value: string | { id: string } | null | undefined) { return typeof value === "string" ? value : value?.id ?? null; }
function escape(value: string) { return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

export function createMissionManagementToken(donationId: string, now = Date.now()) {
  const secret = process.env.MISSION_SUPPORT_MANAGEMENT_SECRET;
  if (!secret || secret.length < 32) throw new Error("Support management is not configured.");
  const payload = Buffer.from(JSON.stringify({ donationId, expires: now + 365 * 86400000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function verifyMissionManagementToken(token: string, now = Date.now()): string {
  const secret = process.env.MISSION_SUPPORT_MANAGEMENT_SECRET;
  if (!secret || secret.length < 32) throw new Error("Support management is not configured.");
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) throw new Error("Invalid management link.");
  const expected = createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Invalid management link.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { donationId?: string; expires?: number };
  if (typeof data.donationId !== "string" || typeof data.expires !== "number" || data.expires < now) throw new Error("This management link has expired. Please contact TGA.");
  return data.donationId;
}

export async function startMissionStripeCheckout(input: { fullName: string; email: string; amountGbp: number; frequency: GivingFrequency; purpose: MissionPurpose; requestId: string }) {
  const stripe = stripeClient();
  const amount = Math.round(input.amountGbp * 100);
  let donation = await prisma.missionSupportDonation.findUnique({ where: { checkoutKey: input.requestId } });
  if (!donation) {
    try {
      donation = await prisma.missionSupportDonation.create({ data: { fullName: input.fullName, email: input.email.toLowerCase(), amount, paymentMethod: "STRIPE", frequency: input.frequency, purpose: input.purpose, checkoutKey: input.requestId, paymentReference: `TGA-${randomUUID().slice(0, 8).toUpperCase()}` } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      donation = await prisma.missionSupportDonation.findUnique({ where: { checkoutKey: input.requestId } });
      if (!donation) throw error;
    }
  }
  if (donation.email !== input.email.toLowerCase() || donation.amount !== amount || donation.purpose !== input.purpose || donation.frequency !== input.frequency || donation.fullName !== input.fullName) throw new Error("This checkout attempt has changed. Refresh the form and try again.");
  if (donation.providerOrderId) {
    const existing = await stripe.checkout.sessions.retrieve(donation.providerOrderId);
    if (existing.status === "open" && existing.url) return { checkoutUrl: existing.url };
    throw new Error("This checkout has already completed or expired. Please start a new contribution.");
  }
  const session = await stripe.checkout.sessions.create(buildMissionCheckoutParams(donation, baseUrl()), { idempotencyKey: `mission-${input.requestId}` });
  if (!session.url) throw new Error("The payment provider did not return a checkout URL.");
  await prisma.missionSupportDonation.update({ where: { id: donation.id }, data: { providerOrderId: session.id, status: "PENDING" } });
  return { checkoutUrl: session.url };
}

async function sendAcknowledgment(donation: MissionSupportDonation, amount: number, receiptUrl?: string | null) {
  const formatted = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount / 100);
  const purpose = missionPurposeLabel(donation.purpose);
  const managementUrl = donation.frequency === "MONTHLY" ? `${baseUrl()}/support-our-mission?manage=${createMissionManagementToken(donation.id)}` : null;
  const lines = [`Assalamu alaikum ${donation.fullName},`, `Thank you for supporting The Global Awakening. Your payment of ${formatted} has been confirmed.`, `Funding purpose: ${purpose}`, `Frequency: ${donation.frequency === "MONTHLY" ? "Monthly" : "One-time"}`, `Reference: ${donation.paymentReference}`, "This is a payment acknowledgment, not a tax or Gift Aid receipt.", ...(receiptUrl ? [`Payment receipt: ${receiptUrl}`] : []), ...(managementUrl ? [`Manage or cancel monthly support: ${managementUrl}`] : [])];
  await sendTransactionalEmail({ to: donation.email, subject: "Your TGA contribution is confirmed", emailType: "MISSION_SUPPORT_CONFIRMED", text: lines.join("\n\n"), html: lines.map(line => `<p>${escape(line)}</p>`).join("") });
  await notifyAdmins({ subject: `Mission support confirmed: ${donation.paymentReference}`, emailType: "ADMIN_MISSION_SUPPORT_CONFIRMED", text: `${formatted} · ${purpose} · ${donation.frequency} · ${donation.paymentReference}`, html: `<p>${escape(formatted)} · ${escape(purpose)} · ${escape(donation.frequency)} · ${escape(donation.paymentReference || donation.id)}</p>` });
}

async function recordPayment(event: Stripe.Event, donation: MissionSupportDonation, payment: { reference: string; paymentId: string | null; invoiceId?: string | null; amount: number; currency: string; success: boolean; receiptUrl?: string | null }) {
  if (payment.currency.toUpperCase() !== "GBP" || payment.amount < 0) throw new Error("Unexpected contribution currency or amount.");
  let newlyPaid = false;
  try {
    await prisma.$transaction(async tx => {
      await tx.missionSupportWebhookEvent.create({ data: { id: event.id } });
      const previous = await tx.missionSupportPayment.findUnique({ where: { providerReference: payment.reference } });
      if (previous?.donationId && previous.donationId !== donation.id) throw new Error("Payment reference does not match this contribution.");
      if (previous && ["SUCCEEDED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(previous.status)) return;
      const data = { amount: payment.amount, currency: "GBP", status: payment.success ? "SUCCEEDED" : "FAILED", providerPaymentId: payment.paymentId, providerInvoiceId: payment.invoiceId ?? null, receiptUrl: payment.receiptUrl ?? null, paidAt: payment.success ? new Date(event.created * 1000) : null };
      await tx.missionSupportPayment.upsert({ where: { providerReference: payment.reference }, create: { donationId: donation.id, providerReference: payment.reference, ...data }, update: data });
      await tx.missionSupportDonation.update({ where: { id: donation.id }, data: { ...(payment.success ? { status: "SUCCEEDED", paidAt: new Date(event.created * 1000), providerPaymentId: payment.paymentId } : { ...(donation.paidAt ? {} : { status: "FAILED" }), ...(donation.frequency === "MONTHLY" ? { subscriptionStatus: "past_due" } : {}) }) } });
      newlyPaid = payment.success;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && await prisma.missionSupportWebhookEvent.findUnique({ where: { id: event.id } })) return;
    throw error;
  }
  if (newlyPaid) {
    // The payment remains confirmed if an email provider is unavailable. Email failures are logged separately.
    const results = await Promise.allSettled([sendAcknowledgment(donation, payment.amount, payment.receiptUrl)]);
    if (results[0].status === "rejected") console.error("Mission support acknowledgment delivery failed", donation.id);
  }
}

export async function handleMissionSupportStripeEvent(event: Stripe.Event, stripe: Stripe): Promise<boolean> {
  if (event.type.startsWith("checkout.session.")) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.paymentKind !== "MISSION_SUPPORT") return false;
    const donation = await prisma.missionSupportDonation.findUnique({ where: { id: session.metadata.donationId } });
    if (!donation || donation.paymentMethod !== "STRIPE") throw new Error("Contribution not found.");
    if (donation.providerOrderId && donation.providerOrderId !== session.id) throw new Error("Checkout reference mismatch.");
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      const subscriptionId = idOf(session.subscription);
      const customerId = idOf(session.customer);
      await prisma.missionSupportDonation.update({ where: { id: donation.id }, data: { providerOrderId: session.id, providerCustomerId: customerId, providerSubscriptionId: subscriptionId } });
      if (donation.frequency === "ONE_TIME" && paidSessionMatches(session, donation)) await recordPayment(event, donation, { reference: session.id, paymentId: idOf(session.payment_intent), amount: session.amount_total!, currency: session.currency!, success: true });
    } else if (["checkout.session.expired", "checkout.session.async_payment_failed"].includes(event.type)) {
      await prisma.missionSupportDonation.updateMany({ where: { id: donation.id, status: { in: ["INITIATED", "PENDING"] } }, data: { status: "FAILED" } });
    }
    return true;
  }
  if (["invoice.paid", "invoice.payment_failed"].includes(event.type)) {
    const invoice = event.data.object as Stripe.Invoice;
    const details = invoice.parent?.subscription_details;
    const subscriptionId = idOf(details?.subscription);
    let metadata = details?.metadata;
    let donation = subscriptionId ? await prisma.missionSupportDonation.findUnique({ where: { providerSubscriptionId: subscriptionId } }) : null;
    if (!donation && subscriptionId && !metadata?.donationId) metadata = (await stripe.subscriptions.retrieve(subscriptionId)).metadata;
    if (!donation && metadata?.paymentKind === "MISSION_SUPPORT" && metadata.donationId) donation = await prisma.missionSupportDonation.findUnique({ where: { id: metadata.donationId } });
    if (!donation) return false;
    if (donation.frequency !== "MONTHLY" || donation.paymentMethod !== "STRIPE" || !subscriptionId) throw new Error("Unexpected recurring payment.");
    await prisma.missionSupportDonation.update({ where: { id: donation.id }, data: { providerSubscriptionId: subscriptionId, providerCustomerId: idOf(invoice.customer) } });
    const success = event.type === "invoice.paid" && invoice.status === "paid";
    const payments = success ? (invoice.payments ?? await stripe.invoicePayments.list({ invoice: invoice.id, limit: 10 })) : null;
    const paymentId = idOf(payments?.data.find(p => p.status === "paid")?.payment.payment_intent);
    await recordPayment(event, donation, { reference: invoice.id, paymentId, invoiceId: invoice.id, amount: success ? invoice.amount_paid : invoice.amount_due, currency: invoice.currency, success, receiptUrl: invoice.hosted_invoice_url });
    return true;
  }
  if (event.type.startsWith("customer.subscription.")) {
    const subscription = event.data.object as Stripe.Subscription;
    const donation = await prisma.missionSupportDonation.findUnique({ where: { providerSubscriptionId: subscription.id } }) ?? (subscription.metadata.paymentKind === "MISSION_SUPPORT" && subscription.metadata.donationId ? await prisma.missionSupportDonation.findUnique({ where: { id: subscription.metadata.donationId } }) : null);
    if (!donation) return false;
    // Retrieve current state so a delayed webhook cannot reactivate a cancelled subscription.
    const current = await stripe.subscriptions.retrieve(subscription.id);
    await prisma.missionSupportDonation.update({ where: { id: donation.id }, data: { providerSubscriptionId: subscription.id, providerCustomerId: idOf(current.customer), subscriptionStatus: current.status, cancelAtPeriodEnd: current.cancel_at_period_end } });
    return true;
  }
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentId = idOf(charge.payment_intent);
    if (!paymentId) return false;
    const payment = await prisma.missionSupportPayment.findFirst({ where: { providerPaymentId: paymentId } });
    if (!payment) return false;
    // Use provider's latest refund total rather than an older event snapshot.
    const current = await stripe.charges.retrieve(charge.id);
    await prisma.missionSupportPayment.update({ where: { id: payment.id }, data: { refundedAmount: current.amount_refunded, status: current.refunded ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
    return true;
  }
  return false;
}

export async function getMissionPaymentConfirmation(sessionId: string) {
  const session = await stripeClient().checkout.sessions.retrieve(sessionId);
  if (session.metadata?.paymentKind !== "MISSION_SUPPORT" || !session.metadata.donationId) throw new Error("Contribution not found.");
  const donation = await prisma.missionSupportDonation.findUnique({ where: { id: session.metadata.donationId }, include: { payments: { where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!donation || donation.providerOrderId !== session.id) throw new Error("Contribution not found.");
  const confirmed = donation.payments.length > 0 || (donation.frequency === "ONE_TIME" && donation.status === "SUCCEEDED" && paidSessionMatches(session, donation));
  return { status: confirmed ? "confirmed" : donation.status === "FAILED" ? "failed" : "pending", amountGbp: donation.amount / 100, frequency: donation.frequency, purpose: missionPurposeLabel(donation.purpose), reference: donation.paymentReference, ...(confirmed && donation.frequency === "MONTHLY" ? { managementToken: createMissionManagementToken(donation.id) } : {}) };
}

export async function createMissionBillingPortal(token: string) {
  const donationId = verifyMissionManagementToken(token);
  const donation = await prisma.missionSupportDonation.findUnique({ where: { id: donationId } });
  if (!donation?.providerCustomerId || donation.frequency !== "MONTHLY") throw new Error("Monthly support account not found.");
  const session = await stripeClient().billingPortal.sessions.create({ customer: donation.providerCustomerId, return_url: `${baseUrl()}/support-our-mission`, ...(process.env.MISSION_SUPPORT_PORTAL_CONFIGURATION_ID ? { configuration: process.env.MISSION_SUPPORT_PORTAL_CONFIGURATION_ID } : {}) });
  return { url: session.url };
}

export async function refundMissionPayment(paymentId: string, requestId: string, amount?: number) {
  const payment = await prisma.missionSupportPayment.findUnique({ where: { id: paymentId } });
  if (!payment?.providerPaymentId || !["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(payment.status)) throw new Error("This contribution cannot be refunded through Stripe.");
  const remaining = payment.amount - payment.refundedAmount;
  if (amount !== undefined && (!Number.isInteger(amount) || amount < 1 || amount > remaining)) throw new Error("Invalid refund amount.");
  const refund = await stripeClient().refunds.create({ payment_intent: payment.providerPaymentId, amount: amount ?? remaining, metadata: { donationId: payment.donationId, missionPaymentId: payment.id } }, { idempotencyKey: `mission-refund-${requestId}` });
  // charge.refunded confirms the refund ledger, rather than treating a request as completed.
  return { refundId: refund.id, status: refund.status };
}
