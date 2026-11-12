// MySQL-backed tests for discount codes on Stripe card checkouts.
// Run: npm run test:sirah-card-discounts (isolated 127.0.0.1/sirah_test only).
import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { resetRateLimitsForTests } from "../lib/rate-limit";
import type { SirahTerms } from "../lib/sirah/config";
import { withDiscountTerms, withManualDiscountTerms } from "../lib/sirah/discount-terms";
import {
  createManualDiscountCode,
  discountCodeHash,
  listManualDiscountCodes,
} from "../lib/sirah/manual-discount";
import { POST as pricing } from "../app/api/pricing/route";
import { SIRAH_SLUG } from "../lib/sirah/catalog";
import { publicSirahOrder, registerSirah, repriceSirah } from "../services/sirah-registration.service";
import {
  startSirahCheckout,
  verifySirahStripeInvoice,
  verifySirahStripeSession,
} from "../services/sirah-online.service";

const db = new URL(process.env.DATABASE_URL || "mysql://invalid");
assert.equal(db.hostname, "127.0.0.1", "Tests are restricted to an isolated local MySQL database.");
assert.equal(db.pathname, "/sirah_test");

const terms: SirahTerms = {
  version: "TEST-CARD-TERMS-v1",
  commitment: "Card INR 1,500 per month; PKR 3,500 per verified bank month.",
  cancellation: "Synthetic test policy",
  refund: "Synthetic test refund policy",
  access: "Synthetic test access policy",
  tax: "Final card price INR 1500.00 includes any applicable tax.",
  cancellationTiming: "IMMEDIATE",
  failedPaymentAccess: "KEEP",
  refundAccess: "REVOKE",
  refundBilling: "CANCEL",
};
// Catalogue: India INR 1,500 monthly and INR 16,200 upfront.
const IN_MONTHLY = 150000;
const IN_ANNUAL = 1620000;

function enableRoutes() {
  process.env.NEXT_PUBLIC_APP_URL = "https://www.tga-awakening.com/";
  process.env.SIRAH_STRIPE_SECRET_KEY = "sk_test_synthetic";
  process.env.SIRAH_STRIPE_WEBHOOK_SECRET = "whsec_synthetic";
  process.env.SIRAH_STRIPE_ACCOUNT_ID = "acct_synthetic";
  process.env.SIRAH_STRIPE_MONTHLY_CURRENCIES = "INR,GBP";
  process.env.SIRAH_STRIPE_ANNUAL_CURRENCIES = "INR,GBP";
  process.env.SIRAH_MANUAL_ACCOUNTS_VERIFIED = "true";
  for (const method of ["BANK_TRANSFER", "JAZZCASH"])
    for (const plan of ["ANNUAL", "MONTHLY"])
      process.env[`SIRAH_${method}_${plan}_VERIFIED_ROUTES`] = "PK:PKR";
  process.env.SIRAH_MONTHLY_TERMS_JSON = JSON.stringify(terms);
  process.env.SIRAH_ANNUAL_TERMS_JSON = JSON.stringify(terms);
}

function student(countryCode: string, plan: "MONTHLY" | "ANNUAL", extra: Record<string, unknown> = {}) {
  return {
    fullName: "Synthetic Card Student",
    email: `sirah-card-${randomUUID()}@example.test`,
    password: "synthetic-test-only-password",
    confirmPassword: "synthetic-test-only-password",
    phoneCountry: "IN",
    callingCode: "+91",
    phone: "98765 43210",
    countryCode,
    plan,
    requestKey: randomUUID(),
    ...extra,
  } as Parameters<typeof registerSirah>[0];
}

/** Fake Sirah Stripe account: captures the Checkout Session it is asked to
 * create, and reports whatever settlement amounts the test sets. */
