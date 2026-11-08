import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { methodAvailable, termsFor, paypalMonthlyPlanId } from "../lib/sirah/config";

const terms = {
  version: "TEST-ONLY",
  commitment: "Synthetic terms",
  cancellation: "Voluntary renewals",
  refund: "Synthetic refunds",
  access: "Verified payment only",
  tax: "Final prices include any applicable tax",
  cancellationTiming: "PERIOD_END",
  failedPaymentAccess: "PAUSE",
  refundAccess: "REVOKE",
  refundBilling: "CANCEL",
  approvedRoutes: ["STRIPE:GB:GBP", "PAYPAL:GB:GBP", "BANK_TRANSFER:PK:PKR", "JAZZCASH:PK:PKR"],
};
beforeEach(() => {
  for (const key of Object.keys(process.env))
    if (key.startsWith("SIRAH_") || key.startsWith("PAYPAL_")) delete process.env[key];
  Object.assign(process.env, {
    SIRAH_ANNUAL_TERMS_JSON: JSON.stringify(terms),
    SIRAH_MONTHLY_TERMS_JSON: JSON.stringify(terms),
    SIRAH_LIVE_PAYMENTS_APPROVED: "false",
    SIRAH_STRIPE_SANDBOX_VERIFIED: "false",
    SIRAH_STRIPE_SECRET_KEY: "sk_live_synthetic_only",
    SIRAH_STRIPE_ACCOUNT_ID: "acct_synthetic",
    SIRAH_STRIPE_WEBHOOK_SECRET: "whsec_synthetic",
    PAYPAL_ENV: "live",
    PAYPAL_CLIENT_ID: "synthetic",
    PAYPAL_CLIENT_SECRET: "synthetic",
    SIRAH_PAYPAL_MERCHANT_ID: "MERCHANT_SYNTHETIC",
    SIRAH_PAYPAL_WEBHOOK_ID: "WH_SYNTHETIC",
    SIRAH_PAYPAL_PRODUCT_ID: "PROD_SYNTHETIC",
    SIRAH_PAYPAL_MONTHLY_PLAN_GBP: "P-SYNTHETIC",
  });
});

test("explicit checkout authorisation does not fabricate verification evidence", () => {
  process.env.SIRAH_STRIPE_ANNUAL_CHECKOUT_ROUTES = "GB:GBP";
  assert.equal(methodAvailable("STRIPE", "GB", "GBP", "ANNUAL"), true);
  assert.equal(process.env.SIRAH_STRIPE_SANDBOX_VERIFIED, "false");
  assert.equal(process.env.SIRAH_STRIPE_ANNUAL_VERIFIED_ROUTES, undefined);
  assert.equal(methodAvailable("PAYPAL", "GB", "GBP", "ANNUAL"), false);
  assert.equal(methodAvailable("STRIPE", "GB", "GBP", "MONTHLY"), false);
  assert.equal(methodAvailable("STRIPE", "US", "GBP", "ANNUAL"), false);
  assert.equal(methodAvailable("STRIPE", "GB", "USD", "ANNUAL"), false);
});

test("each provider and plan is independently authorised", () => {
  process.env.SIRAH_PAYPAL_MONTHLY_CHECKOUT_ROUTES = "GB:GBP";
  assert.equal(methodAvailable("PAYPAL", "GB", "GBP", "MONTHLY"), true);
  assert.equal(methodAvailable("PAYPAL", "GB", "GBP", "ANNUAL"), false);
  assert.equal(methodAvailable("STRIPE", "GB", "GBP", "MONTHLY"), false);
  delete process.env.SIRAH_PAYPAL_MONTHLY_PLAN_GBP;
  assert.equal(methodAvailable("PAYPAL", "GB", "GBP", "MONTHLY"), false);
});

test("explicit route still requires approved terms for that exact method and country", () => {
  process.env.SIRAH_STRIPE_ANNUAL_CHECKOUT_ROUTES = "GB:GBP";
  for (const approvedRoutes of [[], ["PAYPAL:GB:GBP"], undefined]) {
    process.env.SIRAH_ANNUAL_TERMS_JSON = JSON.stringify({ ...terms, approvedRoutes });
    assert.equal(methodAvailable("STRIPE", "GB", "GBP", "ANNUAL"), false);
  }
  delete process.env.SIRAH_ANNUAL_TERMS_JSON;
  assert.equal(methodAvailable("STRIPE", "GB", "GBP", "ANNUAL"), false);
});

test("merchant bindings and webhook secrets cannot be replaced with old batch keys", () => {
  process.env.SIRAH_STRIPE_ANNUAL_CHECKOUT_ROUTES = "GB:GBP";
  process.env.STRIPE_SECRET_KEY = "sk_live_old_batch_synthetic";
  for (const key of ["SIRAH_STRIPE_SECRET_KEY", "SIRAH_STRIPE_ACCOUNT_ID", "SIRAH_STRIPE_WEBHOOK_SECRET"]) {
    const value = process.env[key];
    delete process.env[key];
    assert.equal(methodAvailable("STRIPE", "GB", "GBP", "ANNUAL"), false);
    process.env[key] = value;
  }
  process.env.SIRAH_PAYPAL_ANNUAL_CHECKOUT_ROUTES = "GB:GBP";
  delete process.env.SIRAH_PAYPAL_WEBHOOK_ID;
  assert.equal(methodAvailable("PAYPAL", "GB", "GBP", "ANNUAL"), false);
});

