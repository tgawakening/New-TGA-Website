/**
 * Admin custom payment link: end-to-end service tests against an in-memory
 * Prisma stand-in and a synthetic Stripe client. No database or network is
 * touched: the fake client is installed on globalThis before any service loads
 * (lib/prisma reuses globalThis.prisma), and every Stripe call is the stub.
 */
import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";

// ---------------------------------------------------------------- environment
process.env.DATABASE_URL = "mysql://fake-in-memory.invalid:1/never";
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
type Row = Record<string, unknown>;
const tables = new Map<string, Row[]>();
const table = (name: string) => {
  if (!tables.has(name)) tables.set(name, []);
  return tables.get(name)!;
};
const relationTable: Record<string, string> = {
  course: "course",
  user: "user",
  order: "sirahOrder",
  registration: "registration",
};
const OPS = ["in", "not", "lt", "lte", "gt", "gte", "contains", "equals"];
function matchValue(actual: unknown, expected: unknown): boolean {
  if (expected === null) return actual === null || actual === undefined;
  if (expected instanceof Date) return actual instanceof Date && actual.getTime() === expected.getTime();
  if (typeof expected === "object" && Object.keys(expected as object).some((k) => OPS.includes(k))) {
    const e = expected as Record<string, unknown>;
    if ("equals" in e && !matchValue(actual, e.equals)) return false;
    if ("in" in e && !(e.in as unknown[]).includes(actual)) return false;
    if ("not" in e && matchValue(actual, e.not)) return false;
    if ("contains" in e && !String(actual ?? "").includes(String(e.contains))) return false;
    const n = (v: unknown) => (v instanceof Date ? v.getTime() : (v as number));
    if ("lt" in e && !(n(actual) < n(e.lt))) return false;
    if ("lte" in e && !(n(actual) <= n(e.lte))) return false;
    if ("gt" in e && !(n(actual) > n(e.gt))) return false;
    if ("gte" in e && !(n(actual) >= n(e.gte))) return false;
    return true;
  }
  return actual === expected;
}
function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected === undefined) return true;
    if (key === "OR") return (expected as Row[]).some((w) => matches(row, w));
    if (key === "AND") return (expected as Row[]).every((w) => matches(row, w));
    if (key === "NOT") return !matches(row, expected as Row);
    if (relationTable[key] && !(key in row) && `${key}Id` in row) {
      const related = table(relationTable[key]).find((r) => r.id === row[`${key}Id`]);
      return !!related && matches(related, expected as Row);
    }
    if (!(key in row) && expected && typeof expected === "object" && !(expected instanceof Date))
      return matches(row, expected as Row); // compound unique, e.g. userId_courseId_batchCode
    return matchValue(row[key], expected);
  });
}
function applyData(row: Row, data: Row) {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value === Prisma.DbNull || value === Prisma.JsonNull) row[key] = null;
    else if (value && typeof value === "object" && "increment" in (value as Row))
      row[key] = ((row[key] as number) || 0) + ((value as Row).increment as number);
    else if (value && typeof value === "object" && "create" in (value as Row)) continue;
    else row[key] = value;
  }
  row.updatedAt = new Date();
}
const defaults: Record<string, Row> = {
  sirahOrder: { paymentState: "UNPAID", enrolmentState: "PENDING", revision: 0, paidMinor: 0, paidCount: 0, refundedMinor: 0, invitationState: "PENDING", method: null, discount: null, terms: null, providerOrderId: null, providerSubscriptionId: null, providerPlanId: null, providerCustomerId: null, checkoutToken: null, cancelledAt: null, accessEndsAt: null, programmeStart: null, programmeEnd: null, nextBillingAt: null, registrationId: null },
  user: { status: "ACTIVE", role: "STUDENT" },
};
function attach(name: string, row: Row, shape?: Row) {
  if (!shape) return { ...row };
  const out: Row = { ...row };
  for (const [key, spec] of Object.entries(shape)) {
    if (!spec) continue;
    if (relationTable[key] && `${key}Id` in row) {
      const related = table(relationTable[key]).find((r) => r.id === row[`${key}Id`]);
      out[key] = related ? { ...related } : null;
    } else if (!(key in row)) {
      const child = key === "audits" ? "sirahAudit" : key === "events" ? "sirahPaymentEvent" : key === "notifications" ? "sirahNotification" : key === "receipts" ? "sirahReceipt" : "";
      out[key] = child ? table(child).filter((r) => r.orderId === row.id).map((r) => ({ ...r })) : [];
    }
  }
  void name;
  return out;
}
function delegate(name: string) {
  const rows = () => table(name);
  const first = (args: Row = {}) => rows().find((r) => matches(r, args.where as Row));
  const api = {
    findUnique: async (args: Row) => { const r = first(args); return r ? attach(name, r, (args.include || args.select) as Row) : null; },
    findFirst: async (args: Row = {}) => { const r = first(args); return r ? attach(name, r, (args.include || args.select) as Row) : null; },
    findUniqueOrThrow: async (args: Row) => { const r = first(args); if (!r) throw new Error(`${name} not found`); return attach(name, r, (args.include || args.select) as Row); },
    findFirstOrThrow: async (args: Row) => api.findUniqueOrThrow(args),
    findMany: async (args: Row = {}) => rows().filter((r) => matches(r, args.where as Row)).map((r) => attach(name, r, (args.include || args.select) as Row)),
    count: async (args: Row = {}) => rows().filter((r) => matches(r, args.where as Row)).length,
    create: async (args: Row) => {
      const row: Row = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...(defaults[name] || {}) };
      applyData(row, args.data as Row);
      const nestedProfile = (args.data as Row).studentProfile as Row | undefined;
      if (nestedProfile?.create) table("studentProfile").push({ id: randomUUID(), userId: row.id, ...(nestedProfile.create as Row) });
      rows().push(row);
      return { ...row };
    },
    createMany: async (args: Row) => { for (const data of args.data as Row[]) await api.create({ data }); return { count: (args.data as Row[]).length }; },
    update: async (args: Row) => { const r = first(args); if (!r) throw new Error(`${name} not found for update`); applyData(r, args.data as Row); return { ...r }; },
    updateMany: async (args: Row) => { const hit = rows().filter((r) => matches(r, args.where as Row)); hit.forEach((r) => applyData(r, args.data as Row)); return { count: hit.length }; },
    upsert: async (args: Row) => { const r = first(args); if (r) { applyData(r, args.update as Row); return { ...r }; } return api.create({ data: args.create }); },
    delete: async (args: Row) => { const r = first(args); tables.set(name, rows().filter((x) => x !== r)); return r; },
    deleteMany: async (args: Row = {}) => { const keep = rows().filter((r) => !matches(r, args.where as Row)); const count = rows().length - keep.length; tables.set(name, keep); return { count }; },
  };
  return api;
}
const fakePrisma: Row = new Proxy({} as Row, {
  get(target, prop: string) {
    if (prop === "$transaction")
      return async (work: unknown) => (typeof work === "function" ? (work as (tx: unknown) => unknown)(fakePrisma) : Promise.all(work as Promise<unknown>[]));
    if (prop === "$queryRaw" || prop === "$queryRawUnsafe" || prop === "$executeRaw") return async () => [];
    if (prop === "$disconnect" || prop === "$connect") return async () => {};
    if (prop === "then") return undefined;
    if (!(prop in target)) target[prop] = delegate(prop);
    return target[prop];
  },
});
(globalThis as unknown as { prisma: unknown }).prisma = fakePrisma;