function fakeStripe(orderId: string) {
  const state = {
    created: [] as Stripe.Checkout.SessionCreateParams[],
    sessionAmount: 0,
    invoiceAmount: 0,
    currency: "inr",
    checkoutToken: "",
    sessionId: "",
    mode: "subscription" as "payment" | "subscription",
  };
  const client = {
    accounts: { retrieve: async () => ({ id: "acct_synthetic" }) },
    checkout: {
      sessions: {
        create: async (params: Stripe.Checkout.SessionCreateParams) => {
          state.created.push(params);
          state.sessionId = `cs_card_${randomUUID()}`;
          return { id: state.sessionId, url: "https://checkout.stripe.com/synthetic-only" };
        },
        retrieve: async () => ({
          id: state.sessionId,
          client_reference_id: orderId,
          metadata: { sirahOrderId: orderId, checkoutToken: state.checkoutToken },
          payment_status: "paid",
          status: "complete",
          currency: state.currency,
          amount_total: state.sessionAmount,
          mode: state.mode,
          payment_intent: state.mode === "payment" ? "pi_card_synthetic" : null,
          subscription: state.mode === "subscription" ? "sub_card_synthetic" : null,
          invoice: state.mode === "subscription" ? "in_card_first" : null,
        }),
      },
    },
    subscriptions: {
      retrieve: async () => ({
        id: "sub_card_synthetic",
        metadata: { sirahOrderId: orderId, checkoutToken: state.checkoutToken },
        start_date: Math.floor(Date.now() / 1000),
        customer: "cus_card_synthetic",
        items: { data: [] },
      }),
      update: async () => ({}),
    },
    invoices: {
      retrieve: async (id: string) => ({
        id,
        status: "paid",
        amount_paid: state.invoiceAmount,
        currency: state.currency,
        parent: { subscription_details: { subscription: "sub_card_synthetic" } },
      }),
    },
  };
  return { client: client as unknown as Stripe, state };
}

async function cardCode(input: Partial<Parameters<typeof createManualDiscountCode>[0]> = {}) {
  return createManualDiscountCode({ paymentScope: "CARD", market: "IN", plan: "MONTHLY", amountMinor: 100000, ...input });
}

/** Register with a card code, open the Stripe checkout, and point the fake at it. */
async function checkoutWithCode(plan: "MONTHLY" | "ANNUAL", code: string, email?: string) {
  const input = student("IN", plan, { method: "STRIPE", couponCode: code, ...(email ? { email } : {}) });
  const created = await registerSirah(input);
  const order = await publicSirahOrder(created.orderId, created.userId);
  const fake = fakeStripe(order.id);
  fake.state.mode = plan === "ANNUAL" ? "payment" : "subscription";
  await startSirahCheckout(order.id, created.userId, order.revision, order.terms!.version, fake.client, "https://tga-awakening.com");
  const saved = await prisma.sirahOrder.findUniqueOrThrow({ where: { id: order.id } });
  fake.state.checkoutToken = saved.checkoutToken!;
  return { created, order, saved, fake, input };
}

beforeEach(async () => {
  resetRateLimitsForTests();
  for (const key of Object.keys(process.env)) if (key.startsWith("SIRAH_")) delete process.env[key];
  await prisma.sirahManualDiscount.deleteMany();
  await prisma.sirahNotification.deleteMany();
  await prisma.sirahAudit.deleteMany();
  await prisma.sirahReceipt.deleteMany();
  await prisma.sirahPaymentEvent.deleteMany();
  await prisma.sirahOrder.deleteMany();
  await prisma.sirahCohort.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.manualPaymentSubmission.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.user.deleteMany();
  enableRoutes();
});
after(async () => {
  await prisma.$disconnect();
});

