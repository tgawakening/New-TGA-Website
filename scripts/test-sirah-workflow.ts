import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { handleSirahStripeWebhook as handleStripeWebhook } from "../services/sirah-stripe-webhook.service";
import { handleSirahPaypalWebhook } from "../services/sirah-webhooks.service";
import { resolveSirahResumeToken, resumeHash } from "../lib/sirah/resume";
import { sirahOriginAllowed } from "../lib/sirah/origin";
import { prisma } from "../lib/prisma";
import {
  catalogue,
  priceFor,
  decimalToMinor,
  minorToDecimal,
  SIRAH_SLUG,
} from "../lib/sirah/catalog";
import { normalizeSirahPhone } from "../lib/sirah/phone";
import { getGroupInvitation, methodAvailable } from "../lib/sirah/config";
import {
  sirahRegistrationSchema,
  sirahRepriceSchema,
} from "../lib/sirah/validation";
import {
  registerSirah,
  publicSirahOrder,
  repriceSirah,
} from "../services/sirah-registration.service";
import {
  submitSirahEvidence,
  readSirahReceipt,
  validateSirahReceipt,
} from "../services/sirah-receipts.service";
import {
  holdSirahRefund,
  recordSirahRefund,
  actOnSirahOrder,
  listSirahAdmin,
} from "../services/sirah-admin.service";
import {
  confirmSirahPayment,
  canAccessSirah,
  addMonthsClamped,
} from "../services/sirah-confirmation.service";
import {
  startSirahCheckout,
  verifySirahStripeSession,
  verifySirahStripeInvoice,
  verifySirahPaypal,
} from "../services/sirah-online.service";
import {
  dispatchSirahNotifications,
  queuePendingInvitations,
  queueSirahNotice,
} from "../services/sirah-notifications.service";
const db = new URL(process.env.DATABASE_URL || "mysql://invalid");
assert.equal(
  db.hostname,
  "127.0.0.1",
  "Tests are restricted to an isolated local MySQL database.",
);
assert.equal(db.pathname, "/sirah_test");
const originalFetch = global.fetch;
const approvedTestTerms = {
  version: "TEST-ONLY-TERMS-v1",
  commitment: "Synthetic test terms; not production policy",
  cancellation: "Synthetic test policy",
  refund: "Synthetic test refund policy",
  access: "Synthetic test access policy",
  tax: "Synthetic test tax treatment",
  cancellationTiming: "IMMEDIATE",
  failedPaymentAccess: "KEEP",
  refundAccess: "REVOKE",
  refundBilling: "CANCEL",
};
function enableManual() {
  process.env.SIRAH_MANUAL_ACCOUNTS_VERIFIED = "true";
  process.env.SIRAH_MONTHLY_TERMS_JSON = JSON.stringify(approvedTestTerms);
  process.env.SIRAH_ANNUAL_TERMS_JSON = JSON.stringify(approvedTestTerms);
}
function payload(countryCode = "PK", plan: "MONTHLY" | "ANNUAL" = "MONTHLY") {
  return {
    fullName: "Synthetic Test Student",
    email: `sirah-${randomUUID()}@example.test`,
    password: "synthetic-test-only-password",
    confirmPassword: "synthetic-test-only-password",
    phoneCountry: "PK",
    callingCode: "+92",
    phone: "0300 1234567",
    countryCode,
    plan,
    requestKey: randomUUID(),
  };
}
async function create(country = "PK", plan: "MONTHLY" | "ANNUAL" = "MONTHLY") {
  const input = payload(country, plan);
  const value = await registerSirah(input);
  return { ...value, input };
}
async function manualOrder() {
  enableManual();
  const result = await create();
  const order = await repriceSirah(
    result.orderId,
    result.userId,
    0,
    "PK",
    "MONTHLY",
    "BANK_TRANSFER",
  );
  return { ...result, order };
}
async function evidence(
  order: Awaited<ReturnType<typeof publicSirahOrder>>,
  userId: string,
  route: "UPLOAD" | "WHATSAPP" = "UPLOAD",
) {
  const data = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  await submitSirahEvidence(
    order.id,
    userId,
    {
      revision: order.revision,
      method: "BANK_TRANSFER",
      route,
      payerName: "Synthetic Payer",
      transactionReference: "student-provided-unverified",
    },
    route === "UPLOAD" ? { data, name: "receipt.png" } : null,
    approvedTestTerms.version,
  );
  return publicSirahOrder(order.id, userId);
}
async function approve(
  order: Awaited<ReturnType<typeof publicSirahOrder>>,
  reference = "test-transfer-1",
  actor = "admin:test-a",
) {
  return actOnSirahOrder(
    {
      orderId: order.id,
      revision: order.revision,
      action: "APPROVE",
      verifiedAmount: minorToDecimal(order.amountMinor, order.currency),
      currency: order.currency,
      transactionReference: reference,
      verifiedTransfer: true,
    },
    actor,
  );
}
beforeEach(async () => {
  global.fetch = originalFetch;
  for (const key of Object.keys(process.env))
    if (
      key.startsWith("SIRAH_") ||
      ["RESEND_API_KEY", "EMAIL_FROM", "ADMIN_NOTIFICATION_EMAIL"].includes(key)
    )
      delete process.env[key];
  process.env.ADMIN_NOTIFICATION_EMAIL = "admin@example.test";
  await prisma.sirahNotification.deleteMany();
  await prisma.sirahAudit.deleteMany();
  await prisma.sirahReceipt.deleteMany();
  await prisma.sirahPaymentEvent.deleteMany();
  await prisma.sirahOrder.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.manualPaymentSubmission.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.user.deleteMany();
});
after(async () => {
  global.fetch = originalFetch;
  await prisma.$disconnect();
});
test("phone countries and shared calling prefixes are validated with E.164 normalization", () => {
  assert.equal(
    normalizeSirahPhone("PK", "+92", "0300 1234567").phoneE164,
    "+923001234567",
  );
  assert.equal(
    normalizeSirahPhone("PK", "+92", "+92 (300) 123-4567").phoneNumber,
    "3001234567",
  );
  assert.throws(() => normalizeSirahPhone("AL", "+355", "+923001234567"));
  assert.throws(() => normalizeSirahPhone("PK", "+355", "03001234567"));
  assert.throws(() => normalizeSirahPhone("PK", "+92", "123"));
  assert.equal(
    normalizeSirahPhone("US", "+1", "202-555-0123").phoneCountry,
    "US",
  );
  assert.equal(
    normalizeSirahPhone("CA", "+1", "416-555-0123").phoneCountry,
    "CA",
  );
  assert.throws(() => normalizeSirahPhone("CA", "+1", "2025550123"));
});
test("the authoritative guide covers all markets, exact decimal precision and explicit GBP fallbacks", () => {
  assert.equal(catalogue.length, 19);
  for (const row of catalogue) {
    for (const plan of ["MONTHLY", "ANNUAL"] as const) {
      const quote = priceFor(row[0], plan, "STRIPE");
      assert.equal(
        quote.amountMinor,
        decimalToMinor(plan === "ANNUAL" ? row[5] : row[3], row[2]),
      );
    }
  }
  assert.equal(priceFor("PK", "MONTHLY", "BANK_TRANSFER").amountMinor, 350000);
  assert.equal(priceFor("PK", "ANNUAL", "BANK_TRANSFER").amountMinor, 3240000);
  assert.equal(priceFor("BH", "MONTHLY", "STRIPE").amountMinor, 8500);
  assert.equal(priceFor("KW", "ANNUAL", "STRIPE").amountMinor, 75600);
  assert.equal(priceFor("AE", "MONTHLY", null).currency, "GBP");
  assert.equal(priceFor("AE", "ANNUAL", null).amountMinor, 32389);
  assert.equal(priceFor("DE", "MONTHLY", null).currency, "EUR");
  assert.equal(priceFor("GB", "MONTHLY", null).currency, "GBP");
  assert.equal(priceFor("BG", "MONTHLY", null).currency, "EUR");
  assert.equal(priceFor("TR", "MONTHLY", null).currency, "GBP");
  assert.throws(() => decimalToMinor("8.5001", "BHD"));
  assert.equal(minorToDecimal(91800, "BHD"), "91.800");
});
test("unapproved routes remain inactive and browser prices/statuses are rejected", () => {
  assert.equal(methodAvailable("BANK_TRANSFER", "PK", "PKR", "MONTHLY"), false);
  assert.equal(methodAvailable("STRIPE", "PK", "PKR", "MONTHLY"), false);
  assert.equal(
    sirahRegistrationSchema.safeParse({
      ...payload(),
      amount: 1,
      paymentStatus: "PAID",
    }).success,
    false,
  );
  assert.equal(
    sirahRepriceSchema.safeParse({
      revision: 0,
      countryCode: "PK",
      plan: "MONTHLY",
      method: "STRIPE",
      amount: 1,
    }).success,
    false,
  );
  enableManual();
  assert.equal(methodAvailable("BANK_TRANSFER", "PK", "PKR", "MONTHLY"), true);
  assert.equal(methodAvailable("BANK_TRANSFER", "IN", "INR", "MONTHLY"), false);
  assert.equal(methodAvailable("PAYPAL", "BH", "BHD", "ANNUAL"), false);
});
test("registration records unpaid interest, reuses signed-in accounts and never stores a password in notifications", async () => {
  const result = await create();
  const order = await publicSirahOrder(result.orderId, result.userId);
  assert.equal(order.paymentState, "UNPAID");
  assert.equal(order.enrolmentState, "PENDING");
  assert.equal(order.phoneE164, "+923001234567");
  assert.equal(order.methods.length, 0);
  assert.equal(await prisma.payment.count(), 0);
  const same = await registerSirah(result.input, result.userId);
  assert.equal(same.orderId, result.orderId);
  assert.equal(await prisma.user.count(), 1);
  await assert.rejects(
    () => registerSirah({ ...result.input, requestKey: randomUUID() }),
    /sign in/,
  );
  const notice = JSON.stringify(await prisma.sirahNotification.findMany());
  assert.equal(notice.includes(result.input.password), false);
  assert.equal(notice.includes('"password"'), false);
  await assert.rejects(
    () => repriceSirah(order.id, result.userId, 0, "PK", "MONTHLY", "STRIPE"),
    /not approved/,
  );
});
test("country, plan and method changes recalculate server amounts without changing previous receipts", async () => {
  enableManual();
  const result = await create("GB");
  const india = await repriceSirah(
    result.orderId,
    result.userId,
    0,
    "IN",
    "ANNUAL",
    null,
  );
  assert.equal(india.amountMinor, 1620000);
  assert.equal(india.currency, "INR");
  const pakistan = await repriceSirah(
    result.orderId,
    result.userId,
    india.revision,
    "PK",
    "MONTHLY",
    "BANK_TRANSFER",
  );
  assert.equal(pakistan.amountMinor, 350000);
  assert.equal(pakistan.totalMinor, 4200000);
  await assert.rejects(
    () => repriceSirah(result.orderId, result.userId, 0, "US", "ANNUAL", null),
    /changed/,
  );
});
test("manual upload is awaiting review; two admins cannot confirm the same submission twice", async () => {
  const { order, userId } = await manualOrder();
  const submitted = await evidence(order, userId);
  assert.equal(submitted.paymentState, "AWAITING_REVIEW");
  assert.equal(submitted.enrolmentState, "PENDING");
  assert.equal(submitted.receipts.length, 1);
  assert.equal(
    JSON.stringify(submitted).includes("SyntheticSuppliedTestInvite"),
    false,
  );
  const results = await Promise.allSettled([
    approve(submitted, "transfer-A", "admin:A"),
    approve(submitted, "transfer-B", "admin:B"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const paid = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: order.id },
  });
  assert.equal(paid.paidCount, 1);
  assert.equal(paid.paymentState, "PAID");
  assert.equal(paid.enrolmentState, "ACTIVE");
  assert.equal(paid.invitationState, "PENDING");
  assert.equal(canAccessSirah(paid), true);
  assert.equal(
    await prisma.sirahPaymentEvent.count({ where: { kind: "FIRST" } }),
    1,
  );
  assert.equal(
    await prisma.sirahNotification.count({
      where: {
        orderId: order.id,
        kind: "CONFIRMED",
        toEmail: { contains: "sirah-" },
      },
    }),
    1,
  );
  assert.equal(
    await prisma.sirahNotification.count({
      where: { orderId: order.id, kind: "INVITATION_PENDING" },
    }),
    1,
  );
});
test("WhatsApp evidence, rejection and replacement retain the receipt audit trail and ownership checks", async () => {
  const { order, userId } = await manualOrder();
  let submitted = await evidence(order, userId, "WHATSAPP");
  assert.equal(submitted.receipts.length, 0);
  await actOnSirahOrder(
    {
      orderId: order.id,
      revision: submitted.revision,
      action: "REJECT",
      note: "Transaction not yet found",
    },
    "admin:test",
  );
  let current = await publicSirahOrder(order.id, userId);
  assert.equal(current.paymentState, "REJECTED");
  submitted = await evidence(current, userId);
  const firstReceipt = submitted.receipts[0];
  assert.equal(
    (await readSirahReceipt(firstReceipt.id, userId, false)).mime,
    "image/png",
  );
  await assert.rejects(
    () => readSirahReceipt(firstReceipt.id, "another-student", false),
    /not found/,
  );
  await actOnSirahOrder(
    {
      orderId: order.id,
      revision: submitted.revision,
      action: "REJECT",
      note: "Need a clearer receipt",
    },
    "admin:test",
  );
  current = await publicSirahOrder(order.id, userId);
  submitted = await evidence(current, userId);
  assert.equal(submitted.receipts.length, 2);
  assert.equal(
    await prisma.sirahReceipt.count({ where: { orderId: order.id } }),
    2,
  );
});
test("receipt uploads validate real content, reject invalid/oversized evidence, and accept a parsed PDF", async () => {
  await assert.rejects(
    () =>
      validateSirahReceipt(
        Buffer.from("<html>not a receipt</html>"),
        "receipt.png",
      ),
    /contents/,
  );
  await assert.rejects(
    () =>
      validateSirahReceipt(new Uint8Array(5 * 1024 * 1024 + 1), "large.pdf"),
    /4 MB/,
  );
  const pdf = await PDFDocument.create();
  pdf.addPage();
  assert.equal(
    (await validateSirahReceipt(await pdf.save(), "receipt.pdf")).mime,
    "application/pdf",
  );
  await assert.rejects(
    () => validateSirahReceipt(Buffer.from("%PDF-1.7\nbroken"), "receipt.pdf"),
    /damaged/,
  );
});
async function stripeOrder(plan: "ANNUAL" | "MONTHLY") {
  process.env.SIRAH_STRIPE_SECRET_KEY = "sk_test_synthetic";
  process.env.SIRAH_STRIPE_WEBHOOK_SECRET = "whsec_synthetic";
  process.env.SIRAH_STRIPE_ACCOUNT_ID = "acct_synthetic";
  process.env.SIRAH_STRIPE_ANNUAL_CURRENCIES = "GBP";
  process.env.SIRAH_STRIPE_MONTHLY_CURRENCIES = "GBP";
  enableManual();
  const result = await create("GB", plan);
  await repriceSirah(result.orderId, result.userId, 0, "GB", plan, "STRIPE");
  await prisma.sirahOrder.update({
    where: { id: result.orderId },
    data: {
      checkoutToken: "test-checkout",
      providerOrderId: "cs_synthetic",
      paymentState: "PROCESSING",
    },
  });
  return result;
}
function fakeStripe(
  order: { id: string; amountMinor: number; currency: string; plan: string },
  status = "paid",
) {
  const start = Math.floor(Date.now() / 1000);
  let cancellation: number | null = null;
  const fake = {
    accounts: { retrieve: async () => ({ id: "acct_synthetic" }) },
    checkout: {
      sessions: {
        retrieve: async () => ({
          id: "cs_synthetic",
          client_reference_id: order.id,
          metadata: { sirahOrderId: order.id, checkoutToken: "test-checkout" },
          payment_status: status,
          status: "complete",
          currency: order.currency.toLowerCase(),
          amount_total: order.amountMinor,
          mode: order.plan === "ANNUAL" ? "payment" : "subscription",
          payment_intent: "pi_synthetic",
          subscription: order.plan === "ANNUAL" ? null : "sub_synthetic",
          invoice: order.plan === "ANNUAL" ? null : "in_first",
        }),
      },
    },
    subscriptions: {
      retrieve: async () => ({
        id: "sub_synthetic",
        metadata: { sirahOrderId: order.id, checkoutToken: "test-checkout" },
        start_date: start,
        customer: "cus_synthetic",
      }),
      update: async (_id: string, data: { cancel_at: number }) => {
        cancellation = data.cancel_at;
        return {};
      },
    },
    invoices: {
      retrieve: async (id: string) => ({
        id,
        status: "paid",
        amount_paid: order.amountMinor,
        currency: order.currency.toLowerCase(),
        parent: { subscription_details: { subscription: "sub_synthetic" } },
      }),
    },
  };
  return {
    client: fake as unknown as Stripe,
    cancellation: () => cancellation,
    start,
  };
}
test("Stripe requires merchant, ownership, paid status and exact settlement; annual payments never subscribe", async () => {
  const result = await stripeOrder("ANNUAL");
  const order = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: result.orderId },
  });
  const pending = fakeStripe(order, "unpaid");
  assert.equal(
    (await verifySirahStripeSession(order.id, "cs_synthetic", pending.client))
      .state,
    "PROCESSING",
  );
  assert.equal(
    (await publicSirahOrder(order.id, result.userId)).paymentState,
    "PROCESSING",
  );
  const bad = fakeStripe({ ...order, amountMinor: 1 });
  await assert.rejects(
    () => verifySirahStripeSession(order.id, "cs_synthetic", bad.client),
    /amount or currency/,
  );
  const good = fakeStripe(order);
  await verifySirahStripeSession(order.id, "cs_synthetic", good.client);
  await verifySirahStripeSession(order.id, "cs_synthetic", good.client);
  const paid = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: order.id },
  });
  assert.equal(paid.paidCount, 1);
  assert.equal(paid.providerSubscriptionId, null);
  assert.equal(good.cancellation(), null);
  assert.equal(
    await prisma.sirahPaymentEvent.count({ where: { kind: "FIRST" } }),
    1,
  );
});
test("monthly Stripe settlement is idempotent, schedules a 12-month end and rejects a thirteenth payment", async () => {
  const result = await stripeOrder("MONTHLY");
  const order = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: result.orderId },
  });
  const fake = fakeStripe(order);
  await verifySirahStripeSession(order.id, "cs_synthetic", fake.client);
  assert.equal(
    fake.cancellation(),
    Math.floor(
      addMonthsClamped(new Date(fake.start * 1000), 12).getTime() / 1000,
    ),
  );
  await verifySirahStripeInvoice(order.id, "in_first", fake.client);
  for (let i = 2; i <= 12; i++)
    await verifySirahStripeInvoice(order.id, `in_${i}`, fake.client);
  await assert.rejects(
    () => verifySirahStripeInvoice(order.id, "in_13", fake.client),
    /payment limit/,
  );
  const paid = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: order.id },
  });
  assert.equal(paid.paidCount, 12);
  assert.equal(paid.nextBillingAt, null);
});
test("PayPal annual verification rejects merchant/amount mismatches and records only completed captures", async () => {
  enableManual();
  process.env.PAYPAL_CLIENT_ID = "synthetic";
  process.env.PAYPAL_CLIENT_SECRET = "synthetic";
  process.env.SIRAH_PAYPAL_MERCHANT_ID = "MERCHANT_TEST";
  process.env.SIRAH_PAYPAL_WEBHOOK_ID = "WH_TEST";
  process.env.SIRAH_PAYPAL_ANNUAL_CURRENCIES = "GBP";
  const result = await create("GB", "ANNUAL");
  await repriceSirah(
    result.orderId,
    result.userId,
    0,
    "GB",
    "ANNUAL",
    "PAYPAL",
  );
  await prisma.sirahOrder.update({
    where: { id: result.orderId },
    data: {
      paymentState: "PROCESSING",
      providerOrderId: "PP_TEST",
      checkoutToken: "test-checkout",
    },
  });
  let state = "PENDING",
    merchant = "MERCHANT_TEST",
    value = "323.89";
  global.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/v1/oauth2/token"))
      return Response.json({ access_token: "synthetic" });
    return Response.json({
      id: "PP_TEST",
      status: state === "COMPLETED" ? "COMPLETED" : "APPROVED",
      purchase_units: [
        {
          custom_id: result.orderId,
          payee: { merchant_id: merchant },
          payments: {
            captures: [
              {
                id: "CAPTURE_TEST",
                status: state,
                amount: { currency_code: "GBP", value },
              },
            ],
          },
        },
      ],
    });
  };
  assert.equal(
    (await verifySirahPaypal(result.orderId, "PP_TEST")).state,
    "PROCESSING",
  );
  state = "COMPLETED";
  merchant = "WRONG";
  await assert.rejects(
    () => verifySirahPaypal(result.orderId, "PP_TEST"),
    /merchant or order/,
  );
  merchant = "MERCHANT_TEST";
  value = "1.00";
  await assert.rejects(
    () => verifySirahPaypal(result.orderId, "PP_TEST"),
    /amount or currency/,
  );
  value = "323.89";
  await verifySirahPaypal(result.orderId, "PP_TEST");
  await verifySirahPaypal(result.orderId, "PP_TEST");
  assert.equal(
    (
      await prisma.sirahOrder.findUniqueOrThrow({
        where: { id: result.orderId },
      })
    ).paidCount,
    1,
  );
});
test("a successful PayPal subscription approval without settlement does not grant enrolment", async () => {
  enableManual();
  process.env.PAYPAL_CLIENT_ID = "synthetic";
  process.env.PAYPAL_CLIENT_SECRET = "synthetic";
  process.env.SIRAH_PAYPAL_MERCHANT_ID = "MERCHANT_TEST";
  process.env.SIRAH_PAYPAL_WEBHOOK_ID = "WH_TEST";
  process.env.SIRAH_PAYPAL_PRODUCT_ID = "PROD_TEST";
  process.env.SIRAH_PAYPAL_MONTHLY_CURRENCIES = "GBP";
  const result = await create("GB", "MONTHLY");
  await repriceSirah(
    result.orderId,
    result.userId,
    0,
    "GB",
    "MONTHLY",
    "PAYPAL",
  );
  await prisma.sirahOrder.update({
    where: { id: result.orderId },
    data: {
      paymentState: "PROCESSING",
      providerSubscriptionId: "I_TEST",
      providerPlanId: "P_TEST",
    },
  });
  global.fetch = async (input) =>
    String(input).endsWith("/v1/oauth2/token")
      ? Response.json({ access_token: "synthetic" })
      : String(input).includes("/transactions?")
        ? Response.json({ transactions: [] })
        : Response.json({
            id: "I_TEST",
            status: "ACTIVE",
            custom_id: result.orderId,
            plan_id: "P_TEST",
            start_time: new Date().toISOString(),
          });
  assert.equal(
    (await verifySirahPaypal(result.orderId, "I_TEST")).state,
    "PROCESSING",
  );
  assert.equal(
    (
      await prisma.sirahOrder.findUniqueOrThrow({
        where: { id: result.orderId },
      })
    ).paidCount,
    0,
  );
});
test("missing regional invitations do not block paid enrolment and are queued once configured", async () => {
  const { order, userId } = await manualOrder();
  const submitted = await evidence(order, userId);
  await approve(submitted);
  assert.equal(getGroupInvitation("PK"), null);
  assert.equal(getGroupInvitation("GB"), null);
  process.env.SIRAH_SUPPLIED_GROUP_AUDIENCE = "PAKISTAN";
  process.env.SIRAH_SUPPLIED_GROUP_URL =
    "https://chat.whatsapp.com/SyntheticSuppliedTestInvite";
  assert.match(getGroupInvitation("PK")!, /SyntheticSuppliedTestInvite/);
  assert.equal(getGroupInvitation("GB"), null);
  await queuePendingInvitations();
  await queuePendingInvitations();
  assert.equal(
    await prisma.sirahNotification.count({
      where: {
        orderId: order.id,
        kind: "INVITATION",
        toEmail: { contains: "sirah-" },
      },
    }),
    1,
  );
});
test("failed email delivery is persisted and retried without duplicating successful notices or reversing enrolment", async () => {
  const { order, userId } = await manualOrder();
  const submitted = await evidence(order, userId);
  await approve(submitted);
  process.env.RESEND_API_KEY = "synthetic";
  process.env.EMAIL_FROM = "Test Sender <sender@example.test>";
  let succeed = false;
  const keys: string[] = [];
  global.fetch = async (_input, init) => {
    keys.push(new Headers(init?.headers).get("Idempotency-Key") || "");
    return succeed
      ? Response.json({ id: "synthetic-resend-id" })
      : new Response("synthetic failure", { status: 503 });
  };
  await dispatchSirahNotifications(order.id);
  assert.ok(
    await prisma.sirahNotification.count({
      where: { orderId: order.id, state: "FAILED" },
    }),
  );
  assert.equal(
    (await prisma.sirahOrder.findUniqueOrThrow({ where: { id: order.id } }))
      .paymentState,
    "PAID",
  );
  succeed = true;
  await dispatchSirahNotifications(order.id);
  const calls = keys.length;
  await dispatchSirahNotifications(order.id);
  assert.equal(keys.length, calls);
  assert.ok(keys.every(Boolean));
});
test("completion never impersonates payment; cancellation, manual refund and historical prices remain distinct", async () => {
  const pending = await create();
  await actOnSirahOrder(
    { orderId: pending.orderId, revision: 0, action: "COMPLETE" },
    "admin:test",
  );
  const finished = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: pending.orderId },
  });
  assert.equal(finished.paymentState, "UNPAID");
  assert.equal(finished.paidCount, 0);
  assert.equal(canAccessSirah(finished), false);
  const { order, userId } = await manualOrder();
  const submitted = await evidence(order, userId);
  await approve(submitted);
  const paid = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: order.id },
  });
  await actOnSirahOrder(
    {
      orderId: order.id,
      revision: paid.revision,
      action: "REFUND",
      verifiedAmount: "3500",
      currency: "PKR",
      refundReference: "actual-test-refund",
      note: "Verified synthetic test refund",
    },
    "admin:test",
  );
  const refunded = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: order.id },
  });
  assert.equal(refunded.paymentState, "REFUNDED");
  assert.equal(refunded.enrolmentState, "CANCELLED");
  assert.equal(refunded.paidMinor, 350000);
  const listing = await listSirahAdmin(
    new URLSearchParams({ payment: "REFUNDED" }),
  );
  assert.equal(listing.total, 1);
});

