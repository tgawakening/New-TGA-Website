/**
 * Admin custom payment link: end-to-end service tests against an in-memory
 * Prisma stand-in and a synthetic Stripe client. No database or network is
 * touched: the fake client is installed on globalThis before any service loads
 * (lib/prisma reuses globalThis.prisma), and every Stripe call is the stub.
 */
import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { defaults, installFakePrisma, table, tables, type Row } from "./fixtures/fake-prisma";

// ---------------------------------------------------------------- environment
const terms = {
  version: "TEST-ONLY-ANNUAL",
  commitment: "Synthetic test terms",
  cancellation: "Synthetic",
  refund: "Synthetic",
  access: "Verified payment only",
  tax: "Inclusive",
  cancellationTiming: "IMMEDIATE",
  failedPaymentAccess: "KEEP",
  refundAccess: "REVOKE",
  refundBilling: "CANCEL",
  approvedRoutes: ["STRIPE:GB:GBP"],
};
for (const key of Object.keys(process.env))
  if (key.startsWith("SIRAH_") || key.startsWith("PAYPAL_") || key === "RESEND_API_KEY")
    delete process.env[key];
Object.assign(process.env, {
  SIRAH_ANNUAL_TERMS_JSON: JSON.stringify(terms),
  SIRAH_MONTHLY_TERMS_JSON: JSON.stringify(terms),
  SIRAH_STRIPE_SECRET_KEY: "sk_test_synthetic_only",
  SIRAH_STRIPE_ACCOUNT_ID: "acct_synthetic",
  NEXT_PUBLIC_APP_URL: "https://tga.example",
});

// ------------------------------------------------------------- fake prisma
installFakePrisma();


// ------------------------------------------------------------- fake stripe
type FakeSession = Row & { id: string; status: string; payment_status: string; amount_total: number; currency: string };
const sessions = new Map<string, FakeSession>();
const subscriptions = new Map<string, Row & { id: string }>();
const invoices = new Map<string, Row & { id: string }>();
const subscriptionUpdates: Row[] = [];
const createdParams: Row[] = [];
let sessionSeq = 0;
const stripe = {
  accounts: { retrieve: async () => ({ id: "acct_synthetic", charges_enabled: true }) },
  checkout: {
    sessions: {
      create: async (params: Row) => {
        createdParams.push(params);
        const line = (params.line_items as Row[])[0];
        const price = line.price_data as Row;
        const id = `cs_test_custom_${++sessionSeq}`;
        const session: FakeSession = {
          id,
          object: "checkout.session",
          url: `https://checkout.stripe.com/c/pay/${id}`,
          status: "open",
          payment_status: "unpaid",
          mode: params.mode,
          metadata: params.metadata,
          client_reference_id: params.client_reference_id,
          currency: price.currency as string,
          amount_total: (price.unit_amount as number) * (line.quantity as number),
          expires_at: params.expires_at,
          payment_intent: null,
          subscription: null,
          invoice: null,
          subscription_data: params.subscription_data,
        };
        sessions.set(id, session);
        return { ...session };
      },
      retrieve: async (id: string) => ({ ...sessions.get(id)! }),
      expire: async (id: string) => {
        const s = sessions.get(id)!;
        s.status = "expired";
        return { ...s };
      },
    },
  },
  subscriptions: {
    retrieve: async (id: string) => ({ ...subscriptions.get(id)! }),
    update: async (id: string, params: Row) => {
      subscriptionUpdates.push({ id, ...params });
      return { ...subscriptions.get(id)! };
    },
  },
  invoices: {
    retrieve: async (id: string) => ({ ...invoices.get(id)! }),
  },
} as unknown as Stripe;
const pay = (id: string, overrides: Partial<FakeSession> = {}) =>
  Object.assign(sessions.get(id)!, { status: "complete", payment_status: "paid", payment_intent: `pi_${id}` }, overrides);