test("an INR monthly card code locks the reduced amount, subscribes at it, confirms at it and rejects the catalogue amount", async () => {
  const code = await cardCode();
  assert.match(code.code, /^SIRAH-IN-1000-[A-Z2-9]{4}$/);
  const { created, order, saved, fake } = await checkoutWithCode("MONTHLY", code.code);

  // Reduced amount is locked on the order.
  assert.equal(order.amountMinor, 100000);
  assert.equal(order.totalMinor, 1200000);
  assert.equal(order.discount?.label, "Personal discount");
  assert.equal(order.discount?.originalAmountMinor, IN_MONTHLY);
  assert.equal(saved.amountMinor, 100000);
  assert.equal(saved.pricingVersion.endsWith(":personal-card-v1"), true);
  assert.equal((saved.discount as { scope?: string }).scope, "CARD");
  assert.equal(order.terms!.version, "TEST-CARD-TERMS-v1:card-100000-v1");
  assert.ok(order.terms!.commitment.includes("INR 1,000"));

  // The subscription is created at the reduced monthly amount.
  assert.equal(fake.state.created.length, 1);
  const params = fake.state.created[0];
  assert.equal(params.mode, "subscription");
  assert.equal(params.line_items![0].price_data!.unit_amount, 100000);
  assert.equal(params.line_items![0].price_data!.currency, "inr");
  assert.equal(params.line_items![0].price_data!.recurring?.interval, "month");

  // A session settled at the catalogue amount is rejected; nothing is paid.
  fake.state.sessionAmount = IN_MONTHLY;
  fake.state.invoiceAmount = IN_MONTHLY;
  await assert.rejects(verifySirahStripeSession(order.id, saved.providerOrderId!, fake.client), /amount or currency mismatch/);
  assert.equal((await prisma.sirahOrder.findUniqueOrThrow({ where: { id: order.id } })).paidCount, 0);

  // Settled at the reduced amount: confirmed, enrolled, code redeemed once.
  fake.state.sessionAmount = 100000;
  fake.state.invoiceAmount = 100000;
  assert.equal((await verifySirahStripeSession(order.id, saved.providerOrderId!, fake.client)).state, "PAID");
  let paid = await prisma.sirahOrder.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(paid.paidCount, 1);
  assert.equal(paid.paidMinor, 100000);
  assert.equal(paid.enrolmentState, "ACTIVE");
  const grant = await prisma.sirahManualDiscount.findUniqueOrThrow({ where: { id: code.id } });
  assert.equal(grant.redeemedCount, 1);
  assert.equal(grant.redeemedOrderId, order.id);
  const registration = await prisma.registration.findUniqueOrThrow({ where: { id: paid.registrationId! } });
  assert.equal(registration.baseAmount, IN_MONTHLY);
  assert.equal(registration.couponDiscountAmount, 50000);

  // Each monthly invoice is verified at the locked reduced amount (unchanged check).
  await verifySirahStripeInvoice(order.id, "in_card_2", fake.client);
  fake.state.invoiceAmount = IN_MONTHLY;
  await assert.rejects(verifySirahStripeInvoice(order.id, "in_card_3", fake.client), /locked amount and currency/);
  paid = await prisma.sirahOrder.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(paid.paidCount, 2);
  assert.equal(paid.paidMinor, 200000);
  // Redemption counted once, not per invoice.
  assert.equal((await prisma.sirahManualDiscount.findUniqueOrThrow({ where: { id: code.id } })).redeemedCount, 1);
  assert.equal((await publicSirahOrder(order.id, created.userId)).amountMinor, 100000);
});

test("an INR annual card code is one reduced card payment and the catalogue amount is rejected", async () => {
  const code = await cardCode({ plan: "ANNUAL", amountMinor: 1200000 });
  const { order, saved, fake } = await checkoutWithCode("ANNUAL", code.code);
  assert.equal(saved.amountMinor, 1200000);
  assert.equal(saved.totalMinor, 1200000);
  const params = fake.state.created[0];
  assert.equal(params.mode, "payment");
  assert.equal(params.line_items![0].price_data!.unit_amount, 1200000);
  assert.equal(params.line_items![0].price_data!.recurring, undefined);
  fake.state.sessionAmount = IN_ANNUAL;
  await assert.rejects(verifySirahStripeSession(order.id, saved.providerOrderId!, fake.client), /amount or currency mismatch/);
  fake.state.sessionAmount = 1200000;
  assert.equal((await verifySirahStripeSession(order.id, saved.providerOrderId!, fake.client)).state, "PAID");
  const paid = await prisma.sirahOrder.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(paid.paidMinor, 1200000);
  assert.equal(paid.providerSubscriptionId, null);
  assert.equal((await prisma.sirahManualDiscount.findUniqueOrThrow({ where: { id: code.id } })).redeemedCount, 1);
});