test("historical registrations, enrolments and agreed eight-month prices are never repriced", async () => {
  const result = await create();
  const order = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: result.orderId },
  });
  const old = await prisma.registration.create({
    data: {
      userId: result.userId,
      courseId: order.courseId,
      selectedCountryCode: "GB",
      selectedCountryName: "United Kingdom",
      selectedCurrency: "GBP",
      baseAmount: 2000,
      finalAmount: 2000,
      paymentMethod: "STRIPE",
      status: "ACTIVE",
      pricingSnapshot: { legacyProgrammeMonths: 8, agreedMonthlyPence: 2000 },
      payment: {
        create: {
          provider: "STRIPE",
          amount: 16000,
          currency: "GBP",
          status: "SUCCEEDED",
        },
      },
      enrollment: {
        create: {
          userId: result.userId,
          courseId: order.courseId,
          status: "ACTIVE",
          activatedAt: new Date(),
        },
      },
    },
    include: { payment: true, enrollment: true },
  });
  assert.equal(
    (await prisma.course.findUniqueOrThrow({ where: { id: order.courseId } }))
      .slug,
    SIRAH_SLUG,
  );
  enableManual();
  let current = await repriceSirah(
    order.id,
    result.userId,
    0,
    "PK",
    "MONTHLY",
    "BANK_TRANSFER",
  );
  current = await evidence(current, result.userId);
  await approve(current, "new-batch-transfer");
  const preserved = await prisma.registration.findUniqueOrThrow({
    where: { id: old.id },
    include: { payment: true, enrollment: true },
  });
  assert.equal(preserved.finalAmount, 2000);
  assert.equal(preserved.payment!.amount, 16000);
  assert.equal(preserved.payment!.currency, "GBP");
  assert.equal(preserved.enrollment!.id, old.enrollment!.id);
  assert.equal(preserved.enrollment!.registrationId, old.id);
  assert.equal(
    (preserved.pricingSnapshot as { legacyProgrammeMonths: number })
      .legacyProgrammeMonths,
    8,
  );
});

