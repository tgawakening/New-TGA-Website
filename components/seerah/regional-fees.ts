import { catalogue } from "@/lib/sirah/catalog";
import type { FeePlan, Market } from "./course-config";

// Source: client-supplied SIRAH_Website_Pricing_Team_Guide.pdf, 2 November 2026.
// Major currency units; these fixed amounts are never calculated from live FX.
const rates = catalogue.map(
  ([code, name, currency, monthly, , annual]) =>
    [code, name, currency, Number(monthly), Number(annual)] as [
      string,
      string,
      string,
      number,
      number,
    ],
);

export function formatFee(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(amount);
}
function plan(
  amount: number,
  currency: string,
  annual: boolean,
  method: string,
): FeePlan {
  return {
    amount,
    currency,
    frequency: annual ? "One-time payment" : "Per month",
    method,
    total: annual ? `${formatFee(amount, currency)} total for 12 months` : null,
    checkoutUrl: null,
  };
}
export const regionalFees: Market[] = rates.map(
  ([code, name, currency, monthly, annual]) => ({
    code,
    name,
    monthly: plan(
      monthly,
      currency,
      false,
      "Automatic card billing, where available",
    ),
    // The client's revised UK annual fee is pending; keep its old quote unpublished.
    annual: code === "GB" ? null : plan(
      annual,
      currency,
      true,
      "Single online payment, where available",
    ),
    ...(code === "PK"
      ? {
          manualMonthly: plan(
            Number(catalogue.find((row) => row[0] === "PK")![4]),
            "PKR",
            false,
            "Manual payment through JazzCash or Meezan Bank",
          ),
          onlineRecurringVerified: false,
        }
      : {}),
    // The guide explicitly leaves cancellation/refund terms unresolved. Do not activate
    // any checkout until terms, tax treatment, currencies and provider routes are approved.
    terms: null,
  }),
);