test("codes price only their own scope, market, plan and currency", async () => {
  const card = await cardCode();
  const manual = await createManualDiscountCode({ amountMinor: 300000 });
  const quote = async (body: Record<string, unknown>) => {
    resetRateLimitsForTests();
    const response = await pricing(new Request("http://localhost/api/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: SIRAH_SLUG, email: "anyone@example.test", ...body }),
    }));
    return { status: response.status, data: await response.json() };
  };
  const ok = await quote({ countryCode: "IN", plan: "MONTHLY", method: "STRIPE", couponCode: card.code });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.pricing.amountMinor, 100000);
  assert.equal(ok.data.terms.version, "TEST-CARD-TERMS-v1:card-100000-v1");
  // Card code: wrong method, plan or market is refused.
  for (const change of [{ method: "PAYPAL" }, { method: null }, { plan: "ANNUAL" }, { countryCode: "GB" }, { countryCode: "PK", method: "BANK_TRANSFER" }])
    assert.equal((await quote({ countryCode: "IN", plan: "MONTHLY", method: "STRIPE", couponCode: card.code, ...change })).status, 400, JSON.stringify(change));
  // Manual code never prices a card checkout, including Pakistan card.
  assert.equal((await quote({ countryCode: "PK", plan: "MONTHLY", method: "STRIPE", couponCode: manual.code })).status, 400);
  assert.equal((await quote({ countryCode: "IN", plan: "MONTHLY", method: "STRIPE", couponCode: manual.code })).status, 400);
  // ...and still prices the original Pakistan manual route exactly as before.
  const pk = await quote({ countryCode: "PK", plan: "MONTHLY", method: "BANK_TRANSFER", couponCode: manual.code });
  assert.equal(pk.status, 200);
  assert.equal(pk.data.pricing.amountMinor, 300000);
  assert.equal(pk.data.pricing.discount.label, "Personal manual-payment discount");
  assert.equal(pk.data.terms.version, "TEST-CARD-TERMS-v1:manual-300000-v1");
  // A PK card code applies to PK card only, not to the manual methods.
  const pkCard = await cardCode({ market: "PK", amountMinor: 250000 });
  assert.equal((await quote({ countryCode: "PK", plan: "MONTHLY", method: "BANK_TRANSFER", couponCode: pkCard.code })).status, 400);
});

test("card codes keep email binding and single use, and the checkout-start re-check refuses a used or deactivated code", async () => {
  const bound = await cardCode({ email: "bound@example.test" });
  await assert.rejects(registerSirah(student("IN", "MONTHLY", { method: "STRIPE", couponCode: bound.code })), /linked to a different email address/);
  const first = await checkoutWithCode("MONTHLY", bound.code, "bound@example.test");
  assert.equal(first.saved.amountMinor, 100000);

  // Two students price one single-use unbound code before either pays.
  const shared = await cardCode();
  const a = await registerSirah(student("IN", "MONTHLY", { method: "STRIPE", couponCode: shared.code }));
  const b = await registerSirah(student("IN", "MONTHLY", { method: "STRIPE", couponCode: shared.code }));
  const orderA = await publicSirahOrder(a.orderId, a.userId);
  const orderB = await publicSirahOrder(b.orderId, b.userId);
  const fakeA = fakeStripe(orderA.id);
  await startSirahCheckout(orderA.id, a.userId, orderA.revision, orderA.terms!.version, fakeA.client, "https://tga-awakening.com");
  const savedA = await prisma.sirahOrder.findUniqueOrThrow({ where: { id: orderA.id } });
  fakeA.state.checkoutToken = savedA.checkoutToken!;
  fakeA.state.sessionAmount = fakeA.state.invoiceAmount = 100000;
  await verifySirahStripeSession(orderA.id, savedA.providerOrderId!, fakeA.client);
  assert.equal((await prisma.sirahManualDiscount.findUniqueOrThrow({ where: { id: shared.id } })).redeemedCount, 1);

  // B reaches checkout after the code was used up: no Stripe session is created.
  const fakeB = fakeStripe(orderB.id);
  await assert.rejects(
    startSirahCheckout(orderB.id, b.userId, orderB.revision, orderB.terms!.version, fakeB.client, "https://tga-awakening.com"),
    /no longer available/,
  );
  assert.equal(fakeB.state.created.length, 0);
  const stillB = await prisma.sirahOrder.findUniqueOrThrow({ where: { id: orderB.id } });
  assert.equal(stillB.paymentState, "UNPAID");
  // A new student is refused the used-up code outright.
  await assert.rejects(registerSirah(student("IN", "MONTHLY", { method: "STRIPE", couponCode: shared.code })), /already been used/);
  // B re-selects the method: the stale discount drops and the standard price applies.
  const repriced = await repriceSirah(orderB.id, b.userId, orderB.revision, "IN", "MONTHLY", "STRIPE");
  assert.equal(repriced.amountMinor, IN_MONTHLY);
  assert.equal(repriced.discount, null);
  assert.equal(repriced.terms!.version, "TEST-CARD-TERMS-v1");

  // Deactivated after pricing: also refused at checkout start.
  const later = await cardCode();
  const c = await registerSirah(student("IN", "MONTHLY", { method: "STRIPE", couponCode: later.code }));
  const orderC = await publicSirahOrder(c.orderId, c.userId);
  await prisma.sirahManualDiscount.update({ where: { id: later.id }, data: { isActive: false } });
  const fakeC = fakeStripe(orderC.id);
  await assert.rejects(
    startSirahCheckout(orderC.id, c.userId, orderC.revision, orderC.terms!.version, fakeC.client, "https://tga-awakening.com"),
    /no longer available/,
  );
  assert.equal(fakeC.state.created.length, 0);
});

