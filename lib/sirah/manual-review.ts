/** Staff may recover a first manual payment without fabricating student evidence. */
export function canRecoverSirahManualPayment(order: {
  method: string | null;
  countryCode: string;
  currency: string;
  paymentState: string;
  enrolmentState: string;
  paidCount: number;
  paidMinor: number;
  cancelledAt: unknown;
  providerOrderId?: string | null;
  providerSubscriptionId?: string | null;
}) {
  const manual = order.method === "BANK_TRANSFER" || order.method === "JAZZCASH";
  const missingPakistanMethod = !order.method && order.countryCode === "PK" && order.currency === "PKR";
  return (manual || missingPakistanMethod) &&
    (["UNPAID", "REJECTED", "FAILED"].includes(order.paymentState) ||
      (!order.method && order.paymentState === "AWAITING_REVIEW")) &&
    order.enrolmentState === "PENDING" && !order.cancelledAt &&
    order.paidCount === 0 && order.paidMinor === 0 &&
    !order.providerOrderId && !order.providerSubscriptionId;
}
/** A Stripe / PayPal registration that never collected money, which staff may
 * complete with a verified bank / JazzCash payment instead. */
export function canCompleteSirahGatewayManually(order: {
  method: string | null;
  paymentState: string;
  enrolmentState: string;
  paidCount: number;
  paidMinor: number;
  cancelledAt: unknown;
  archivedAt?: unknown;
}) {
  return (
    (order.method === "STRIPE" || order.method === "PAYPAL") &&
    ["UNPAID", "PROCESSING", "FAILED"].includes(order.paymentState) &&
    order.enrolmentState === "PENDING" &&
    !order.cancelledAt &&
    !order.archivedAt &&
    order.paidCount === 0 &&
    order.paidMinor === 0
  );
}
