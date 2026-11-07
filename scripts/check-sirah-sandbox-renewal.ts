import Stripe from "stripe";
import { parseArgs } from "node:util";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
async function main() {
  const { values } = parseArgs({
    options: { clock: { type: "string" }, subscription: { type: "string" } },
  });
  const key = process.env.SIRAH_SANDBOX_STRIPE_SECRET_KEY || "";
  const expectedAccount = process.env.SIRAH_SANDBOX_STRIPE_ACCOUNT_ID;
  requireValue(
    /^(sk|rk)_test_/.test(key),
    "A sandbox test API key is required; live keys are refused.",
  );
  requireValue(
    expectedAccount?.startsWith("acct_"),
    "Set SIRAH_SANDBOX_STRIPE_ACCOUNT_ID to the intended sandbox account.",
  );
  requireValue(
    values.clock?.startsWith("clock_") &&
      values.subscription?.startsWith("sub_"),
    "Supply --clock and --subscription for the tagged synthetic test resources.",
  );
  const stripe = new Stripe(key);
  const [account, balance] = await Promise.all([
    stripe.accounts.retrieve(),
    stripe.balance.retrieve(),
  ]);
  requireValue(
    account.id === expectedAccount && balance.livemode === false,
    "Sandbox merchant/mode mismatch; no clock was changed.",
  );
  let clock = await stripe.testHelpers.testClocks.retrieve(values.clock!);
  let subscription = await stripe.subscriptions.retrieve(values.subscription!);
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const customer = await stripe.customers.retrieve(customerId);
  requireValue(!customer.deleted, "Synthetic customer no longer exists.");
  if (customer.deleted) return;
  const customerClock =
    typeof customer.test_clock === "string"
      ? customer.test_clock
      : customer.test_clock?.id;
  requireValue(
    customerClock === clock.id && clock.name?.startsWith("tga-sirah-"),
    "The subscription must belong to the tagged TGA test clock.",
  );
  requireValue(
    customer.metadata.integration === "tga_sirah_verification" &&
      subscription.metadata.integration === "tga_sirah_verification",
    "Only synthetic TGA verification resources may be advanced.",
  );
  requireValue(
    customer.metadata.test_run === clock.name &&
      subscription.metadata.test_run === clock.name,
    "Synthetic resource ownership mismatch.",
  );
  requireValue(
    subscription.items.data.length === 1 &&
      subscription.items.data[0].price.currency === "pkr" &&
      subscription.items.data[0].price.unit_amount === 300000 &&
      subscription.items.data[0].price.recurring?.interval === "month",
    "Expected exactly one PKR 3,000 monthly item.",
  );
  requireValue(
    subscription.automatic_tax.enabled === false,
    "This run requires the approved tax-off sandbox setting.",
  );
  const invoices = async () =>
    (await stripe.invoices.list({ subscription: subscription.id, limit: 100 }))
      .data;
  let list = await invoices();
  const first = list.find(
    (invoice) =>
      invoice.billing_reason === "subscription_create" &&
      invoice.status === "paid",
  );
  requireValue(
    first?.amount_paid === 300000 && first.currency === "pkr",
    "The first PKR 3,000 invoice must already be paid.",
  );
  const paidRenewal = () =>
    list.find(
      (invoice) =>
        invoice.billing_reason === "subscription_cycle" &&
        invoice.status === "paid",
    );
  async function ready() {
    for (let attempt = 0; attempt < 60; attempt++) {
      clock = await stripe.testHelpers.testClocks.retrieve(clock.id);
      if (clock.status === "ready") return;
      requireValue(
        clock.status !== "internal_failure",
        "Stripe test clock failed; no verification flag was changed.",
      );
      await wait(1000);
    }
    throw new Error("Timed out waiting for Stripe test clock readiness.");
  }
  await ready();
  if (!paidRenewal()) {
    const pendingCycle = list.find(
      (invoice) =>
        invoice.billing_reason === "subscription_cycle" &&
        ["draft", "open"].includes(invoice.status || ""),
    );
    if (!pendingCycle) {
      const boundary = subscription.items.data[0].current_period_end;
      requireValue(
        boundary > clock.frozen_time,
        "The next billing boundary must be ahead of the test clock.",
      );
      await stripe.testHelpers.testClocks.advance(clock.id, {
        frozen_time: boundary + 1,
      });
      await ready();
    }
    list = await invoices();
    if (!paidRenewal()) {
      // A second, small advance allows automatic invoice finalisation without another billing cycle.
      subscription = await stripe.subscriptions.retrieve(subscription.id);
      const finaliseAt = clock.frozen_time + 7200;
      requireValue(
        finaliseAt < subscription.items.data[0].current_period_end,
        "Refusing to advance into another monthly billing cycle.",
      );
      await stripe.testHelpers.testClocks.advance(clock.id, {
        frozen_time: finaliseAt,
      });
      await ready();
      for (let attempt = 0; attempt < 30 && !paidRenewal(); attempt++) {
        list = await invoices();
        if (!paidRenewal()) await wait(1000);
      }
    }
  }
  const renewal = paidRenewal();
  requireValue(
    renewal?.amount_paid === 300000 && renewal.currency === "pkr",
    "A paid PKR 3,000 renewal was not verified.",
  );
  console.log(
    JSON.stringify(
      {
        scope: "Stripe sandbox renewal only",
        accountId: account.id,
        livemode: false,
        clockId: clock.id,
        subscriptionId: subscription.id,
        firstInvoice: {
          id: first!.id,
          status: first!.status,
          amountPaidMinor: first!.amount_paid,
        },
        renewalInvoice: {
          id: renewal!.id,
          status: renewal!.status,
          amountPaidMinor: renewal!.amount_paid,
        },
        currency: "PKR",
        applicationWebhookVerified: false,
        applicationEnrolmentVerified: false,
        approvalFlagsChanged: false,
      },
      null,
      2,
    ),
  );
}
main().catch((error: unknown) => {
  const e = error as { message?: string; code?: string; type?: string };
  const key = process.env.SIRAH_SANDBOX_STRIPE_SECRET_KEY || "";
  let message = e.message || "Sandbox verification failed.";
  if (key) message = message.split(key).join("[redacted]");
  message = message.replace(
    /(?:sk|rk)_(?:test|live)_[A-Za-z0-9_]+|whsec_[A-Za-z0-9_]+/g,
    "[redacted]",
  );
  console.error(
    JSON.stringify({
      error: message.slice(0, 600),
      code: e.code,
      type: e.type,
      approvalFlagsChanged: false,
    }),
  );
  process.exitCode = 1;
});
