import "server-only";
import { currencyScale, type SirahMethod, type SirahPlan } from "./catalog";
export const PAYMENT_SUPPORT_URL = "https://wa.me/923262055614";

export function courseGroupAudience(country: string) {
  const pakistan = process.env.SIRAH_PAKISTAN_COUNTRY_CODE || "PK";
  return country.toUpperCase() === pakistan.toUpperCase()
    ? "PAKISTAN"
    : "INTERNATIONAL";
}
export function getGroupInvitation(country: string) {
  const suppliedAudience = process.env.SIRAH_SUPPLIED_GROUP_AUDIENCE;
  const value =
    courseGroupAudience(country) === "PAKISTAN"
      ? process.env.SIRAH_PAKISTAN_GROUP_URL ||
        (suppliedAudience === "PAKISTAN"
          ? process.env.SIRAH_SUPPLIED_GROUP_URL || ""
          : "")
      : process.env.SIRAH_INTERNATIONAL_GROUP_URL ||
        (suppliedAudience === "INTERNATIONAL"
          ? process.env.SIRAH_SUPPLIED_GROUP_URL || ""
          : "");
  if (!value) return null;
  try {
    const url = new URL(value.trim().replace(/,$/, ""));
    return url.protocol === "https:" &&
      url.hostname === "chat.whatsapp.com" &&
      /^\/[a-zA-Z0-9]+$/.test(url.pathname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export type SirahTerms = {
  version: string;
  commitment: string;
  cancellation: string;
  refund: string;
  access: string;
  tax: string;
  cancellationTiming: "IMMEDIATE" | "PERIOD_END";
  failedPaymentAccess: "KEEP" | "PAUSE";
  failedPaymentGraceDays?: number;
  refundAccess: "KEEP" | "REVOKE";
  annualRefundBasis?: "FULL_UNUSED_MONTHS";
  refundAccessTiming?: "CURRENT_MONTH_END";
  refundBilling: "CANCEL" | "CONTINUE";
};
export function termsFor(plan: SirahPlan): SirahTerms | null {
  try {
    const value = JSON.parse(
      process.env[
        plan === "ANNUAL"
          ? "SIRAH_ANNUAL_TERMS_JSON"
          : "SIRAH_MONTHLY_TERMS_JSON"
      ] || "null",
    );
    return value &&
      ["IMMEDIATE", "PERIOD_END"].includes(value.cancellationTiming) &&
      ["KEEP", "PAUSE"].includes(value.failedPaymentAccess) &&
      (value.failedPaymentGraceDays === undefined ||
        (Number.isInteger(value.failedPaymentGraceDays) && value.failedPaymentGraceDays >= 0 && value.failedPaymentGraceDays <= 30)) &&
      ["KEEP", "REVOKE"].includes(value.refundAccess) &&
      (value.annualRefundBasis === undefined || value.annualRefundBasis === "FULL_UNUSED_MONTHS") &&
      (value.refundAccessTiming === undefined || value.refundAccessTiming === "CURRENT_MONTH_END") &&
      ["CANCEL", "CONTINUE"].includes(value.refundBilling) &&
      [
        "version",
        "commitment",
        "cancellation",
        "refund",
        "access",
        "tax",
      ].every((key) => typeof value[key] === "string" && value[key].trim())
      ? value
      : null;
  } catch {
    return null;
  }
}
// These exact account details exist in the project's previous registration page.
// Keep them behind explicit verification, not an invented or inferred merchant approval.
export function manualAccounts() {
  const verified = (method: "BANK_TRANSFER" | "JAZZCASH") => {
    const override = process.env[`SIRAH_${method}_VERIFIED`]?.trim();
    return override
      ? override === "true"
      : process.env.SIRAH_MANUAL_ACCOUNTS_VERIFIED === "true";
  };
  return [
    {
      method: "BANK_TRANSFER" as const,
      service: "Meezan Bank",
      holder: process.env.SIRAH_MEEZAN_HOLDER || "AREEJ FATIMA",
      account: process.env.SIRAH_MEEZAN_ACCOUNT || "98900114432111",
      iban: process.env.SIRAH_MEEZAN_IBAN || "PK96MEZN0098900114432111",
    },
    {
      method: "JAZZCASH" as const,
      service: "JazzCash",
      holder: process.env.SIRAH_JAZZCASH_HOLDER || "Areej Fatima",
      account: process.env.SIRAH_JAZZCASH_ACCOUNT || "03244517741",
      iban: null,
    },
  ].filter((account) => verified(account.method));
}
const PAYPAL_CURRENCIES = new Set([
  "GBP",
  "USD",
  "CAD",
  "EUR",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
]);
function configuredCurrencies(provider: string, plan: SirahPlan) {
  return new Set(
    (process.env[`SIRAH_${provider}_${plan}_CURRENCIES`] || "")
      .split(",")
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean),
  );
}
export function methodAvailable(
  method: SirahMethod,
  country: string,
  currency: string,
  plan: SirahPlan,
) {
  if (method === "PAYPAL" && country === "PK") return false;
  if (!termsFor(plan)) return false;
  if (
    method === "STRIPE" &&
    !/^(sk|rk)_test_/.test(process.env.SIRAH_STRIPE_SECRET_KEY || "") &&
    (process.env.SIRAH_LIVE_PAYMENTS_APPROVED !== "true" ||
      process.env.SIRAH_STRIPE_SANDBOX_VERIFIED !== "true")
  )
    return false;
  if (
    method === "PAYPAL" &&
    process.env.PAYPAL_ENV === "live" &&
    process.env.SIRAH_LIVE_PAYMENTS_APPROVED !== "true"
  )
    return false;
  if (method === "BANK_TRANSFER" || method === "JAZZCASH")
    return (
      country === "PK" &&
      manualAccounts().some((account) => account.method === method)
    );
  // A verified GBP checkout must not enable every unlisted country billed in GBP.
  const live = method === "PAYPAL"
    ? process.env.PAYPAL_ENV === "live"
    : !/^(sk|rk)_test_/.test(process.env.SIRAH_STRIPE_SECRET_KEY || "");
  const approvedCountries = new Set(
    (process.env[`SIRAH_${method}_${plan}_COUNTRIES`] || "")
      .split(",")
      .map(value => value.trim().toUpperCase())
      .filter(value => /^[A-Z]{2}$/.test(value)),
  );
  if (live && !approvedCountries.has(country.toUpperCase())) return false;
  if (
    country === "PK" &&
    plan === "MONTHLY" &&
    process.env.SIRAH_PK_RECURRING_VERIFIED !== "true"
  )
    return false;
  if (!configuredCurrencies(method, plan).has(currency)) return false;
  if (method === "STRIPE")
    return Boolean(
      process.env.SIRAH_STRIPE_SECRET_KEY &&
      process.env.SIRAH_STRIPE_WEBHOOK_SECRET &&
      process.env.SIRAH_STRIPE_ACCOUNT_ID,
    );
  return (
    PAYPAL_CURRENCIES.has(currency) &&
    currencyScale(currency) === 2 &&
    Boolean(
      process.env.PAYPAL_CLIENT_ID &&
      process.env.PAYPAL_CLIENT_SECRET &&
      process.env.SIRAH_PAYPAL_MERCHANT_ID &&
      process.env.SIRAH_PAYPAL_WEBHOOK_ID &&
      (plan === "ANNUAL" ||
        (process.env.SIRAH_PAYPAL_PRODUCT_ID &&
          process.env[`SIRAH_PAYPAL_MONTHLY_PLAN_${currency}`])),
    )
  );
}