test("a late settled payment records money but cannot reactivate a cancelled enrolment", async () => {
  const { order, userId } = await manualOrder();
  await actOnSirahOrder(
    {
      orderId: order.id,
      revision: order.revision,
      action: "CANCEL",
      note: "Student cancelled before transfer settled",
    },
    "admin:test",
  );
  await confirmSirahPayment({
    orderId: order.id,
    eventId: "manual:late-verified",
    provider: "BANK_TRANSFER",
    amountMinor: 350000,
    currency: "PKR",
    actor: "admin:verified-late-transfer",
  });
  const latest = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: order.id },
  });
  assert.equal(latest.paymentState, "PAID");
  assert.equal(latest.enrolmentState, "CANCELLED");
  assert.equal(canAccessSirah(latest), false);
  assert.equal((await publicSirahOrder(order.id, userId)).paidMinor, 350000);
  assert.equal(
    await prisma.sirahNotification.count({
      where: { orderId: order.id, kind: "PAYMENT_RECONCILIATION" },
    }),
    2,
  );
});

test("calendar month boundaries clamp correctly and scheduled access expiry is enforced without cron", () => {
  assert.equal(
    addMonthsClamped(new Date("2024-01-31T12:00:00Z"), 1).toISOString(),
    "2024-02-29T12:00:00.000Z",
  );
  assert.equal(
    addMonthsClamped(new Date("2025-01-31T12:00:00Z"), 1).toISOString(),
    "2025-02-28T12:00:00.000Z",
  );
  assert.equal(
    canAccessSirah(
      {
        enrolmentState: "ACTIVE",
        paidCount: 1,
        programmeEnd: new Date("2030-01-01"),
        accessEndsAt: new Date("2026-01-01"),
      },
      new Date("2026-02-01"),
    ),
    false,
  );
});

