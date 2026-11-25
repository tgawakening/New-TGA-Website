import type Stripe from "stripe";

export const SETTLEMENT_SOURCE = "sirah-balance-settlement-v1";
export function settlementSessionMatches(
  settlement: { id: string; orderId: string; stripeSessionId: string | null; amountMinor: number; currency: string },
  session: Stripe.Checkout.Session,
) {
  return !!settlement.stripeSessionId && settlement.stripeSessionId === session.id &&
    session.client_reference_id === settlement.id && session.metadata?.sirahSource === SETTLEMENT_SOURCE &&
    session.metadata?.settlementId === settlement.id && session.metadata?.orderId === settlement.orderId &&
    session.mode === "payment" && session.currency?.toUpperCase() === settlement.currency &&
    session.amount_total === settlement.amountMinor;
}

export function settlementSessionState(session: Pick<Stripe.Checkout.Session, "status" | "payment_status">) {
  if (session.status === "complete" && session.payment_status === "paid") return "PAID";
  if (session.status === "expired" && session.payment_status === "unpaid") return "EXPIRED";
  return "PENDING";
}
