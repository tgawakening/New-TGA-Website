import test from "node:test";
import assert from "node:assert/strict";
import { resolveResidence, validResidence } from "../lib/sirah/residence";
import { catalogue, priceFor, currencyScale } from "../lib/sirah/catalog";
import { defaultPriceMethod } from "../lib/sirah/payment-display";

test("residence priority: current, saved, detected, Pakistan; invalid hints ignored", () => {
  assert.equal(resolveResidence("US", "GB", "PK"), "US");
  assert.equal(resolveResidence(null, "GB", "PK"), "GB");
  assert.equal(resolveResidence(null, null, "GB"), "GB");
  assert.equal(resolveResidence(null, null, "PK"), "PK");
  assert.equal(resolveResidence(null, null, "XX"), "PK");
  assert.equal(resolveResidence(), "PK");
  assert.equal(validResidence("EURO"), false);
  assert.equal(validResidence("FR"), true);
});
test("every annual comparison uses 12 online monthly payments and annual charges once", () => {
  for (const [country, , currency, online, , annual] of catalogue) {
    const multiplier = 10 ** currencyScale(currency);
    const monthly = priceFor(country, "MONTHLY", "STRIPE");
    const upfront = priceFor(country, "ANNUAL", null);
    assert.equal(
      monthly.amountMinor * 12,
      Math.round(Number(online) * multiplier) * 12,
    );
    assert.equal(upfront.amountMinor, Math.round(Number(annual) * multiplier));
    assert.equal(upfront.totalMinor, upfront.amountMinor);
  }
  assert.equal(priceFor("GB", "MONTHLY", null).amountMinor * 12, 35988);
  assert.equal(priceFor("PK", "MONTHLY", "STRIPE").totalMinor, 3600000);
  assert.equal(priceFor("PK", "MONTHLY", "BANK_TRANSFER").totalMinor, 4200000);
  assert.equal(priceFor("BH", "ANNUAL", null).amountMinor, 91800);
  assert.equal(priceFor("KW", "ANNUAL", null).amountMinor, 75600);
  assert.equal(priceFor("AL", "ANNUAL", null).currency, "GBP");
});
test("unverified Pakistan recurring never becomes the initial payable route", () => {
  const previous = process.env.SIRAH_PK_RECURRING_VERIFIED;
  process.env.SIRAH_PK_RECURRING_VERIFIED = "false";
  try {
    assert.equal(defaultPriceMethod("PK", "MONTHLY"), "BANK_TRANSFER");
  } finally {
    if (previous === undefined) delete process.env.SIRAH_PK_RECURRING_VERIFIED;
    else process.env.SIRAH_PK_RECURRING_VERIFIED = previous;
  }
});

test("only configured trusted country headers suggest residence; missing lookup falls back safely", async () => {
  const { countryFromTrustedHeaders } =
    await import("../lib/sirah/geolocation");
  const h = new Headers({
    "cf-ipcountry": "GB",
    "x-vercel-ip-country": "US",
    "do-connecting-ip": "203.0.113.5",
  });
  assert.equal(await countryFromTrustedHeaders(h), undefined);
  assert.equal(await countryFromTrustedHeaders(h, "CLOUDFLARE"), "GB");
  assert.equal(
    await countryFromTrustedHeaders(
      new Headers({ "cf-ipcountry": "PK" }),
      "CLOUDFLARE",
    ),
    "PK",
  );
  assert.equal(await countryFromTrustedHeaders(h, "VERCEL"), "US");
  assert.equal(await countryFromTrustedHeaders(h, "APP_PLATFORM"), undefined);
  assert.equal(
    await countryFromTrustedHeaders(
      h,
      "APP_PLATFORM",
      "/nonexistent/GeoLite2-Country.mmdb",
    ),
    undefined,
  );
  assert.equal(
    await countryFromTrustedHeaders(
      new Headers({ "do-connecting-ip": "1.2.3.4, 5.6.7.8" }),
      "APP_PLATFORM",
      "/nonexistent.mmdb",
    ),
    undefined,
  );
  assert.equal(
    await countryFromTrustedHeaders(
      new Headers({ "cf-ipcountry": "XX" }),
      "CLOUDFLARE",
    ),
    undefined,
  );
});