test("an out-of-order verified refund cannot release course access or a confirmation group email", async () => {
  const { order } = await manualOrder();
  await holdSirahRefund(
    order.id,
    "manual:refund-before-settlement",
    "PKR",
    350000,
  );
  await confirmSirahPayment({
    orderId: order.id,
    eventId: "manual:settlement-arriving-later",
    provider: "BANK_TRANSFER",
    amountMinor: 350000,
    currency: "PKR",
    actor: "admin:verified-transfer",
  });
  let current = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: order.id },
  });
  assert.equal(current.paymentState, "REFUND_PENDING");
  assert.equal(canAccessSirah(current), false);
  assert.equal(
    await prisma.sirahNotification.count({
      where: { orderId: order.id, kind: "CONFIRMED" },
    }),
    0,
  );
  await recordSirahRefund(
    order.id,
    "manual:refund-before-settlement",
    350000,
    "PKR",
    "admin:verified-refund",
    "Verified refund reconciled after settlement",
  );
  current = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: order.id },
  });
  assert.equal(current.paymentState, "REFUNDED");
  assert.equal(current.enrolmentState, "CANCELLED");
  assert.equal(current.paidMinor, 350000);
  assert.equal(current.refundedMinor, 350000);
});

test("the real Stripe webhook entry verifies signatures before confirming, and duplicate events stay idempotent", async () => {
  const result = await stripeOrder("ANNUAL");
  const order = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: result.orderId },
  });
  const fake = fakeStripe(order);
  const sdk = new Stripe("sk_test_synthetic");
  Object.assign(fake.client, { webhooks: sdk.webhooks });
  const payloadText = JSON.stringify({
    id: "evt_synthetic",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_synthetic",
        metadata: { sirahOrderId: order.id, checkoutToken: "test-checkout" },
      },
    },
  });
  const bad = sdk.webhooks.generateTestHeaderString({
    payload: payloadText,
    secret: "wrong-test-signature-secret",
  });
  await assert.rejects(
    () => handleStripeWebhook({ signature: bad, payloadText }, fake.client),
    /signature/i,
  );
  assert.equal(await prisma.sirahPaymentEvent.count(), 0);
  const signature = sdk.webhooks.generateTestHeaderString({
    payload: payloadText,
    secret: process.env.SIRAH_STRIPE_WEBHOOK_SECRET!,
  });
  await handleStripeWebhook({ signature, payloadText }, fake.client);
  await handleStripeWebhook({ signature, payloadText }, fake.client);
  assert.equal(
    (await prisma.sirahOrder.findUniqueOrThrow({ where: { id: order.id } }))
      .paidCount,
    1,
  );
});