const expire = (id: string) => Object.assign(sessions.get(id)!, { status: "expired" });
/** Complete a subscription-mode session: Stripe creates the subscription
 * (metadata from subscription_data) and its first paid invoice. */
const START = Math.floor(Date.UTC(2026, 10, 15) / 1000);
const invoiceFor = (subId: string, amount: number, currency: string, n: number, status = "paid") => {
  const id = `in_${subId}_${n}`;
  invoices.set(id, { id, status, amount_paid: status === "paid" ? amount : 0, currency, parent: { subscription_details: { subscription: subId } } });
  return id;
};
const paySubscription = (id: string, invoiceAmount?: number) => {
  const session = sessions.get(id)!;
  const subId = `sub_${id}`;
  subscriptions.set(subId, {
    id: subId,
    status: "active",
    customer: `cus_${id}`,
    start_date: START,
    metadata: (session.subscription_data as Row).metadata,
    items: { data: [{ current_period_end: START + 31 * 86400 }] },
  });
  const invoice = invoiceFor(subId, invoiceAmount ?? session.amount_total, session.currency, 1);
  return Object.assign(session, { status: "complete", payment_status: "paid", subscription: subId, invoice });
};

// --------------------------------------------------------- services (late)
// Loaded only after globalThis.prisma is the fake (CJS: no top-level await).
let createSirahAdminCustomLink: typeof import("../services/sirah-admin-custom-link.service").createSirahAdminCustomLink;
let handleSirahStripeEvent: typeof import("../services/sirah-webhooks.service").handleSirahStripeEvent;
let verifySirahStripeSession: typeof import("../services/sirah-online.service").verifySirahStripeSession;
let resetUnsettledSirahCheckout: typeof import("../services/sirah-online.service").resetUnsettledSirahCheckout;
let startSirahCheckout: typeof import("../services/sirah-online.service").startSirahCheckout;
let repriceSirah: typeof import("../services/sirah-registration.service").repriceSirah;
let listSirahAdmin: typeof import("../services/sirah-admin.service").listSirahAdmin;
let sirahCsv: typeof import("../services/sirah-admin.service").sirahCsv;
let custom: typeof import("../lib/sirah/admin-custom");
let GB_ANNUAL_CATALOG = 0; // catalog annual GB price (32389)
let GB_MONTHLY_CATALOG = 0; // catalog monthly GB card price
before(async () => {
  ({ createSirahAdminCustomLink } = await import("../services/sirah-admin-custom-link.service"));
  ({ handleSirahStripeEvent } = await import("../services/sirah-webhooks.service"));
  ({ verifySirahStripeSession, resetUnsettledSirahCheckout, startSirahCheckout } = await import("../services/sirah-online.service"));
  ({ repriceSirah } = await import("../services/sirah-registration.service"));
  ({ listSirahAdmin, sirahCsv } = await import("../services/sirah-admin.service"));
  custom = await import("../lib/sirah/admin-custom");
  GB_ANNUAL_CATALOG = (await import("../lib/sirah/catalog")).priceFor("GB", "ANNUAL", "STRIPE").amountMinor;
  GB_MONTHLY_CATALOG = (await import("../lib/sirah/catalog")).priceFor("GB", "MONTHLY", "STRIPE").amountMinor;
});
const ADMIN = "admin:owner@tga.example";
const input = (overrides: Row = {}) =>
  custom.sirahAdminCustomLinkSchema.parse({
    fullName: "Sponsored Student",
    email: "Sponsored.Student@Example.com",
    plan: "ANNUAL",
    countryCode: "GB",
    amount: "150",
    sponsorLabel: "Masjid group booking",
    note: "Paid by the masjid committee",
    ...overrides,
  });
const order = () => table("sirahOrder")[0] as Row & { id: string; userId: string; revision: number; amountMinor: number };
const event = (type: string, object: unknown) => ({ id: `evt_${randomUUID()}`, type, data: { object } }) as unknown as Stripe.Event;