test("a discounted card order cannot open checkout with the undiscounted terms version", async () => {
  const code = await cardCode();
  const created = await registerSirah(student("IN", "MONTHLY", { method: "STRIPE", couponCode: code.code }));
  const order = await publicSirahOrder(created.orderId, created.userId);
  const fake = fakeStripe(order.id);
  await assert.rejects(
    startSirahCheckout(order.id, created.userId, order.revision, terms.version, fake.client, "https://tga-awakening.com"),
    /accept the current payment terms/,
  );
  assert.equal(fake.state.created.length, 0);
  // An undiscounted card order still uses the plain catalogue version.
  const plain = await registerSirah(student("IN", "MONTHLY", { method: "STRIPE" }));
  const plainOrder = await publicSirahOrder(plain.orderId, plain.userId);
  assert.equal(plainOrder.terms!.version, terms.version);
  const plainFake = fakeStripe(plainOrder.id);
  await startSirahCheckout(plainOrder.id, plain.userId, plainOrder.revision, terms.version, plainFake.client, "https://tga-awakening.com");
  assert.equal(plainFake.state.created[0].line_items![0].price_data!.unit_amount, IN_MONTHLY);
});

test("admin creation checks scope and the market's catalogue price; the default is the original PK manual code", async () => {
  const pk = await createManualDiscountCode({ amountMinor: 300000 });
  assert.match(pk.code, /^SIRAH-PK-3000-[A-Z2-9]{4}$/);
  const pkRow = await prisma.sirahManualDiscount.findUniqueOrThrow({ where: { id: pk.id } });
  assert.deepEqual(
    { countryCode: pkRow.countryCode, plan: pkRow.plan, currency: pkRow.currency, paymentScope: pkRow.paymentScope },
    { countryCode: "PK", plan: "MONTHLY", currency: "PKR", paymentScope: "MANUAL" },
  );
  await assert.rejects(createManualDiscountCode({ amountMinor: 350000 }), /below the standard manual fee \(350000 minor units\)/);
  await assert.rejects(createManualDiscountCode({ amountMinor: 100000, market: "IN" }), /only for Pakistan monthly/);
  await assert.rejects(createManualDiscountCode({ amountMinor: 100000, plan: "ANNUAL" }), /only for Pakistan monthly/);
  await assert.rejects(cardCode({ amountMinor: IN_MONTHLY }), /below the standard card price \(INR\s1,500\.00\)/);
  await assert.rejects(cardCode({ plan: "ANNUAL", amountMinor: IN_ANNUAL }), /below the standard card price/);
  await assert.rejects(cardCode({ market: "XX" }), /market from the price list/);
  // Three-decimal currency: Kuwait KWD 7.000 monthly.
  const kw = await cardCode({ market: "KW", amountMinor: 5500 });
  assert.match(kw.code, /^SIRAH-KW-6-[A-Z2-9]{4}$/);
  assert.equal(kw.currency, "KWD");
  const eu = await cardCode({ market: "EURO", plan: "ANNUAL", amountMinor: 30000 });
  assert.equal(eu.currency, "EUR");
  const rows = await listManualDiscountCodes();
  assert.equal(rows.length, 3);
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  assert.deepEqual([byId[pk.id].market, byId[pk.id].plan, byId[pk.id].paymentScope], ["PK", "MONTHLY", "MANUAL"]);
  assert.deepEqual([byId[kw.id].market, byId[kw.id].plan, byId[kw.id].paymentScope, byId[kw.id].currency], ["KW", "MONTHLY", "CARD", "KWD"]);
  assert.deepEqual([byId[eu.id].market, byId[eu.id].plan, byId[eu.id].paymentScope], ["EURO", "ANNUAL", "CARD"]);
});