test("the PayPal webhook rejects failed signature verification and re-verifies completed captures server-side", async () => {
  enableManual();
  process.env.PAYPAL_CLIENT_ID = "synthetic";
  process.env.PAYPAL_CLIENT_SECRET = "synthetic";
  process.env.SIRAH_PAYPAL_MERCHANT_ID = "MERCHANT_TEST";
  process.env.SIRAH_PAYPAL_WEBHOOK_ID = "WH_TEST";
  process.env.SIRAH_PAYPAL_ANNUAL_CURRENCIES = "GBP";
  const result = await create("GB", "ANNUAL");
  await repriceSirah(
    result.orderId,
    result.userId,
    0,
    "GB",
    "ANNUAL",
    "PAYPAL",
  );
  await prisma.sirahOrder.update({
    where: { id: result.orderId },
    data: {
      providerOrderId: "PP_WEBHOOK",
      checkoutToken: "test-checkout",
      paymentState: "PROCESSING",
    },
  });
  let verified = false;
  global.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/oauth2/token"))
      return Response.json({ access_token: "synthetic" });
    if (url.endsWith("/verify-webhook-signature")) {
      assert.equal(JSON.parse(String(init?.body)).webhook_id, "WH_TEST");
      return Response.json({
        verification_status: verified ? "SUCCESS" : "FAILURE",
      });
    }
    return Response.json({
      id: "PP_WEBHOOK",
      status: "COMPLETED",
      purchase_units: [
        {
          custom_id: result.orderId,
          payee: { merchant_id: "MERCHANT_TEST" },
          payments: {
            captures: [
              {
                id: "CAPTURE_WEBHOOK",
                status: "COMPLETED",
                amount: { currency_code: "GBP", value: "323.89" },
              },
            ],
          },
        },
      ],
    });
  };
  const body = JSON.stringify({
    id: "WH_EVENT",
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      id: "CAPTURE_WEBHOOK",
      custom_id: result.orderId,
      supplementary_data: { related_ids: { order_id: "PP_WEBHOOK" } },
    },
  });
  const request = () =>
    new Request("https://example.test/api/sirah/webhooks/paypal", {
      method: "POST",
      body,
    });
  await assert.rejects(() => handleSirahPaypalWebhook(request()), /signature/);
  assert.equal(await prisma.sirahPaymentEvent.count(), 0);
  verified = true;
  await handleSirahPaypalWebhook(request());
  await handleSirahPaypalWebhook(request());
  assert.equal(
    (
      await prisma.sirahOrder.findUniqueOrThrow({
        where: { id: result.orderId },
      })
    ).paidCount,
    1,
  );
});

test("historical pending-order updates preserve the original quote and reject changing its agreed plan", async () => {
  const result = await create();
  const current = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: result.orderId },
  });
  const snapshot = {
    selectedPaymentPlanType: "FULL_COURSE",
    fullCourseMonths: 8,
    fullCourseAmount: 16000,
    finalAmount: 2000,
    currency: "GBP",
    display: { finalGbpApprox: 20, fullCourseGbpApprox: 160 },
    allowedPaymentMethodsByPlan: {
      subscription: ["STRIPE"],
      fullCourse: ["STRIPE"],
    },
  };
  const legacy = await prisma.registration.create({
    data: {
      userId: result.userId,
      courseId: current.courseId,
      selectedCountryCode: "GB",
      selectedCountryName: "United Kingdom",
      selectedCurrency: "GBP",
      baseAmount: 2000,
      finalAmount: 2000,
      paymentMethod: "STRIPE",
      status: "PENDING_PAYMENT",
      pricingSnapshot: snapshot,
      payment: {
        create: { provider: "STRIPE", amount: 16000, currency: "GBP" },
      },
      enrollment: {
        create: { userId: result.userId, courseId: current.courseId },
      },
    },
  });
  const { updatePendingRegistration } =
    await import("../services/registration.service");
  const input = {
    registrationId: legacy.id,
    couponCode: undefined,
    userId: result.userId,
    fullName: result.input.fullName,
    phoneCountryCode: "+92",
    phoneNumber: "3001234567",
    countryCode: "GB",
    countryName: "United Kingdom",
    courseSlug: SIRAH_SLUG,
    paymentPlanType: "FULL_COURSE" as const,
    paymentMethod: "STRIPE" as const,
  };
  const saved = await updatePendingRegistration(input);
  assert.equal(saved.paymentRecord.amount, 16000);
  assert.equal(saved.pricing.fullCourseMonths, 8);
  await assert.rejects(
    () =>
      updatePendingRegistration({ ...input, paymentPlanType: "SUBSCRIPTION" }),
    /locked/,
  );
  assert.equal(
    (
      await prisma.payment.findUniqueOrThrow({
        where: { registrationId: legacy.id },
      })
    ).amount,
    16000,
  );
});

test("a queued invitation is not delivered to a student after their payment is refunded", async () => {
  const { order, userId } = await manualOrder();
  process.env.SIRAH_SUPPLIED_GROUP_AUDIENCE = "PAKISTAN";
  process.env.SIRAH_SUPPLIED_GROUP_URL =
    "https://chat.whatsapp.com/SyntheticSuppliedTestInvite";
  const submitted = await evidence(order, userId);
  await approve(submitted);
  const paid = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: order.id },
  });
  await actOnSirahOrder(
    {
      orderId: order.id,
      revision: paid.revision,
      action: "REFUND",
      verifiedAmount: "3500",
      currency: "PKR",
      refundReference: "refund-before-delivery",
      note: "Synthetic verified refund",
    },
    "admin:test",
  );
  process.env.RESEND_API_KEY = "synthetic";
  process.env.EMAIL_FROM = "Test Sender <sender@example.test>";
  const requests: { to: string[]; text: string }[] = [];
  global.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return Response.json({ id: "synthetic-email" });
  };
  await dispatchSirahNotifications(order.id);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  assert.equal(
    requests.filter(
      (r) =>
        r.to.includes(user.email) &&
        r.text.includes("Course group invitation:"),
    ).length,
    0,
  );
  assert.equal(
    await prisma.sirahNotification.count({
      where: {
        orderId: order.id,
        toEmail: user.email,
        kind: "CONFIRMED",
        state: "HELD_ACCESS",
      },
    }),
    1,
  );
});

