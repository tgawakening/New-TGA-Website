/** Authoritative fixed catalogue: SIRAH Website Pricing Team Guide, 2 Nov 2026.
 * UK reconfirmed by client: GBP 29.99 monthly; GBP 323.89 upfront,
 * compared with GBP 359.88 for twelve monthly payments, 8 Nov 2026.
 * Public display data only. Server quotes always resolve these values again. */
export const SIRAH_SLUG = "seerah-course";
export const SIRAH_TITLE =
  "SĪRAH | BEYOND CHRONOLOGY: Law, Power, Leadership & Movement";
export const SIRAH_BATCH = "beyond-chronology-2026";
export const SIRAH_PRICING_VERSION = "sirah-2026-11-08-uk-reconfirmed-v3";
export const SIRAH_MONTHS = 12;
export type SirahPlan = "MONTHLY" | "ANNUAL";
export type SirahMethod = "STRIPE" | "PAYPAL" | "BANK_TRANSFER" | "JAZZCASH";
export const EUROZONE = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "DE",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PT",
  "SI",
  "SK",
]);
export const catalogue = [
  ["PK", "Pakistan", "PKR", "3000", "3500", "32400"],
  ["IN", "India", "INR", "1500", "1500", "16200"],
  ["GB", "United Kingdom", "GBP", "29.99", "29.99", "323.89"],
  ["US", "United States", "USD", "39.99", "39.99", "431.89"],
  ["SA", "Saudi Arabia", "SAR", "85", "85", "918"],
  ["QA", "Qatar", "QAR", "85", "85", "918"],
  ["BH", "Bahrain", "BHD", "8.500", "8.500", "91.800"],
  ["KW", "Kuwait", "KWD", "7.000", "7.000", "75.600"],
  ["CA", "Canada", "CAD", "55.99", "55.99", "604.69"],
  ["EURO", "Eurozone countries", "EUR", "35.99", "35.99", "388.69"],
  ["CH", "Switzerland", "CHF", "32.99", "32.99", "356.29"],
  ["SE", "Sweden", "SEK", "395", "395", "4266"],
  ["NO", "Norway", "NOK", "369", "369", "3985.20"],
  ["DK", "Denmark", "DKK", "269", "269", "2905.20"],
  ["PL", "Poland", "PLN", "159", "159", "1717.20"],
  ["CZ", "Czechia", "CZK", "875", "875", "9450"],
  ["HU", "Hungary", "HUF", "13100", "13100", "141480"],
  ["RO", "Romania", "RON", "192", "192", "2073.60"],
  ["OTHER", "Other country (billed in GBP)", "GBP", "29.99", "29.99", "323.89"],
] as const;
export function currencyScale(currency: string) {
  return currency === "BHD" || currency === "KWD" ? 3 : 2;
}
export function decimalToMinor(value: string, currency: string): number {
  const scale = currencyScale(currency);
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error("Invalid money amount.");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale)))
    throw new Error("Unsupported currency precision.");
  const result =
    BigInt(whole) * BigInt(10) ** BigInt(scale) +
    BigInt(fraction.slice(0, scale).padEnd(scale, "0"));
  if (result > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Money amount exceeds supported precision.");
  return Number(result);
}
export function minorToDecimal(value: number, currency: string) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Invalid minor-unit amount.");
  const scale = currencyScale(currency);
  const digits = String(value).padStart(scale + 1, "0");
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}
export function formatSirahMoney(value: number, currency: string) {
  const scale = currencyScale(currency);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
  }).format(Number(minorToDecimal(value, currency)));
}
export function resolveMarket(countryCode: string) {
  const code = countryCode.toUpperCase();
  return (
    catalogue.find((row) => row[0] === code) ||
    catalogue.find((row) => row[0] === (EUROZONE.has(code) ? "EURO" : "OTHER"))!
  );
}
export function priceFor(
  country: string,
  plan: SirahPlan,
  method: SirahMethod | null,
) {
  const market = resolveMarket(country);
  const manual = method === "BANK_TRANSFER" || method === "JAZZCASH";
  const amountMinor = decimalToMinor(
    plan === "ANNUAL" ? market[5] : market[manual ? 4 : 3],
    market[2],
  );
  return {
    pricingVersion: SIRAH_PRICING_VERSION,
    market: market[0],
    currency: market[2],
    amountMinor,
    totalMinor: plan === "ANNUAL" ? amountMinor : amountMinor * SIRAH_MONTHS,
    plan,
    months: SIRAH_MONTHS,
    courseSlug: SIRAH_SLUG,
    courseTitle: SIRAH_TITLE,
    batchCode: SIRAH_BATCH,
    method,
  };
}

/** Compare the upfront fee with online monthly fees, never Pakistan's manual rate. */
export function annualSirahSavings(country: string, annualAmountMinor?: number) {
  const monthly = priceFor(country, "MONTHLY", "STRIPE");
  const upfront = priceFor(country, "ANNUAL", "STRIPE");
  const upfrontMinor = annualAmountMinor ?? upfront.amountMinor;
  if (!Number.isSafeInteger(upfrontMinor) || upfrontMinor < 0)
    throw new Error("Invalid annual amount.");
  const standardMinor = monthly.amountMinor * SIRAH_MONTHS;
  const savingMinor = Math.max(0, standardMinor - upfrontMinor);
  return {
    currency: upfront.currency,
    originalMonthlyMinor: monthly.amountMinor,
    // Presentation only: the exact annual total remains the one-time charge.
    monthlyEquivalentMinor: Math.floor((upfrontMinor + SIRAH_MONTHS / 2) / SIRAH_MONTHS),
    standardMinor,
    upfrontMinor,
    savingMinor,
    approximatePercent: Number(
      (BigInt(savingMinor) * BigInt(100) + BigInt(standardMinor) / BigInt(2)) /
        BigInt(standardMinor),
    ),
  };
}
