import type { FeePlan, Market } from "./course-config";

// Source: client-supplied SIRAH_Website_Pricing_Team_Guide.pdf, 2 November 2026.
// Major currency units; these fixed amounts are never calculated from live FX.
const rates: [string, string, string, number, number][] = [
  ["PK", "Pakistan", "PKR", 3000, 32400],
  ["IN", "India", "INR", 1500, 16200],
  ["GB", "United Kingdom", "GBP", 29.99, 323.89],
  ["US", "United States", "USD", 39.99, 431.89],
  ["SA", "Saudi Arabia", "SAR", 85, 918],
  ["QA", "Qatar", "QAR", 85, 918],
  ["BH", "Bahrain", "BHD", 8.5, 91.8],
  ["KW", "Kuwait", "KWD", 7, 75.6],
  ["CA", "Canada", "CAD", 55.99, 604.69],
  ["EURO", "Eurozone countries", "EUR", 35.99, 388.69],
  ["CH", "Switzerland", "CHF", 32.99, 356.29],
  ["SE", "Sweden", "SEK", 395, 4266],
  ["NO", "Norway", "NOK", 369, 3985.2],
  ["DK", "Denmark", "DKK", 269, 2905.2],
  ["PL", "Poland", "PLN", 159, 1717.2],
  ["CZ", "Czechia", "CZK", 875, 9450],
  ["HU", "Hungary", "HUF", 13100, 141480],
  ["RO", "Romania", "RON", 192, 2073.6],
  ["OTHER", "Other country (billed in GBP)", "GBP", 29.99, 323.89],
];

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
    total: annual
      ? `${formatFee(amount, currency)} total for 12 months`
      : `${formatFee(Math.round(amount * 12 * 1000) / 1000, currency)} over 12 months`,
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
    annual: plan(
      annual,
      currency,
      true,
      "Single online payment, where available",
    ),
    ...(code === "PK"
      ? {
          manualMonthly: plan(
            3500,
            "PKR",
            false,
            "Manual payment initiated by the student",
          ),
          onlineRecurringVerified: false,
        }
      : {}),
    // The guide explicitly leaves cancellation/refund terms unresolved. Do not activate
    // any checkout until terms, tax treatment, currencies and provider routes are approved.
    terms: null,
  }),
);