test("rollout readiness detects an unmigrated schema without changing existing records", async () => {
  const { sirahSchemaAvailable } = await import("../lib/sirah/readiness");
  assert.equal(await sirahSchemaAvailable(), true);
  await prisma.$executeRawUnsafe(
    "RENAME TABLE `SirahOrder` TO `SirahOrder_rollout_test`",
  );
  try {
    assert.equal(await sirahSchemaAvailable(), false);
    assert.equal(await prisma.user.count(), 0);
  } finally {
    await prisma.$executeRawUnsafe(
      "RENAME TABLE `SirahOrder_rollout_test` TO `SirahOrder`",
    );
  }
  assert.equal(await sirahSchemaAvailable(), true);
});

test("paid international invitations stay separate from public groups and use the stored country after first monthly or full upfront settlement", async () => {
  const { courseGroupAudience } = await import("../lib/sirah/config");
  process.env.SIRAH_INTERNATIONAL_GROUP_URL =
    "https://chat.whatsapp.com/SyntheticPaidInternational";
  assert.equal(courseGroupAudience("PK"), "PAKISTAN");
  for (const code of ["GB", "US", "IN", "AE", "DE"])
    assert.equal(courseGroupAudience(code), "INTERNATIONAL");
  assert.equal(
    getGroupInvitation("PK"),
    null,
    "a public Pakistan enquiry group is not a paid course destination",
  );
  for (const plan of ["MONTHLY", "ANNUAL"] as const) {
    const result = await stripeOrder(plan);
    const order = await prisma.sirahOrder.findUniqueOrThrow({
      where: { id: result.orderId },
    });
    assert.equal(canAccessSirah(order), false);
    assert.equal(
      JSON.stringify(await publicSirahOrder(order.id, result.userId)).includes(
        "SyntheticPaidInternational",
      ),
      false,
    );
    await verifySirahStripeSession(
      order.id,
      "cs_synthetic",
      fakeStripe(order).client,
    );
    const paid = await prisma.sirahOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    assert.equal(paid.paidCount, 1);
    assert.equal(canAccessSirah(paid), true);
    assert.equal(
      getGroupInvitation(paid.countryCode),
      "https://chat.whatsapp.com/SyntheticPaidInternational",
    );
    assert.equal(
      JSON.stringify(await publicSirahOrder(order.id, result.userId)).includes(
        "SyntheticPaidInternational",
      ),
      false,
    );
    // Keep the second fixture's provider identities distinct without changing settled financial rows.
    await prisma.sirahOrder.update({
      where: { id: order.id },
      data: {
        providerOrderId: null,
        checkoutToken: null,
        providerSubscriptionId: null,
      },
    });
  }
});

test("dedicated Sīrah checkout creates a monthly subscription and a single annual card payment", async () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://www.tga-awakening.com/";
  for (const plan of ["MONTHLY", "ANNUAL"] as const) {
    process.env.SIRAH_STRIPE_SECRET_KEY = "sk_test_synthetic";
    process.env.SIRAH_STRIPE_WEBHOOK_SECRET = "whsec_synthetic";
    process.env.SIRAH_STRIPE_ACCOUNT_ID = "acct_synthetic";
    process.env.SIRAH_STRIPE_MONTHLY_CURRENCIES = "GBP";
    process.env.SIRAH_STRIPE_ANNUAL_CURRENCIES = "GBP";
    enableManual();
    const result = await create("GB", plan);
    const order = await repriceSirah(
      result.orderId,
      result.userId,
      0,
      "GB",
      plan,
      "STRIPE",
    );
    let captured: Stripe.Checkout.SessionCreateParams | undefined;
    const fake = {
      accounts: { retrieve: async () => ({ id: "acct_synthetic" }) },
      checkout: {
        sessions: {
          create: async (params: Stripe.Checkout.SessionCreateParams) => {
            captured = params;
            return {
              id: `cs_${plan}`,
              url: "https://checkout.stripe.com/synthetic-only",
            };
          },
        },
      },
    } as unknown as Stripe;
    await startSirahCheckout(
      order.id,
      result.userId,
      order.revision,
      approvedTestTerms.version,
      fake,
      "https://tga-awakening.com",
    );
    assert.equal(
      new URL(captured!.success_url!).origin,
      "https://tga-awakening.com",
    );
    assert.equal(
      new URL(captured!.cancel_url!).origin,
      "https://tga-awakening.com",
    );
    assert.equal(
      captured!.mode,
      plan === "MONTHLY" ? "subscription" : "payment",
    );
    assert.deepEqual(captured!.payment_method_types, ["card"]);
    assert.equal(
      captured!.line_items![0].price_data!.unit_amount,
      plan === "MONTHLY" ? 2999 : 32389,
    );
    assert.equal(
      captured!.line_items![0].price_data!.recurring?.interval,
      plan === "MONTHLY" ? "month" : undefined,
    );
    assert.equal(
      (await publicSirahOrder(order.id, result.userId)).paymentState,
      "PROCESSING",
    );
    assert.equal(
      canAccessSirah(
        await prisma.sirahOrder.findUniqueOrThrow({ where: { id: order.id } }),
      ),
      false,
    );
  }
});

test("legacy credentials never enable dedicated Sīrah cards and live needs both approvals", () => {
  enableManual();
  process.env.STRIPE_SECRET_KEY = "sk_test_old_batch_only";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_old_batch_only";
  process.env.SIRAH_STRIPE_ACCOUNT_ID = "acct_synthetic";
  process.env.SIRAH_STRIPE_MONTHLY_CURRENCIES = "GBP";
  assert.equal(methodAvailable("STRIPE", "GB", "GBP", "MONTHLY"), false);
  process.env.SIRAH_STRIPE_SECRET_KEY = "sk_live_synthetic_only";
  process.env.SIRAH_STRIPE_WEBHOOK_SECRET = "whsec_synthetic_only";
  process.env.SIRAH_LIVE_PAYMENTS_APPROVED = "true";
  assert.equal(methodAvailable("STRIPE", "GB", "GBP", "MONTHLY"), false);
  process.env.SIRAH_STRIPE_SANDBOX_VERIFIED = "true";
  assert.equal(methodAvailable("STRIPE", "GB", "GBP", "MONTHLY"), true);
  delete process.env.SIRAH_LIVE_PAYMENTS_APPROVED;
  assert.equal(methodAvailable("STRIPE", "GB", "GBP", "MONTHLY"), false);
});

test("Pakistan monthly selection switches server payable totals and card Checkout charges only the automatic rate", async () => {
  enableManual();
  Object.assign(process.env, {
    SIRAH_STRIPE_SECRET_KEY: "sk_test_synthetic",
    SIRAH_STRIPE_WEBHOOK_SECRET: "whsec_synthetic",
    SIRAH_STRIPE_ACCOUNT_ID: "acct_synthetic",
    SIRAH_STRIPE_MONTHLY_CURRENCIES: "PKR",
    SIRAH_PK_RECURRING_VERIFIED: "true",
  });
  const result = await create("PK", "MONTHLY");
  let order = await publicSirahOrder(result.orderId, result.userId);
  assert.equal(order.amountMinor, 300000);
  assert.equal(order.totalMinor, 3600000);
  order = await repriceSirah(
    order.id,
    result.userId,
    order.revision,
    "PK",
    "MONTHLY",
    "BANK_TRANSFER",
  );
  assert.equal(order.amountMinor, 350000);
  assert.equal(order.totalMinor, 4200000);
  order = await repriceSirah(
    order.id,
    result.userId,
    order.revision,
    "PK",
    "MONTHLY",
    "STRIPE",
  );
  assert.equal(order.amountMinor, 300000);
  assert.equal(order.totalMinor, 3600000);
  let chargedMinor: number | null | undefined;
  const fake = {
    accounts: { retrieve: async () => ({ id: "acct_synthetic" }) },
    checkout: {
      sessions: {
        create: async (params: Stripe.Checkout.SessionCreateParams) => {
          chargedMinor = params.line_items![0].price_data!.unit_amount;
          return {
            id: "cs_pk_synthetic",
            url: "https://checkout.stripe.com/test-only",
          };
        },
      },
    },
  } as unknown as Stripe;
  await startSirahCheckout(
    order.id,
    result.userId,
    order.revision,
    approvedTestTerms.version,
    fake,
  );
  assert.equal(chargedMinor, 300000);
});

