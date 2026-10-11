import { randomUUID } from "node:crypto";
import { Prisma, type MissionSupportDonation } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyAdmins, sendTransactionalEmail } from "@/lib/email";
import { missionSupportPaymentSchema } from "@/lib/validations/mission-support";
import { donationCountry, allowsManualDonation } from "@/lib/mission-payment-options";
import { missionPurposeLabel } from "@/lib/mission-support";

type Input = z.infer<typeof missionSupportPaymentSchema>;
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
const money = (amount: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount / 100);
function publicUrl() { const url = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"); if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Invalid public URL."); return url.origin; }
function paypalBase() { return process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com"; }
async function paypalToken() {
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  if (!response.ok) throw new Error("PayPal authentication failed.");
  const data = await response.json(); if (!data.access_token) throw new Error("PayPal authentication failed."); return data.access_token as string;
}
async function acknowledge(donation: MissionSupportDonation, manual: boolean, transferReference?: string) {
  const text = `${manual ? "Manual contribution submitted for review" : "Contribution confirmed"}\nDonor: ${donation.fullName}\nEmail: ${donation.email}\nCountry: ${donation.countryName}\nPhone: ${donation.phoneCountryCode} ${donation.phoneNumber}\nAmount: ${money(donation.amount, donation.currency)}\nPurpose: ${missionPurposeLabel(donation.purpose)}\nFrequency: ${donation.frequency === "MONTHLY" ? "Monthly manual pledge (not an automatic subscription)" : "One-time"}\nReference: ${donation.paymentReference}\n${manual ? "Your transfer is not confirmed until TGA verifies it." : "Thank you for supporting TGA. This is a payment acknowledgment, not a tax or Gift Aid receipt."}`;
  const fullText = transferReference ? `${text}\nTransfer transaction reference: ${transferReference}` : text;
  const results = await Promise.allSettled([
    sendTransactionalEmail({ to: donation.email, subject: manual ? "Your TGA transfer is awaiting review" : "Your TGA contribution is confirmed", emailType: manual ? "MISSION_SUPPORT_MANUAL_SUBMITTED" : "MISSION_SUPPORT_CONFIRMED", text: fullText, html: `<p>${escape(fullText).replaceAll("\n", "<br />")}</p>` }),
    notifyAdmins({ subject: `${manual ? "Review manual donation" : "Donation confirmed"}: ${donation.paymentReference}`, emailType: manual ? "ADMIN_MISSION_SUPPORT_MANUAL_SUBMITTED" : "ADMIN_MISSION_SUPPORT_CONFIRMED", text: fullText, html: `<p>${escape(fullText).replaceAll("\n", "<br />")}</p>` }),
  ]);
  if (results.some(result => result.status === "rejected")) console.error("Donation notification delivery failed", donation.id);
}

export async function startAlternativeMissionPayment(input: Input) {
  const manual = input.paymentMethod === "BANK_TRANSFER" || input.paymentMethod === "JAZZCASH";
  if (manual && (!allowsManualDonation(input.countryCode, input.phoneCountryCode) || !input.manualAmountPkr || !input.senderName || !input.referenceKey)) throw new Error("Invalid manual transfer details.");
  if (!manual && (input.paymentMethod !== "PAYPAL" || input.frequency !== "ONE_TIME")) throw new Error("Invalid payment method or frequency.");
  const currency = manual ? "PKR" : "GBP";
  const amount = Math.round((manual ? input.manualAmountPkr! : input.amountGbp!) * 100);
  let donation = await prisma.missionSupportDonation.findUnique({ where: { checkoutKey: input.requestId } });
  let created = false;
  if (!donation) {
    try {
      donation = await prisma.missionSupportDonation.create({ data: {
        fullName: input.fullName, email: input.email.toLowerCase(), phoneCountryCode: input.phoneCountryCode, phoneNumber: input.phoneNumber, countryName: donationCountry(input.countryCode)!.name,
        amount, currency, paymentMethod: input.paymentMethod, frequency: input.frequency, purpose: input.purpose, checkoutKey: input.requestId, paymentReference: `TGA-${randomUUID().slice(0, 8).toUpperCase()}`,
        status: manual ? "UNDER_REVIEW" : "INITIATED", subscriptionStatus: manual && input.frequency === "MONTHLY" ? "manual_pledge" : null,
        ...(manual ? { manualSubmission: { create: { method: input.paymentMethod, senderName: input.senderName!, senderNumber: input.phoneNumber, referenceKey: input.referenceKey!, notes: input.notes || null } } } : {}),
      } }); created = true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      donation = await prisma.missionSupportDonation.findUnique({ where: { checkoutKey: input.requestId } });
    }
  }
  if (!donation || donation.fullName !== input.fullName || donation.email !== input.email.toLowerCase() || donation.amount !== amount || donation.currency !== currency || donation.purpose !== input.purpose || donation.frequency !== input.frequency || donation.paymentMethod !== input.paymentMethod || donation.countryName !== donationCountry(input.countryCode)!.name || donation.phoneCountryCode !== input.phoneCountryCode || donation.phoneNumber !== input.phoneNumber) throw new Error("This payment attempt has changed. Start a new contribution.");
  if (manual) {
    const transfer = await prisma.missionSupportManualSubmission.findUnique({ where: { donationId: donation.id } });
    if (!transfer || transfer.senderName !== input.senderName || transfer.referenceKey !== input.referenceKey || (transfer.notes || "") !== (input.notes || "")) throw new Error("This transfer submission has changed.");
    if (created) await acknowledge(donation, true, input.referenceKey);
    return { mode: "MANUAL", paymentReference: donation.paymentReference, status: donation.status };
  }
  if (["SUCCEEDED", "CONFIRMED"].includes(donation.status)) throw new Error("This contribution has already been confirmed.");
  const token = await paypalToken();
  if (donation.providerOrderId) {
    const response = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(donation.providerOrderId)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("PayPal order is unavailable.");
    const order = await response.json(); const link = order.links?.find((link: { rel: string; href: string }) => link.rel === "approve")?.href;
    if (link) return { mode: "PAYPAL", checkoutUrl: link };
    throw new Error("This checkout has already completed or expired.");
  }
  const response = await fetch(`${paypalBase()}/v2/checkout/orders`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `mission-${input.requestId}`, Prefer: "return=representation" }, body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: donation.id, custom_id: donation.id, amount: { currency_code: "GBP", value: (amount / 100).toFixed(2) }, description: `${missionPurposeLabel(donation.purpose)} (${donation.paymentReference})` }], application_context: { return_url: `${publicUrl()}/support-our-mission?payment=success&provider=paypal&donationId=${donation.id}`, cancel_url: `${publicUrl()}/support-our-mission?payment=cancelled`, shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" } }) });
  if (!response.ok) throw new Error("PayPal checkout could not be opened.");
  const order = await response.json(); const checkoutUrl = order.links?.find((link: { rel: string; href: string }) => link.rel === "approve")?.href;
  if (!order.id || !checkoutUrl) throw new Error("PayPal did not provide an approval link.");
  await prisma.missionSupportDonation.update({ where: { id: donation.id }, data: { providerOrderId: order.id, status: "PENDING" } });
  return { mode: "PAYPAL", checkoutUrl };
}