test("synthetically verified card readiness selects 3000; manual remains 3500 independently", () => {
  const keys = [
    "SIRAH_PK_RECURRING_VERIFIED",
    "SIRAH_STRIPE_SECRET_KEY",
    "SIRAH_STRIPE_WEBHOOK_SECRET",
    "SIRAH_STRIPE_ACCOUNT_ID",
    "SIRAH_STRIPE_MONTHLY_CURRENCIES",
    "SIRAH_MONTHLY_TERMS_JSON",
    "SIRAH_MANUAL_ACCOUNTS_VERIFIED",
  ];
  const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    SIRAH_PK_RECURRING_VERIFIED: "true",
    SIRAH_STRIPE_SECRET_KEY: "sk_test_synthetic_only",
    SIRAH_STRIPE_WEBHOOK_SECRET: "whsec_synthetic_only",
    SIRAH_STRIPE_ACCOUNT_ID: "acct_synthetic_only",
    SIRAH_STRIPE_MONTHLY_CURRENCIES: "PKR",
    SIRAH_MANUAL_ACCOUNTS_VERIFIED: "true",
    SIRAH_MONTHLY_TERMS_JSON: JSON.stringify({
      version: "TEST-ONLY",
      commitment: "Synthetic only",
      cancellation: "Synthetic only",
      refund: "Synthetic only",
      access: "Synthetic only",
      tax: "Synthetic only",
      cancellationTiming: "IMMEDIATE",
      failedPaymentAccess: "KEEP",
      refundAccess: "REVOKE",
      refundBilling: "CANCEL",
    }),
  });
  try {
    assert.equal(defaultPriceMethod("PK", "MONTHLY"), "STRIPE");
    assert.equal(
      priceFor("PK", "MONTHLY", defaultPriceMethod("PK", "MONTHLY"))
        .amountMinor,
      300000,
    );
    assert.equal(
      priceFor("PK", "MONTHLY", "BANK_TRANSFER").amountMinor,
      350000,
    );
    process.env.SIRAH_PK_RECURRING_VERIFIED = "false";
    assert.equal(defaultPriceMethod("PK", "MONTHLY"), "BANK_TRANSFER");
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("App Platform lookup resolves countries and missing CF hints fall through to its trusted IP", async () => {
  const { countryFromTrustedHeaders } =
    await import("../lib/sirah/geolocation");
  const path = `${process.cwd()}/scripts/fixtures/geoip/GeoIP2-Country-Test.mmdb`;
  assert.equal(
    await countryFromTrustedHeaders(
      new Headers({ "do-connecting-ip": "81.2.69.160" }),
      "APP_PLATFORM",
      path,
    ),
    "GB",
  );
  assert.equal(
    await countryFromTrustedHeaders(
      new Headers({ "do-connecting-ip": "216.160.83.56" }),
      "APP_PLATFORM",
      path,
    ),
    "US",
  );
  assert.equal(
    await countryFromTrustedHeaders(
      new Headers({ "do-connecting-ip": "81.2.69.160" }),
      "CLOUDFLARE",
      path,
    ),
    "GB",
  );
  assert.equal(
    await countryFromTrustedHeaders(
      new Headers({
        "cf-ipcountry": "XX",
        "do-connecting-ip": "216.160.83.56",
      }),
      "CLOUDFLARE",
      path,
    ),
    "US",
  );
  assert.equal(
    await countryFromTrustedHeaders(
      new Headers({ "cf-ipcountry": "PK", "do-connecting-ip": "81.2.69.160" }),
      "CLOUDFLARE",
      path,
    ),
    "PK",
  );
  assert.equal(
    await countryFromTrustedHeaders(
      new Headers({ "do-connecting-ip": "192.0.2.1" }),
      "APP_PLATFORM",
      path,
    ),
    undefined,
  );
});