test("pending payment email has an expiring scoped link, is deduplicated and resolves the same paid registration", async () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://example.test";
  const result = await create();
  const notice = await prisma.sirahNotification.findFirstOrThrow({
    where: {
      orderId: result.orderId,
      kind: "REGISTERED",
      toEmail: result.input.email,
    },
  });
  const mail = notice.payload as {
    subject: string;
    text: string;
    html: string;
  };
  assert.equal(mail.subject, "Complete your Sīrah registration");
  assert.match(mail.html, />Complete my payment<\/a>/);
  const token = mail.text.match(/#payment=([A-Za-z0-9_-]{43})/)![1];
  assert.ok(token);
  assert.equal(mail.text.includes(`?email=`), false);
  const grant = await resolveSirahResumeToken(token);
  assert.equal(grant?.orderId, result.orderId);
  assert.equal(grant?.order.userId, result.userId);
  assert.equal(grant?.tokenHash, resumeHash(token));
  assert.notEqual(grant?.tokenHash, token);
  assert.equal(await resolveSirahResumeToken(token + "bad"), null);
  await registerSirah(result.input, result.userId);
  assert.equal(
    await prisma.sirahResumeLink.count({ where: { orderId: result.orderId } }),
    1,
  );
  assert.equal(
    await prisma.sirahNotification.count({
      where: {
        orderId: result.orderId,
        kind: "REGISTERED",
        toEmail: result.input.email,
      },
    }),
    1,
  );
  await prisma.$transaction((tx) =>
    queueSirahNotice(tx, result.orderId, "PAYMENT_RESUME", "test-hour"),
  );
  await prisma.$transaction((tx) =>
    queueSirahNotice(tx, result.orderId, "PAYMENT_RESUME", "test-hour"),
  );
  assert.equal(
    await prisma.sirahNotification.count({
      where: { orderId: result.orderId, kind: "PAYMENT_RESUME" },
    }),
    1,
  );
  assert.equal(await prisma.sirahOrder.count(), 1);
  await prisma.sirahOrder.update({
    where: { id: result.orderId },
    data: { paymentState: "PAID" },
  });
  assert.equal(
    (await resolveSirahResumeToken(token))?.order.paymentState,
    "PAID",
  );
  await dispatchSirahNotifications(result.orderId);
  assert.equal(
    (
      await prisma.sirahNotification.findUniqueOrThrow({
        where: { id: notice.id },
      })
    ).state,
    "SUPERSEDED",
  );
  await prisma.$transaction((tx) =>
    queueSirahNotice(tx, result.orderId, "PAYMENT_RESUME", "later-hour"),
  );
  assert.equal(
    await prisma.sirahNotification.count({
      where: { orderId: result.orderId, kind: "PAYMENT_RESUME" },
    }),
    1,
  );
  await prisma.sirahResumeLink.updateMany({
    where: { orderId: result.orderId },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  assert.equal(await resolveSirahResumeToken(token), null);
});

test("combined registration uses server method-specific pricing and rejects unapproved methods before creating an account", async () => {
  const invalid = { ...payload(), method: "STRIPE" as const };
  await assert.rejects(() => registerSirah(invalid), /no longer available/);
  assert.equal(await prisma.user.count(), 0);
  enableManual();
  const input = { ...payload(), method: "BANK_TRANSFER" as const };
  const result = await registerSirah(input);
  const order = await publicSirahOrder(result.orderId, result.userId);
  assert.equal(order.method, "BANK_TRANSFER");
  assert.equal(order.amountMinor, 350000);
  assert.equal(order.terms?.version, approvedTestTerms.version);
  assert.equal(order.paymentState, "UNPAID");
  assert.equal(order.enrolmentState, "PENDING");
  assert.equal(await prisma.registration.count(), 0);
  const again = await registerSirah(input, result.userId);
  assert.equal(again.orderId, order.id);
  assert.equal(await prisma.sirahOrder.count(), 1);
});

test("production apex and www origins are accepted with an internal app URL, while unrelated origins remain denied", () => {
  const internal = "http://new-tga-website.internal:8080/api/sirah/orders";
  const configured = "https://www.tga-awakening.com/";
  assert.equal(
    sirahOriginAllowed("https://tga-awakening.com", internal, configured),
    true,
  );
  assert.equal(
    sirahOriginAllowed("https://www.tga-awakening.com", internal, configured),
    true,
  );
  for (const origin of [
    "https://evil.example",
    "https://tga-awakening.com.evil.example",
    "http://tga-awakening.com",
    "null",
  ])
    assert.equal(sirahOriginAllowed(origin, internal, configured), false);
  assert.equal(
    sirahOriginAllowed(
      "https://tga-awakening.com",
      internal,
      "https://another.example",
    ),
    false,
  );
  assert.equal(
    sirahOriginAllowed(
      "http://localhost:3001",
      "http://localhost:3001/api/sirah/orders",
      "http://localhost:3001",
    ),
    true,
  );
});

test("Pakistan never offers PayPal, including with otherwise configured GBP routes", () => {
  enableManual();
  Object.assign(process.env, {
    PAYPAL_ENV: "sandbox",
    PAYPAL_CLIENT_ID: "synthetic",
    PAYPAL_CLIENT_SECRET: "synthetic",
    SIRAH_PAYPAL_MERCHANT_ID: "MERCHANT_TEST",
    SIRAH_PAYPAL_WEBHOOK_ID: "WEBHOOK_TEST",
    SIRAH_PAYPAL_PRODUCT_ID: "PROD_TEST",
    SIRAH_PAYPAL_MONTHLY_CURRENCIES: "GBP",
    SIRAH_PAYPAL_ANNUAL_CURRENCIES: "GBP",
  });
  assert.equal(methodAvailable("PAYPAL", "PK", "GBP", "MONTHLY"), false);
  assert.equal(methodAvailable("PAYPAL", "PK", "GBP", "ANNUAL"), false);
  assert.equal(methodAvailable("PAYPAL", "GB", "GBP", "MONTHLY"), true);
});

test("PayPal reuses only a fully matching Sīrah plan and leaves incompatible preferred plans untouched", async () => {
  const plan = (id: string, outstanding = false) => ({
    id,
    status: "ACTIVE",
    product_id: "PROD_TEST",
    quantity_supported: false,
    billing_cycles: [
      {
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 12,
        frequency: { interval_unit: "MONTH", interval_count: 1 },
        pricing_scheme: {
          fixed_price: { currency_code: "GBP", value: "29.99" },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: outstanding,
      payment_failure_threshold: 1,
      setup_fee: { currency_code: "GBP", value: "0.00" },
    },
    taxes: null,
  });
  for (const outstanding of [false, true]) {
    enableManual();
    Object.assign(process.env, {
      PAYPAL_ENV: "sandbox",
      PAYPAL_CLIENT_ID: "synthetic",
      PAYPAL_CLIENT_SECRET: "synthetic",
      SIRAH_PAYPAL_MERCHANT_ID: "MERCHANT_TEST",
      SIRAH_PAYPAL_WEBHOOK_ID: "WEBHOOK_TEST",
      SIRAH_PAYPAL_PRODUCT_ID: "PROD_TEST",
      SIRAH_PAYPAL_MONTHLY_CURRENCIES: "GBP",
      SIRAH_PAYPAL_MONTHLY_PLAN_GBP: "P-PREFERRED",
    });
    const result = await create("GB");
    const order = await repriceSirah(
      result.orderId,
      result.userId,
      0,
      "GB",
      "MONTHLY",
      "PAYPAL",
    );
    let created = 0;
    let selected: unknown;
    let createBody: Record<string, unknown> | undefined;
    global.fetch = async (raw, init) => {
      const url = String(raw);
      const method = init?.method || "GET";
      const response = (data: unknown) =>
        new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" },
        });
      if (url.endsWith("/v1/oauth2/token"))
        return response({ access_token: "synthetic" });
      if (url.endsWith("/v1/billing/plans/P-PREFERRED") && method === "GET")
        return response(plan("P-PREFERRED", outstanding));
      if (url.endsWith("/v1/billing/plans") && method === "POST") {
        created++;
        createBody = JSON.parse(String(init?.body));
        return response(plan("P-NEW"));
      }
      if (url.endsWith("/v1/billing/plans/P-NEW") && method === "GET")
        return response(plan("P-NEW"));
      if (url.endsWith("/v1/billing/subscriptions") && method === "POST") {
        selected = JSON.parse(String(init?.body)).plan_id;
        return response({
          id: `I-TEST-${outstanding}`,
          links: [
            {
              rel: "approve",
              href: "https://www.sandbox.paypal.com/synthetic-approval",
            },
          ],
        });
      }
      throw new Error(`Unexpected provider test request: ${method} ${url}`);
    };
    await startSirahCheckout(
      order.id,
      result.userId,
      order.revision,
      approvedTestTerms.version,
    );
    assert.equal(created, outstanding ? 1 : 0);
    assert.equal(selected, outstanding ? "P-NEW" : "P-PREFERRED");
    const stored = await publicSirahOrder(order.id, result.userId);
    assert.equal(stored.paymentState, "PROCESSING");
    assert.equal(stored.paidMinor, 0);
    assert.equal(stored.enrolmentState, "PENDING");
    if (outstanding) {
      assert.equal(createBody?.product_id, "PROD_TEST");
      assert.equal(createBody?.status, "ACTIVE");
      assert.equal(createBody?.quantity_supported, false);
      assert.deepEqual(createBody?.payment_preferences, {
        auto_bill_outstanding: false,
        payment_failure_threshold: 1,
      });
    }
  }
});

test("PayPal upfront rejects an altered approved quote before capturing any funds", async () => {
  enableManual();
  Object.assign(process.env, {
    PAYPAL_ENV: "sandbox",
    PAYPAL_CLIENT_ID: "synthetic",
    PAYPAL_CLIENT_SECRET: "synthetic",
    SIRAH_PAYPAL_MERCHANT_ID: "MERCHANT_TEST",
    SIRAH_PAYPAL_WEBHOOK_ID: "WEBHOOK_TEST",
    SIRAH_PAYPAL_ANNUAL_CURRENCIES: "GBP",
  });
  const result = await create("GB", "ANNUAL");
  const order = await repriceSirah(
    result.orderId,
    result.userId,
    0,
    "GB",
    "ANNUAL",
    "PAYPAL",
  );
  await prisma.sirahOrder.update({
    where: { id: order.id },
    data: { providerOrderId: "PP-QUOTE-TEST", paymentState: "PROCESSING" },
  });
  let captures = 0;
  for (const bad of ["merchant", "amount", "currency"]) {
    global.fetch = async (raw, init) => {
      const url = String(raw);
      const response = (data: unknown) =>
        new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" },
        });
      if (url.endsWith("/v1/oauth2/token"))
        return response({ access_token: "synthetic" });
      if (url.endsWith("/v2/checkout/orders/PP-QUOTE-TEST"))
        return response({
          id: "PP-QUOTE-TEST",
          status: "APPROVED",
          purchase_units: [
            {
              custom_id: order.id,
              payee: {
                merchant_id:
                  bad === "merchant" ? "WRONG_MERCHANT" : "MERCHANT_TEST",
              },
              amount: {
                currency_code: bad === "currency" ? "USD" : "GBP",
                value: bad === "amount" ? "1.00" : "323.89",
              },
            },
          ],
        });
      if (url.endsWith("/capture") && init?.method === "POST") {
        captures++;
        throw new Error("Capture must not be called for an altered quote.");
      }
      throw new Error(`Unexpected provider request: ${url}`);
    };
    await assert.rejects(
      () => verifySirahPaypal(order.id, "PP-QUOTE-TEST", true),
      /merchant, amount or currency/,
    );
  }
  assert.equal(captures, 0);
  const pending = await publicSirahOrder(order.id, result.userId);
  assert.equal(pending.paidMinor, 0);
  assert.equal(pending.enrolmentState, "PENDING");
});

