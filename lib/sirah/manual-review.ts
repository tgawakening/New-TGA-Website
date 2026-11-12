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