test("a row created before card discounts (no scope written) stays a manual code", async () => {
  // Mirrors existing production rows: paymentScope comes from the column default.
  const grant = await prisma.sirahManualDiscount.create({ data: {
    email: "", codeHash: discountCodeHash("LEGACY-PK-CODE"), batchCode: "beyond-chronology-2026",
    countryCode: "PK", plan: "MONTHLY", currency: "PKR", amountMinor: 300000,
  } });
  assert.equal(grant.paymentScope, "MANUAL");
  const created = await registerSirah(student("PK", "MONTHLY", { method: "BANK_TRANSFER", couponCode: "legacy-pk-code" }));
  const order = await prisma.sirahOrder.findUniqueOrThrow({ where: { id: created.orderId } });
  assert.equal(order.amountMinor, 300000);
  assert.equal(order.pricingVersion.endsWith(":personal-manual-v1"), true);
  // The manual snapshot shape is unchanged: no scope key.
  assert.deepEqual(Object.keys(order.discount as object).sort(), ["amountMinor", "grantId", "label", "originalAmountMinor"]);
  assert.equal((await publicSirahOrder(order.id, created.userId)).discount?.label, "Personal manual-payment discount");
  await assert.rejects(registerSirah(student("PK", "MONTHLY", { method: "STRIPE", couponCode: "legacy-pk-code" })), /not valid/);
});

test("card terms rewrite the order currency; manual terms are byte-identical to the original helper", () => {
  const manual = { grantId: "g", originalAmountMinor: 350000, amountMinor: 300000, label: "Personal manual-payment discount" };
  const pkTerms = { ...terms, commitment: "Card PKR 3,000; bank PKR 3,500 per verified month.", tax: "Final manual price PKR 3500.00 includes tax." };
  assert.deepEqual(withDiscountTerms(pkTerms, manual, "PKR"), withManualDiscountTerms(pkTerms, manual));
  assert.equal(withDiscountTerms(terms, null, "INR"), terms);
  const card = withDiscountTerms(terms, { grantId: "g", originalAmountMinor: IN_MONTHLY, amountMinor: 100000, label: "Personal discount", scope: "CARD" }, "INR")!;
  assert.equal(card.version, "TEST-CARD-TERMS-v1:card-100000-v1");
  assert.ok(card.commitment.startsWith("Card INR 1,000 per month; PKR 3,500"));
  assert.ok(card.commitment.endsWith("Your personal discount applies to this registration’s card payments."));
  assert.equal(card.tax, "Final card price INR 1,000 includes any applicable tax.");
  assert.equal(card.refund, terms.refund);
  assert.equal(card.cancellation, terms.cancellation);
  const kwd = withDiscountTerms({ ...terms, tax: "Price KWD 7.000 monthly." }, { grantId: "g", originalAmountMinor: 7000, amountMinor: 5500, label: "Personal discount", scope: "CARD" }, "KWD")!;
  assert.equal(kwd.tax, "Price KWD 5.5 monthly.");
});