// ------------------------------------------------------------- fake stripe
type FakeSession = Row & { id: string; status: string; payment_status: string; amount_total: number; currency: string };
const sessions = new Map<string, FakeSession>();
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
} as unknown as Stripe;
const pay = (id: string, overrides: Partial<FakeSession> = {}) =>
  Object.assign(sessions.get(id)!, { status: "complete", payment_status: "paid", payment_intent: `pi_${id}` }, overrides);
const expire = (id: string) => Object.assign(sessions.get(id)!, { status: "expired" });

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
before(async () => {
  ({ createSirahAdminCustomLink } = await import("../services/sirah-admin-custom-link.service"));
  ({ handleSirahStripeEvent } = await import("../services/sirah-webhooks.service"));
  ({ verifySirahStripeSession, resetUnsettledSirahCheckout, startSirahCheckout } = await import("../services/sirah-online.service"));
  ({ repriceSirah } = await import("../services/sirah-registration.service"));
  ({ listSirahAdmin, sirahCsv } = await import("../services/sirah-admin.service"));
  custom = await import("../lib/sirah/admin-custom");
  GB_ANNUAL_CATALOG = (await import("../lib/sirah/catalog")).priceFor("GB", "ANNUAL", "STRIPE").amountMinor;
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
  assert.match(csv[0], /"?Source"?,"?Catalog price"?,"?Custom price"?,"?Sponsor"?,"?Link created by"?$/);
  assert.match(csv[1], /"Admin custom link","GBP\s?323\.89","GBP\s?150\.00","Masjid group booking","admin:owner@tga\.example"$/);
});

test("validation: annual only, positive amount, Sirah price-list currency", async () => {
  assert.equal(custom.sirahAdminCustomLinkSchema.safeParse({ ...input(), plan: "MONTHLY" }).success, false);
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
