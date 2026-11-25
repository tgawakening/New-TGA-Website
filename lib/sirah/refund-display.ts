/**
 * How refunds are DISPLAYED in the Sīrah admin. Read-only: these helpers only
 * interpret what refund recording already stored on the order (paidMinor is
 * the gross received, refundedMinor the verified refunds, both in the order's
 * own currency). They never change payment, enrolment or billing state.
 */

type Money = { paidMinor: number; refundedMinor: number; events?: { kind: string; amountMinor: number }[] };
export function sirahPendingRefundMinor(order: Money) { return (order.events ?? []).filter((event) => event.kind === "REFUND_PENDING").reduce((sum, event) => sum + event.amountMinor, 0); }

/** Money kept after verified refunds: paid minus refunded, never below zero. */
export function sirahNetReceivedMinor(order: Money) {
  return Math.max(0, order.paidMinor - order.refundedMinor - sirahPendingRefundMinor(order));
}

/** A partial refund leaves the order PAID with some money refunded. A full
 * refund moves it to REFUNDED, which keeps its own label. */
export function sirahIsPartiallyRefunded(order: Money & { paymentState: string }) {
  return order.paymentState === "PAID" && order.refundedMinor > 0;
}

/** The payment status to show: "PARTIALLY_REFUNDED" for a partly refunded
 * paid order, otherwise the stored status unchanged. */
export function sirahDisplayPaymentState(order: Money & { paymentState: string }) {
  const pending = sirahPendingRefundMinor(order);
  if (pending) return order.refundedMinor + pending >= order.paidMinor ? "REFUNDED" : "PARTIALLY_REFUNDED";
  return sirahIsPartiallyRefunded(order) ? "PARTIALLY_REFUNDED" : order.paymentState;
}