beforeEach(() => {
  tables.clear();
  sessions.clear();
  subscriptions.clear();
  invoices.clear();
  subscriptionUpdates.length = 0;
  createdParams.length = 0;
});

// ------------------------------------------------------------------- tests
test("creates a locked custom-amount order and a one-time Sirah Stripe session", async () => {
  const result = await createSirahAdminCustomLink(input(), ADMIN, stripe);
  const o = order();
  assert.equal(table("sirahOrder").length, 1);
  assert.equal(o.amountMinor, 15000);
  assert.equal(o.totalMinor, 15000);
  assert.equal(o.currency, "GBP");
  assert.equal(o.plan, "ANNUAL");
  assert.equal(o.method, "STRIPE");
  assert.equal(o.paymentState, "PROCESSING");
  assert.equal(o.pricingVersion, custom.ADMIN_CUSTOM_PRICING_VERSION);
  assert.equal(o.providerOrderId, "cs_test_custom_1");
  assert.equal(result.url, "https://checkout.stripe.com/c/pay/cs_test_custom_1");
  const snapshot = o.discount as Row;
  assert.equal(snapshot.kind, "ADMIN_CUSTOM_LINK");
  assert.equal(snapshot.catalogAmountMinor, GB_ANNUAL_CATALOG);
  assert.equal(snapshot.amountMinor, 15000);
  assert.equal(snapshot.sponsorLabel, "Masjid group booking");
  assert.equal(snapshot.createdBy, ADMIN);
  // Stripe session: one-time, exact amount, ownership metadata, Sirah account.
  const params = createdParams[0];
  assert.equal(params.mode, "payment");
  assert.equal(params.client_reference_id, o.id);
  assert.equal(params.customer_email, "sponsored.student@example.com");
  const line = (params.line_items as Row[])[0].price_data as Row;
  assert.equal(line.unit_amount, 15000);
  assert.equal(line.currency, "gbp");
  assert.equal("recurring" in line, false);
  assert.deepEqual(params.metadata, {
    sirahOrderId: o.id,
    checkoutToken: o.checkoutToken,
    sirahSource: "admin-custom-link",
    studentEmail: "sponsored.student@example.com",
  });
  assert.ok((params.expires_at as number) - Date.now() / 1000 <= 24 * 3600);
  // Audit: which admin created and issued the link.
  const audits = table("sirahAudit").filter((a) => a.orderId === o.id);
  const createdAudit = audits.find((a) => a.action === "ADMIN_CUSTOM_LINK_CREATED")!;
  assert.equal(createdAudit.actor, ADMIN);
  assert.equal((createdAudit.detail as Row).createdBy, ADMIN);
  assert.equal((createdAudit.detail as Row).catalogAmountMinor, GB_ANNUAL_CATALOG);
  assert.ok(audits.some((a) => a.action === "ADMIN_CUSTOM_LINK_ISSUED" && a.actor === ADMIN));
  // New account with a temporary password (email logged as SKIPPED: no Resend key in tests).
  const user = table("user")[0];
  assert.equal(user.email, "sponsored.student@example.com");
  assert.match(String(user.passwordHash), /^\$2[aby]\$/);
  assert.equal(result.newAccount, true);
  assert.equal(result.accountEmail, "SKIPPED");
  const log = table("emailLog").find((l) => l.emailType === "SIRAH_ADMIN_ACCOUNT_CREATED")!;
  assert.match(JSON.stringify(log.payload), /Temporary password: TGA-[a-z0-9]{8}#2026/);
});

test("paying the link enrols through the unchanged webhook at the custom amount", async () => {
  await createSirahAdminCustomLink(input(), ADMIN, stripe);
  const o = order();
  const paid = pay(String(o.providerOrderId));
  assert.equal(await handleSirahStripeEvent(event("checkout.session.completed", { ...paid }), stripe), true);
  const after = order();
  assert.equal(after.paymentState, "PAID");
  assert.equal(after.enrolmentState, "ACTIVE");
  assert.equal(after.paidMinor, 15000);
  assert.equal(after.paidCount, 1);
  const payment = table("sirahPaymentEvent")[0];
  assert.equal(payment.amountMinor, 15000);
  assert.equal(payment.provider, "STRIPE");
  assert.equal(payment.kind, "FIRST");
  const registration = table("registration")[0];
  assert.equal(registration.finalAmount, 15000);
  assert.equal(registration.baseAmount, GB_ANNUAL_CATALOG);
  assert.equal(registration.couponDiscountAmount, GB_ANNUAL_CATALOG - 15000);
  assert.equal(table("payment")[0].amount, 15000);
  assert.equal(table("enrollment")[0].status, "ACTIVE");
  assert.ok(table("sirahAudit").some((a) => a.action === "PAYMENT_VERIFIED" && a.actor === "provider:stripe"));
});

test("amount verification is not loosened: a session for a different amount is rejected", async () => {
  await createSirahAdminCustomLink(input(), ADMIN, stripe);
  const o = order();
  pay(String(o.providerOrderId), { amount_total: GB_ANNUAL_CATALOG });
  await assert.rejects(
    verifySirahStripeSession(o.id, String(o.providerOrderId), stripe),
    /Stripe amount or currency mismatch/,
  );
  assert.equal(order().paymentState, "PROCESSING");
  assert.equal(table("sirahPaymentEvent").length, 0);
});

test("GUARD 1: an expired custom link keeps the custom amount and method (no catalog reprice)", async () => {
  await createSirahAdminCustomLink(input(), ADMIN, stripe);
  const o = order();
  const expired = expire(String(o.providerOrderId));
  await handleSirahStripeEvent(event("checkout.session.expired", { ...expired }), stripe);
  const after = order();
  assert.equal(after.paymentState, "UNPAID");
  assert.equal(after.amountMinor, 15000, "custom amount kept");
  assert.equal(after.totalMinor, 15000);
  assert.equal(after.method, "STRIPE", "method kept");
  assert.equal(after.pricingVersion, custom.ADMIN_CUSTOM_PRICING_VERSION);
  assert.equal((after.discount as Row).kind, "ADMIN_CUSTOM_LINK");
  assert.ok(after.terms, "terms snapshot kept");
  assert.equal(after.providerOrderId, null);
  assert.equal(after.checkoutToken, null);
  const audit = table("sirahAudit").find((a) => a.action === "UNSETTLED_CHECKOUT_EXPIRED")!;
  assert.equal((audit.detail as Row).amountMinorKept, 15000);
});

test("GUARD 1 baseline: a self-registered expired checkout still returns to the catalog quote", async () => {
  table("user").push({ id: "u-self", email: "self@example.com", status: "ACTIVE", fullName: "Self", phoneCountryCode: "", phoneNumber: "", passwordHash: "x" });
  table("course").push({ id: "c1", slug: "seerah-course" });
  table("sirahOrder").push({
    ...defaults.sirahOrder, id: "o-self", userId: "u-self", courseId: "c1", batchCode: "b", reference: "SIRAH-SELF",
    countryCode: "GB", countryName: "United Kingdom", plan: "ANNUAL", method: "STRIPE", currency: "GBP",
    amountMinor: 20000, totalMinor: 20000, pricingVersion: "stale", paymentState: "PROCESSING",
    checkoutToken: "tok-self", providerOrderId: "cs_self", revision: 3, createdAt: new Date(), updatedAt: new Date(),
  });
  sessions.set("cs_self", { id: "cs_self", status: "expired", payment_status: "unpaid", amount_total: 20000, currency: "gbp", metadata: { sirahOrderId: "o-self", checkoutToken: "tok-self" }, subscription: null });
  await resetUnsettledSirahCheckout("o-self", "u-self", { stripe });
  const after = table("sirahOrder")[0];
  assert.equal(after.amountMinor, GB_ANNUAL_CATALOG);
  assert.equal(after.method, null);
});

test("GUARD 1: maintenance/student resets never close an open admin link early", async () => {
  await createSirahAdminCustomLink(input(), ADMIN, stripe);
  const o = order();
  await assert.rejects(
    resetUnsettledSirahCheckout(o.id, o.userId, { stripe }),
    /issued by the TGA team and is still open/,
  );
  assert.equal(sessions.get(String(o.providerOrderId))!.status, "open");
  assert.equal(order().paymentState, "PROCESSING");
  assert.equal(order().amountMinor, 15000);
});

test("GUARD 2: a student cannot change method, plan or price on a custom order", async () => {
  await createSirahAdminCustomLink(input(), ADMIN, stripe);
  const o = order();
  expire(String(o.providerOrderId));
  await handleSirahStripeEvent(event("checkout.session.expired", { ...sessions.get(String(o.providerOrderId)) }), stripe);
  const unpaid = order();
  for (const [country, plan, method] of [
    ["GB", "ANNUAL", "STRIPE"],
    ["GB", "ANNUAL", "PAYPAL"],
    ["GB", "MONTHLY", "STRIPE"],
    ["PK", "MONTHLY", "BANK_TRANSFER"],
  ] as const)
    await assert.rejects(
      repriceSirah(unpaid.id, unpaid.userId, unpaid.revision, country, plan, method),
      (error: Error) => error.message === custom.ADMIN_CUSTOM_LOCKED_MESSAGE,
    );
  await assert.rejects(
    startSirahCheckout(unpaid.id, unpaid.userId, unpaid.revision, terms.version, stripe),
    (error: Error) => error.message === custom.ADMIN_CUSTOM_LOCKED_MESSAGE,
  );
  const after = order();
  assert.equal(after.amountMinor, 15000);
  assert.equal(after.method, "STRIPE");
  assert.equal(after.revision, unpaid.revision);
  assert.ok(!table("sirahAudit").some((a) => a.action === "REPRICED"));
});

test("regenerating closes the previous open link and reuses the same registration", async () => {
  await createSirahAdminCustomLink(input(), ADMIN, stripe);
  const first = order().providerOrderId as string;
  const again = await createSirahAdminCustomLink(input({ amount: "175.50" }), "reviewer:helper@tga.example", stripe);
  assert.equal(table("sirahOrder").length, 1);
  assert.equal(table("user").length, 1);
  assert.equal(sessions.get(first)!.status, "expired");
  const after = order();
  assert.notEqual(after.providerOrderId, first);
  assert.equal(sessions.get(after.providerOrderId as string)!.status, "open");
  assert.equal(sessions.get(after.providerOrderId as string)!.amount_total, 17550);
  assert.equal(after.amountMinor, 17550);
  assert.equal((after.discount as Row).createdBy, "reviewer:helper@tga.example");
  assert.equal(again.newAccount, false);
  assert.equal(again.accountEmail, "NOT_NEEDED");
});

test("refuses a student who already paid, and keeps their record unchanged", async () => {
  await createSirahAdminCustomLink(input(), ADMIN, stripe);
  await handleSirahStripeEvent(event("checkout.session.completed", { ...pay(String(order().providerOrderId)) }), stripe);
  const before = { ...order() };
  await assert.rejects(createSirahAdminCustomLink(input({ amount: "10" }), ADMIN, stripe), /already has a paid, active/);
  assert.equal(order().amountMinor, before.amountMinor);
  assert.equal(order().paymentState, "PAID");
});

test("admin list and CSV show catalog vs custom price, sponsor and creating admin", async () => {
  await createSirahAdminCustomLink(input(), ADMIN, stripe);
  const data = await listSirahAdmin(new URLSearchParams({ method: "CUSTOM_LINK" }));
  assert.equal(data.rows.length, 1);
  assert.deepEqual(
    { ...data.rows[0].customLink, createdAt: undefined },
    { catalogAmountMinor: GB_ANNUAL_CATALOG, catalogCurrency: "GBP", amountMinor: 15000, sponsorLabel: "Masjid group booking", createdBy: ADMIN, createdAt: undefined },
  );
  const csv = sirahCsv(data).split("\r\n");
  assert.match(csv[0], /"?Source"?,"?Catalog price"?,"?Custom price"?,"?Sponsor"?,"?Link created by"?,"?Added to group"?,"?Group added at"?,"?Group added by"?$/);
  assert.match(csv[1], /"Admin custom link","GBP\s?323\.89","GBP\s?150\.00","Masjid group booking","admin:owner@tga\.example","No","",""$/);
});

test("validation: annual or monthly only, positive amount, Sirah price-list currency", async () => {
  assert.equal(custom.sirahAdminCustomLinkSchema.safeParse({ ...input(), plan: "MONTHLY" }).success, true);
  assert.equal(custom.sirahAdminCustomLinkSchema.safeParse({ ...input(), plan: "WEEKLY" }).success, false);
  await assert.rejects(createSirahAdminCustomLink(input({ amount: "0" }), ADMIN, stripe), /above zero/);
  await assert.rejects(createSirahAdminCustomLink(input({ currency: "JPY" }), ADMIN, stripe), /price list/);
  delete process.env.SIRAH_STRIPE_SECRET_KEY;
  try {
    await assert.rejects(createSirahAdminCustomLink(input(), ADMIN), /Stripe is not configured/);
  } finally {
    process.env.SIRAH_STRIPE_SECRET_KEY = "sk_test_synthetic_only";
  }
  assert.equal(table("sirahOrder").length, 0);
});

// ---------------------------------------------------------- monthly links
test("MONTHLY: creates a locked monthly order and a Stripe subscription session like the student checkout", async () => {
  const result = await createSirahAdminCustomLink(input({ plan: "MONTHLY", amount: "15" }), ADMIN, stripe);
  assert.equal(result.plan, "MONTHLY");
  const o = order();
  assert.equal(o.plan, "MONTHLY");
  assert.equal(o.method, "STRIPE");
  assert.equal(o.amountMinor, 1500);
  assert.equal(o.totalMinor, 1500 * 12);
  assert.equal(o.paymentState, "PROCESSING");
  assert.equal(o.pricingVersion, custom.ADMIN_CUSTOM_PRICING_VERSION);
  const snapshot = custom.adminCustomSnapshot(o as { discount?: unknown })!;
  assert.equal(snapshot.amountMinor, 1500);
  assert.equal(snapshot.catalogAmountMinor, GB_MONTHLY_CATALOG);
  const params = createdParams[0] as Row & { line_items: Row[]; subscription_data: Row; metadata: Row };
  assert.equal(params.mode, "subscription");
  assert.equal(params.payment_intent_data, undefined);
  const price = params.line_items[0].price_data as Row;
  assert.equal(price.unit_amount, 1500);
  assert.equal(price.currency, "gbp");
  assert.deepEqual(price.recurring, { interval: "month" });
  // Ownership metadata on the subscription, as the student's monthly checkout sets.
  const subMeta = params.subscription_data.metadata as Row;
  assert.equal(subMeta.sirahOrderId, o.id);
  assert.equal(subMeta.checkoutToken, o.checkoutToken);
  assert.equal(params.metadata.sirahOrderId, o.id);
  assert.equal(params.client_reference_id, o.id);
  assert.match(String(params.success_url), /\/seerah\?payment=received&reference=SIRAH-/);
  assert.ok(Number(params.expires_at) > 0);
});

test("MONTHLY: paying enrols through the unchanged webhook as a monthly subscription at the custom amount", async () => {
  await createSirahAdminCustomLink(input({ plan: "MONTHLY", amount: "15" }), ADMIN, stripe);
  const o = order();
  const paid = paySubscription(String(o.providerOrderId));
  assert.equal(await handleSirahStripeEvent(event("checkout.session.completed", { ...paid }), stripe), true);
  const after = order();
  assert.equal(after.paymentState, "PAID");
  assert.equal(after.enrolmentState, "ACTIVE");
  assert.equal(after.paidCount, 1);
  assert.equal(after.paidMinor, 1500);
  assert.equal(after.providerSubscriptionId, `sub_${o.providerOrderId}`);
  assert.ok(after.nextBillingAt, "next monthly billing date set");
  // Capped at the programme end, exactly like a self-registered monthly student.
  assert.equal(subscriptionUpdates.length, 1);
  assert.equal(subscriptionUpdates[0].proration_behavior, "none");
  assert.ok(Number(subscriptionUpdates[0].cancel_at) > START);
  const payment = table("sirahPaymentEvent")[0];
  assert.equal(payment.id, `stripe:invoice:${paid.invoice}`);
  assert.equal(payment.amountMinor, 1500);
  assert.equal(payment.kind, "FIRST");
  assert.equal(table("registration")[0].finalAmount, 1500);
  assert.equal(table("registration")[0].baseAmount, GB_MONTHLY_CATALOG);
  assert.equal(table("enrollment")[0].status, "ACTIVE");
});

test("MONTHLY: a renewal invoice at the locked amount records the next month", async () => {
  await createSirahAdminCustomLink(input({ plan: "MONTHLY", amount: "15" }), ADMIN, stripe);
  const o = order();
  const paid = paySubscription(String(o.providerOrderId));
  await handleSirahStripeEvent(event("checkout.session.completed", { ...paid }), stripe);
  const renewal = invoiceFor(String(paid.subscription), 1500, "gbp", 2);
  assert.equal(await handleSirahStripeEvent(event("invoice.paid", { ...invoices.get(renewal) }), stripe), true);
  const after = order();
  assert.equal(after.paidCount, 2);
  assert.equal(after.paidMinor, 3000);
  const events = table("sirahPaymentEvent");
  assert.equal(events.length, 2);
  assert.equal(events[1].kind, "RENEWAL");
  assert.equal(events[1].amountMinor, 1500);
});

test("MONTHLY: amount checks are not loosened - a first invoice for another amount is refused", async () => {
  await createSirahAdminCustomLink(input({ plan: "MONTHLY", amount: "15" }), ADMIN, stripe);
  const o = order();
  const paid = paySubscription(String(o.providerOrderId), GB_MONTHLY_CATALOG);
  await assert.rejects(
    handleSirahStripeEvent(event("checkout.session.completed", { ...paid }), stripe),
    /locked amount/,
  );
  assert.equal(order().paymentState, "PROCESSING");
  assert.equal(order().enrolmentState, "PENDING");
  assert.equal(table("sirahPaymentEvent").length, 0);
});

test("MONTHLY: a student cannot reprice or switch the custom monthly order", async () => {
  await createSirahAdminCustomLink(input({ plan: "MONTHLY", amount: "15" }), ADMIN, stripe);
  const o = order();
  await assert.rejects(
    repriceSirah(o.id, o.userId, o.revision, "GB", "ANNUAL", "STRIPE"),
    /price agreed with the TGA team/,
  );
  assert.equal(order().amountMinor, 1500);
  assert.equal(order().plan, "MONTHLY");
});

test("ANNUAL is unchanged: still a one-time payment session", async () => {
  await createSirahAdminCustomLink(input(), ADMIN, stripe);
  const params = createdParams[0] as Row & { line_items: Row[] };
  assert.equal(params.mode, "payment");
  assert.equal(params.subscription_data, undefined);
  assert.equal((params.line_items[0].price_data as Row).recurring, undefined);
  assert.equal(order().totalMinor, order().amountMinor);
});