test("a verified PayPal order-approval webhook uses existing capture checks and duplicate delivery enrols once", async () => {
  enableManual();
  Object.assign(process.env, {
    PAYPAL_ENV: "sandbox",
    PAYPAL_CLIENT_ID: "synthetic",
    PAYPAL_CLIENT_SECRET: "synthetic",
    SIRAH_PAYPAL_MERCHANT_ID: "MERCHANT_TEST",
    SIRAH_PAYPAL_WEBHOOK_ID: "WEBHOOK_TEST",
    SIRAH_PAYPAL_ANNUAL_CURRENCIES: "GBP",
  });
  const result = await create("GB", "ANNUAL");
  const order = await repriceSirah(
    result.orderId,
    result.userId,
    0,
    "GB",
    "ANNUAL",
    "PAYPAL",
  );
  await prisma.sirahOrder.update({
    where: { id: order.id },
    data: { providerOrderId: "PP-APPROVED-HOOK", paymentState: "PROCESSING" },
  });
  let captures = 0;
  const payment = () => ({
    id: "PP-APPROVED-HOOK",
    status: captures ? "COMPLETED" : "APPROVED",
    purchase_units: [
      {
        custom_id: order.id,
        payee: { merchant_id: "MERCHANT_TEST" },
        amount: { currency_code: "GBP", value: "323.89" },
        ...(captures
          ? {
              payments: {
                captures: [
                  {
                    id: "CAPTURE-APPROVED-HOOK",
                    status: "COMPLETED",
                    amount: { currency_code: "GBP", value: "323.89" },
                  },
                ],
              },
            }
          : {}),
      },
    ],
  });
  global.fetch = async (raw, init) => {
    const url = String(raw);
    const response = (data: unknown) =>
      new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      });
    if (url.endsWith("/v1/oauth2/token"))
      return response({ access_token: "synthetic" });
    if (url.endsWith("/v1/notifications/verify-webhook-signature"))
      return response({ verification_status: "SUCCESS" });
    if (url.endsWith("/v2/checkout/orders/PP-APPROVED-HOOK"))
      return response(payment());
    if (
      url.endsWith("/v2/checkout/orders/PP-APPROVED-HOOK/capture") &&
      init?.method === "POST"
    ) {
      captures++;
      return response(payment());
    }
    throw new Error(`Unexpected provider request: ${url}`);
  };
  const request = () =>
    new Request("https://example.test/api/sirah/webhooks/paypal", {
      method: "POST",
      body: JSON.stringify({
        id: "EVENT-APPROVED-HOOK",
        event_type: "CHECKOUT.ORDER.APPROVED",
        resource: { id: "PP-APPROVED-HOOK" },
      }),
    });
  await handleSirahPaypalWebhook(request());
  await handleSirahPaypalWebhook(request());
  assert.equal(captures, 1);
  const paid = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: order.id },
  });
  assert.equal(paid.paymentState, "PAID");
  assert.equal(paid.paidCount, 1);
  assert.equal(paid.enrolmentState, "ACTIVE");
  assert.equal(
    await prisma.enrollment.count({ where: { userId: result.userId } }),
    1,
  );
});