export async function confirmMissionPaypalPayment(donationId: string, orderId: string) {
  const donation = await prisma.missionSupportDonation.findUnique({ where: { id: donationId } });
  if (!donation || donation.paymentMethod !== "PAYPAL" || donation.providerOrderId !== orderId) throw new Error("PayPal order does not match this contribution.");
  const token = await paypalToken(); const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `mission-capture-${donation.id}`, Prefer: "return=representation" };
  let response = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}`, { headers });
  if (!response.ok) throw new Error("PayPal order could not be verified.");
  let order = await response.json();
  if (order.status === "APPROVED") {
    response = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", headers });
    if (!response.ok) {
      // A concurrent return request may have captured it; verify the current provider state.
      response = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}`, { headers });
      if (!response.ok) throw new Error("PayPal capture is not confirmed.");
    }
    order = await response.json();
  }
  const unit = order.purchase_units?.[0]; const capture = unit?.payments?.captures?.[0];
  const value = capture?.amount?.value;
  if (order.id !== orderId || order.purchase_units?.length !== 1 || unit.custom_id !== donation.id || unit.reference_id !== donation.id || order.status !== "COMPLETED" || !capture?.id || capture.status !== "COMPLETED" || capture.amount?.currency_code !== donation.currency || typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value) || Math.round(Number(value) * 100) !== donation.amount) throw new Error("PayPal has not confirmed the expected contribution.");
  let newlyConfirmed = false;
  await prisma.$transaction(async tx => {
    const previous = await tx.missionSupportPayment.findUnique({ where: { providerReference: `paypal:${capture.id}` } });
    if (previous && previous.donationId !== donation.id) throw new Error("PayPal payment reference mismatch.");
    const updated = await tx.missionSupportDonation.updateMany({ where: { id: donation.id, status: { in: ["INITIATED", "PENDING", "FAILED"] } }, data: { status: "SUCCEEDED", providerPaymentId: capture.id, paidAt: new Date() } });
    await tx.missionSupportPayment.upsert({ where: { providerReference: `paypal:${capture.id}` }, create: { donationId: donation.id, providerReference: `paypal:${capture.id}`, providerPaymentId: capture.id, amount: donation.amount, currency: donation.currency, status: "SUCCEEDED", paidAt: new Date() }, update: {} });
    newlyConfirmed = updated.count > 0;
  });
  if (newlyConfirmed) await acknowledge(donation, false);
  return { status: "confirmed", amountGbp: donation.amount / 100, frequency: donation.frequency, purpose: donation.purpose, reference: donation.paymentReference };
}