test("manual routes are independent and unchanged; PK recurring card needs its own evidence", () => {
  Object.assign(process.env, {
    SIRAH_BANK_TRANSFER_VERIFIED: "true",
    SIRAH_JAZZCASH_VERIFIED: "true",
    SIRAH_BANK_TRANSFER_ANNUAL_VERIFIED_ROUTES: "PK:PKR",
    SIRAH_JAZZCASH_ANNUAL_VERIFIED_ROUTES: "PK:PKR",
    SIRAH_STRIPE_MONTHLY_CHECKOUT_ROUTES: "PK:PKR",
    SIRAH_MONTHLY_TERMS_JSON: JSON.stringify({ ...terms, approvedRoutes: ["STRIPE:PK:PKR"] }),
  });
  assert.equal(methodAvailable("BANK_TRANSFER", "PK", "PKR", "ANNUAL"), true);
  assert.equal(methodAvailable("JAZZCASH", "PK", "PKR", "ANNUAL"), true);
  assert.equal(methodAvailable("STRIPE", "PK", "PKR", "MONTHLY"), false);
  assert.equal(methodAvailable("PAYPAL", "PK", "PKR", "ANNUAL"), false);
});

test("malformed route or unsupported PayPal currency cannot open checkout", () => {
  for (const route of ["*:*", "GB:*", "GB", "GB:GBP:EXTRA"]) {
    process.env.SIRAH_STRIPE_ANNUAL_CHECKOUT_ROUTES = route;
    assert.equal(methodAvailable("STRIPE", "GB", "GBP", "ANNUAL"), false);
  }
  process.env.SIRAH_PAYPAL_ANNUAL_CHECKOUT_ROUTES = "SA:SAR";
  process.env.SIRAH_ANNUAL_TERMS_JSON = JSON.stringify({ ...terms, approvedRoutes: ["PAYPAL:SA:SAR"] });
  assert.equal(methodAvailable("PAYPAL", "SA", "SAR", "ANNUAL"), false);
});


test("UK terms do not replace Pakistan terms; invalid regional overrides fail closed", () => {
  const manualBefore = termsFor("ANNUAL", "PK");
  process.env.SIRAH_GB_ANNUAL_TERMS_JSON = JSON.stringify({ ...terms, version: "UK-APPROVED", approvedRoutes: ["STRIPE:GB:GBP", "PAYPAL:GB:GBP"] });
  process.env.SIRAH_STRIPE_ANNUAL_CHECKOUT_ROUTES = "GB:GBP";
  assert.equal(termsFor("ANNUAL", "GB")?.version, "UK-APPROVED");
  assert.deepEqual(termsFor("ANNUAL", "PK"), manualBefore);
  assert.equal(methodAvailable("STRIPE", "GB", "GBP", "ANNUAL"), true);
  process.env.SIRAH_GB_ANNUAL_TERMS_JSON = "invalid";
  assert.equal(methodAvailable("STRIPE", "GB", "GBP", "ANNUAL"), false);
  assert.deepEqual(termsFor("ANNUAL", "PK"), manualBefore);
});


test("UK reconfirmed price produces the correct annual comparison and reuses the GBP plan", async () => {
  const { priceFor, annualSirahSavings } = await import("../lib/sirah/catalog");
  assert.equal(priceFor("GB", "MONTHLY", "STRIPE").amountMinor, 2999);
  assert.equal(priceFor("GB", "MONTHLY", "PAYPAL").amountMinor, 2999);
  assert.equal(priceFor("NZ", "MONTHLY", "PAYPAL").amountMinor, 2999);
  process.env.SIRAH_PAYPAL_MONTHLY_PLAN_GBP = "P-EXISTING-2999";
  process.env.SIRAH_PAYPAL_MONTHLY_PLAN_GB_GBP = "P-EXISTING-2999";
  assert.equal(paypalMonthlyPlanId("GB", "GBP"), "P-EXISTING-2999");
  assert.equal(paypalMonthlyPlanId("NZ", "GBP"), "P-EXISTING-2999");
  const savings = annualSirahSavings("GB");
  assert.equal(savings.standardMinor, 35988);
  assert.equal(savings.upfrontMinor, 32389);
  assert.equal(savings.savingMinor, 3599);
  assert.equal(savings.approximatePercent, 10);
  process.env.SIRAH_GB_ANNUAL_TERMS_JSON = JSON.stringify({ ...terms, approvedRoutes: [] });
  process.env.SIRAH_STRIPE_ANNUAL_CHECKOUT_ROUTES = "GB:GBP";
  assert.equal(methodAvailable("STRIPE", "GB", "GBP", "ANNUAL"), false);
});
