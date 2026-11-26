import { formatSirahMoney } from "./catalog";

/** Display only: preserve the registration amount used by payment actions. */
export function displayAgreedFee(order: {
  amountMinor: number;
  currency: string;
  ledgerFeeMinor: number | null;
  ledgerFeeCurrency: string | null;
}) {
  if (order.ledgerFeeMinor === null) return formatSirahMoney(order.amountMinor, order.currency);
  if (!order.ledgerFeeCurrency) return "Currency not recorded; set the fee again";
  return formatSirahMoney(order.ledgerFeeMinor, order.ledgerFeeCurrency);
}
