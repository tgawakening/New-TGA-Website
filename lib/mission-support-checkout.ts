import type Stripe from "stripe";
import { missionPurposeLabel } from "./mission-support";

export function buildMissionCheckoutParams(donation: { id: string; amount: number; email: string; frequency: string; purpose: string; paymentReference: string | null }, appUrl: string): Stripe.Checkout.SessionCreateParams {
  const monthly = donation.frequency === "MONTHLY";
  const metadata = { donationId: donation.id, paymentKind: "MISSION_SUPPORT", frequency: donation.frequency, purpose: donation.purpose };
  return {
    mode: monthly ? "subscription" : "payment",
    payment_method_types: ["card"],
    success_url: `${appUrl}/support-our-mission?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/support-our-mission?payment=cancelled`,
    client_reference_id: donation.id,
    customer_email: donation.email,
    metadata,
    line_items: [{ quantity: 1, price_data: { currency: "gbp", unit_amount: donation.amount, ...(monthly ? { recurring: { interval: "month" as const } } : {}), product_data: { name: "The Global Awakening · Mission Support", description: `${missionPurposeLabel(donation.purpose)} · ${donation.paymentReference}`, metadata: { purpose: donation.purpose } } } }],
    ...(monthly ? { subscription_data: { metadata } } : { customer_creation: "always", payment_intent_data: { metadata }, invoice_creation: { enabled: true, invoice_data: { metadata, description: missionPurposeLabel(donation.purpose) } } }),
  };
}

export function paidSessionMatches(session: Pick<Stripe.Checkout.Session, "payment_status" | "amount_total" | "currency">, donation: { amount: number; currency: string }) {
  return session.payment_status === "paid" && session.amount_total === donation.amount && session.currency?.toUpperCase() === donation.currency;
}
