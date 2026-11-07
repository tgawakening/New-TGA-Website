import "server-only";
import { paypalPlanIssue } from "@/lib/sirah/paypal-plan";
import { sirahOriginAllowed } from "@/lib/sirah/origin";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { type SirahOrder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  SIRAH_TITLE,
  minorToDecimal,
  decimalToMinor,
  type SirahPlan,
} from "@/lib/sirah/catalog";
import { methodAvailable, termsFor } from "@/lib/sirah/config";
import {
  ownedSirahOrder,
  auditSirah,
  SirahError,
} from "./sirah-registration.service";
import {
  addMonthsClamped,
  serializable,
  confirmSirahPayment,
} from "./sirah-confirmation.service";
import {
  queueSirahNotice,
  dispatchSirahNotifications,
} from "./sirah-notifications.service";
const appUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
export function stripeClient() {
  if (!process.env.SIRAH_STRIPE_SECRET_KEY)
    throw new SirahError("Stripe is not configured.", 503);
  return new Stripe(process.env.SIRAH_STRIPE_SECRET_KEY);
}
async function verifyStripeMerchant(stripe: Stripe) {
  const account = await stripe.accounts.retrieve();
  if (account.id !== process.env.SIRAH_STRIPE_ACCOUNT_ID)
    throw new SirahError(
      "Stripe merchant identity does not match the configured account.",
    );
}
const paypalBase = () =>
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
async function paypalToken() {
  const r = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID || ""}:${process.env.PAYPAL_CLIENT_SECRET || ""}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new SirahError("PayPal authentication failed.", 502);
  return (await r.json()).access_token as string;
}
export async function paypalRequest(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
) {
  const token = await paypalToken();
  const response = await fetch(`${paypalBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(key ? { "PayPal-Request-Id": key } : {}),
      Prefer: "return=representation",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok)
    throw new SirahError(
      `PayPal ${method} request failed (${response.status}).`,
      502,
    );
  return response.status === 204 ? null : await response.json();
}
export function paypalDecimal(amount: number, currency: string) {
  if (currency === "HUF") {
    if (amount % 100)
      throw new SirahError("PayPal does not support this amount's precision.");
    return String(amount / 100);
  }
  return minorToDecimal(amount, currency);
}
export async function startSirahCheckout(
  id: string,
  userId: string,
  revision: number,
  acceptedVersion: string,
  stripeOverride?: Stripe,
  requestedReturnOrigin?: string,
) {
  if (
    requestedReturnOrigin &&
    !sirahOriginAllowed(requestedReturnOrigin, appUrl(), appUrl())
  )
    throw new SirahError("This payment return address is not approved.", 403);
  const checkoutBase = requestedReturnOrigin || appUrl();
  let order = await ownedSirahOrder(id, userId);
  if (!["STRIPE", "PAYPAL"].includes(order.method || ""))
    throw new SirahError("Select an available online method first.");
  const method = order.method as "STRIPE" | "PAYPAL";
  if (
    !methodAvailable(
      method,
      order.countryCode,
      order.currency,
      order.plan as SirahPlan,
      { id: order.id, amountMinor: order.amountMinor },
    )
  )
    throw new SirahError("This checkout route is not currently enabled.");
  const terms = termsFor(order.plan as SirahPlan);
  if (
    !terms ||
    terms.version !== acceptedVersion ||
    (order.terms as { version?: string } | null)?.version !== terms.version
  )
    throw new SirahError("Review and accept the current payment terms.");
  if (order.paymentState !== "PROCESSING") {
    const token = randomUUID();
    const result = await prisma.sirahOrder.updateMany({
      where: {
        id,
        userId,
        revision,
        paymentState: { in: ["UNPAID", "FAILED"] },
        providerOrderId: null,
        providerSubscriptionId: null,
      },
      data: {
        checkoutToken: token,
        paymentState: "PROCESSING",
        revision: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new SirahError(
        "This order has changed or is already paid. Reload to continue.",
        409,
      );
    order = await ownedSirahOrder(id, userId);
    await prisma.$transaction((tx) =>
      auditSirah(tx, id, `student:${userId}`, "TERMS_ACCEPTED", {
        version: acceptedVersion,
        checkoutToken: token,
      }),
    );
  }
  if (!order.checkoutToken)
    throw new SirahError("Checkout is awaiting reconciliation.", 409);
  // A saved provider reference is retrieved, never recreated after an
  // idempotency key expires. Unknown attempts require reconciliation after 20h.
  if (method === "STRIPE" && order.providerOrderId) {
    const stripe = stripeOverride || stripeClient();
    await verifyStripeMerchant(stripe);
    const existing = await stripe.checkout.sessions.retrieve(
      order.providerOrderId,
    );
    if (
      existing.metadata?.sirahOrderId !== order.id ||
      existing.metadata.checkoutToken !== order.checkoutToken
    )
      throw new SirahError("Checkout ownership mismatch.");
    if (existing.payment_status === "paid") {
      await verifySirahStripeSession(order.id, existing.id, stripe);
      return { url: `${checkoutBase}/seerah/register?order=${order.id}` };
    }
    if (existing.status === "expired")
      throw new SirahError(
        "This checkout has expired. Close the unpaid checkout before changing payment method.",
        409,
      );
    if (!existing.url)
      throw new SirahError(
        "The provider is processing the payment. Check verified status instead.",
        409,
      );
    return { url: existing.url };
  }
  if (
    method === "PAYPAL" &&
    (order.providerOrderId || order.providerSubscriptionId)
  ) {
    const existing = await paypalRequest(
      order.providerOrderId
        ? `/v2/checkout/orders/${order.providerOrderId}`
        : `/v1/billing/subscriptions/${order.providerSubscriptionId}`,
    );
    const url = existing.links?.find(
      (link: { rel: string }) => link.rel === "approve",
    )?.href;
    return {
      url:
        url ||
        `${checkoutBase}/seerah/register?order=${order.id}&payment=processing`,
    };
  }
  const attempt = await prisma.sirahAudit.findFirst({
    where: { orderId: order.id, action: "TERMS_ACCEPTED" },
    orderBy: { createdAt: "desc" },
  });
  if (
    Date.now() - (attempt?.createdAt || order.updatedAt).getTime() >
    20 * 3600000
  ) {
    await prisma.$transaction((tx) =>
      queueSirahNotice(tx, order.id, "CHECKOUT_REVIEW", order.checkoutToken!),
    );
    await dispatchSirahNotifications(order.id).catch(() => {});
    throw new SirahError(
      "The earlier checkout needs provider reconciliation. A duplicate payment has not been created.",
      409,
    );
  }
  const returnUrl = `${checkoutBase}/seerah/register?order=${order.id}&payment=processing`;
  if (method === "STRIPE") {
    const stripe = stripeOverride || stripeClient();
    await verifyStripeMerchant(stripe);
    const session = await stripe.checkout.sessions.create(
      {
        mode: order.plan === "ANNUAL" ? "payment" : "subscription",
        payment_method_types: ["card"],
        client_reference_id: order.id,
        success_url: `${returnUrl}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${checkoutBase}/seerah/register?order=${order.id}`,
        metadata: {
          sirahOrderId: order.id,
          checkoutToken: order.checkoutToken,
        },
        ...(order.plan === "ANNUAL"
          ? {
              payment_intent_data: {
                metadata: {
                  sirahOrderId: order.id,
                  checkoutToken: order.checkoutToken,
                },
              },
            }
          : {}),
        ...(order.plan === "MONTHLY"
          ? {
              subscription_data: {
                metadata: {
                  sirahOrderId: order.id,
                  checkoutToken: order.checkoutToken,
                },
              },
            }
          : {}),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: order.currency.toLowerCase(),
              unit_amount: order.amountMinor,
              product_data: { name: SIRAH_TITLE },
              ...(order.plan === "MONTHLY"
                ? { recurring: { interval: "month" as const } }
                : {}),
            },
          },
        ],
      },
      { idempotencyKey: `sirah:${order.checkoutToken}` },
    );
    await prisma.sirahOrder.updateMany({
      where: { id, checkoutToken: order.checkoutToken },
      data: {
        providerOrderId: session.id,
        ...(typeof session.subscription === "string"
          ? { providerSubscriptionId: session.subscription }
          : {}),
      },
    });
    return { url: session.url };
  }
  if (order.plan === "ANNUAL") {
    const payment = await paypalRequest(
      "/v2/checkout/orders",
      "POST",
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: order.id,
            custom_id: order.id,
            payee: { merchant_id: process.env.SIRAH_PAYPAL_MERCHANT_ID },
            amount: {
              currency_code: order.currency,
              value: paypalDecimal(order.amountMinor, order.currency),
            },
            description: SIRAH_TITLE,
          },
        ],
        application_context: {
          return_url: returnUrl,
          cancel_url: `${checkoutBase}/seerah/register?order=${order.id}`,
        },
      },
      `sirah-${order.checkoutToken}`,
    );
    await prisma.sirahOrder.updateMany({
      where: { id, checkoutToken: order.checkoutToken },
      data: { providerOrderId: payment.id },
    });
    return {
      url: payment.links?.find((l: { rel: string }) => l.rel === "approve")
        ?.href,
    };
  }
  let planId = order.providerPlanId;
  const expectedPlan = {
    productId: process.env.SIRAH_PAYPAL_PRODUCT_ID || "",
    currency: order.currency,
    amountMinor: order.amountMinor,
  };
  const preferredPlanId =
    process.env[`SIRAH_PAYPAL_MONTHLY_PLAN_${order.currency}`];
  if (!planId) {
    if (!preferredPlanId)
      throw new SirahError("A verified reusable PayPal plan is not configured for this currency.", 409);
    const preferred = await paypalRequest(
      `/v1/billing/plans/${encodeURIComponent(preferredPlanId)}`,
    );
    const preferredIssue = paypalPlanIssue(preferred, expectedPlan);
    if (preferredIssue || preferred.id !== preferredPlanId)
      throw new SirahError(preferredIssue || "Preferred plan identity mismatch.", 409);
    planId = preferredPlanId;
  }
  const plan = await paypalRequest(
    `/v1/billing/plans/${encodeURIComponent(planId!)}`,
  );
  const issue = paypalPlanIssue(plan, expectedPlan);
  if (issue || plan.id !== planId)
    throw new SirahError(issue || "PayPal plan identity mismatch.");
  if (!order.providerPlanId)
    await prisma.$transaction(async (tx) => {
      const selected = await tx.sirahOrder.updateMany({
        where: { id, checkoutToken: order.checkoutToken },
        data: { providerPlanId: planId },
      });
      if (selected.count !== 1)
        throw new SirahError(
          "Checkout changed before the plan was selected.",
          409,
        );
      await auditSirah(tx, id, `student:${userId}`, "PAYPAL_PLAN_SELECTED", {
        planId,
        reused: true,
      });
    });
  const subscription = await paypalRequest(
    "/v1/billing/subscriptions",
    "POST",
    {
      plan_id: planId,
      custom_id: order.id,
      application_context: {
        brand_name: "The Global Awakening",
        return_url: returnUrl,
        cancel_url: `${checkoutBase}/seerah/register?order=${order.id}`,
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
      },
    },
    `sub-${order.checkoutToken}`,
  );
  await prisma.sirahOrder.updateMany({
    where: { id, checkoutToken: order.checkoutToken },
    data: { providerSubscriptionId: subscription.id },
  });
  return {
    url: subscription.links?.find((l: { rel: string }) => l.rel === "approve")
      ?.href,
  };
}
export async function verifySirahStripeSession(
  orderId: string,
  sessionId: string,
  stripe = stripeClient(),
) {
  const order = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: orderId },
  });
  if (order.method !== "STRIPE") throw new SirahError("Wrong provider.");
  await verifyStripeMerchant(stripe);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (
    session.metadata?.sirahOrderId !== order.id ||
    session.metadata?.checkoutToken !== order.checkoutToken ||
    session.client_reference_id !== order.id ||
    (order.providerOrderId && session.id !== order.providerOrderId)
  )
    throw new SirahError("Stripe session ownership mismatch.");
  if (!order.providerOrderId)
    await prisma.sirahOrder.updateMany({
      where: {
        id: order.id,
        checkoutToken: order.checkoutToken,
        providerOrderId: null,
      },
      data: { providerOrderId: session.id },
    });
  if (session.payment_status !== "paid" || session.status !== "complete")
    return { state: "PROCESSING" };
  if (
    session.currency?.toUpperCase() !== order.currency ||
    session.amount_total !== order.amountMinor
  )
    throw new SirahError("Stripe amount or currency mismatch.");
  if (order.plan === "ANNUAL") {
    if (session.mode !== "payment" || session.subscription)
      throw new SirahError("Annual orders must not create recurring billing.");
    const intent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!intent)
      throw new SirahError("Payment settlement is not yet available.");
    await confirmSirahPayment({
      orderId,
      eventId: `stripe:payment:${intent}`,
      provider: "STRIPE",
      amountMinor: session.amount_total,
      currency: order.currency,
      actor: "provider:stripe",
    });
  } else {
    if (session.mode !== "subscription")
      throw new SirahError("Wrong Stripe billing mode.");
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    if (!subId) throw new SirahError("Subscription is not available yet.");
    const sub = await stripe.subscriptions.retrieve(subId);
    if (
      sub.metadata.sirahOrderId !== order.id ||
      sub.metadata.checkoutToken !== order.checkoutToken
    )
      throw new SirahError("Subscription ownership mismatch.");
    const end =
      order.programmeEnd ||
      addMonthsClamped(new Date(sub.start_date * 1000), 12);
    await stripe.subscriptions.update(
      subId,
      {
        cancel_at: Math.floor(end.getTime() / 1000),
        proration_behavior: "none",
      },
      { idempotencyKey: `sirah-end:${order.id}` },
    );
    await prisma.sirahOrder.update({
      where: { id: order.id },
      data: {
        providerSubscriptionId: subId,
        providerCustomerId:
          typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        programmeStart: new Date(sub.start_date * 1000),
        programmeEnd: end,
      },
    });
    const invoiceId =
      typeof session.invoice === "string"
        ? session.invoice
        : session.invoice?.id;
    if (!invoiceId) return { state: "PROCESSING" };
    await verifySirahStripeInvoice(order.id, invoiceId, stripe);
  }
  return { state: "PAID" };
}
export async function verifySirahStripeInvoice(
  orderId: string,
  invoiceId: string,
  stripe = stripeClient(),
) {
  await verifyStripeMerchant(stripe);
  const order = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: orderId },
  });
  const invoice = await stripe.invoices.retrieve(invoiceId);
  const subscription = invoice.parent?.subscription_details?.subscription;
  const subId =
    typeof subscription === "string" ? subscription : subscription?.id;
  if (!subId || subId !== order.providerSubscriptionId)
    throw new SirahError("Invoice does not belong to this subscription.");
  if (
    invoice.status !== "paid" ||
    invoice.amount_paid !== order.amountMinor ||
    invoice.currency.toUpperCase() !== order.currency
  )
    throw new SirahError(
      "Invoice is not settled for the locked amount and currency.",
    );
  await confirmSirahPayment({
    orderId,
    eventId: `stripe:invoice:${invoice.id}`,
    provider: "STRIPE",
    amountMinor: invoice.amount_paid,
    currency: invoice.currency.toUpperCase(),
    actor: "provider:stripe",
  });
  const subscriptionRecord = await stripe.subscriptions.retrieve(subId);
  const periodEnd = subscriptionRecord.items?.data[0]?.current_period_end;
  if (typeof periodEnd === "number")
    await prisma.sirahOrder.updateMany({
      where: {
        id: orderId,
        paidCount: { lt: 12 },
        cancelledAt: null,
        enrolmentState: "ACTIVE",
      },
      data: { nextBillingAt: new Date(periodEnd * 1000) },
    });
}
export async function verifySirahPaypal(
  orderId: string,
  providerId: string,
  capture = false,
) {
  const order = await prisma.sirahOrder.findUniqueOrThrow({
    where: { id: orderId },
  });
  if (order.method !== "PAYPAL") throw new SirahError("Wrong provider.");
  if (order.plan === "ANNUAL") {
    if (order.providerOrderId && providerId !== order.providerOrderId)
      throw new SirahError("PayPal order ownership mismatch.");
    let payment = await paypalRequest(`/v2/checkout/orders/${providerId}`);
    if (payment.status === "APPROVED" && capture) {
      const quote = payment.purchase_units?.[0];
      if (
        payment.purchase_units?.length !== 1 ||
        quote?.custom_id !== order.id ||
        quote.payee?.merchant_id !== process.env.SIRAH_PAYPAL_MERCHANT_ID ||
        quote.amount?.currency_code !== order.currency ||
        decimalToMinor(quote.amount.value, order.currency) !== order.amountMinor
      )
        throw new SirahError(
          "PayPal approved order merchant, amount or currency differs from the registration quote.",
        );
      payment = await paypalRequest(
        `/v2/checkout/orders/${providerId}/capture`,
        "POST",
        {},
        `capture-${order.checkoutToken}`,
      );
    }
    const unit = payment.purchase_units?.[0];
    const settlement = unit?.payments?.captures?.[0];
    if (
      payment.purchase_units?.length !== 1 ||
      unit?.custom_id !== order.id ||
      unit.payee?.merchant_id !== process.env.SIRAH_PAYPAL_MERCHANT_ID
    )
      throw new SirahError("PayPal merchant or order identity mismatch.");
    if (
      payment.status !== "COMPLETED" ||
      !(
        settlement?.status === "COMPLETED" ||
        (order.paymentState === "REFUND_PENDING" &&
          ["REFUNDED", "PARTIALLY_REFUNDED"].includes(settlement?.status))
      )
    )
      return { state: "PROCESSING" };
    if (
      settlement.amount.currency_code !== order.currency ||
      decimalToMinor(settlement.amount.value, order.currency) !==
        order.amountMinor
    )
      throw new SirahError("PayPal settlement amount or currency mismatch.");
    await confirmSirahPayment({
      orderId,
      eventId: `paypal:capture:${settlement.id}`,
      provider: "PAYPAL",
      amountMinor: order.amountMinor,
      currency: order.currency,
      actor: "provider:paypal",
    });
    return { state: "PAID" };
  }
  if (
    order.providerSubscriptionId &&
    providerId !== order.providerSubscriptionId
  )
    throw new SirahError("PayPal subscription ownership mismatch.");
  const sub = await paypalRequest(`/v1/billing/subscriptions/${providerId}`);
  if (sub.custom_id !== order.id || sub.plan_id !== order.providerPlanId)
    throw new SirahError("PayPal plan or subscription ownership mismatch.");
  const start =
    order.programmeStart || new Date(sub.start_time || order.createdAt);
  const end = order.programmeEnd || addMonthsClamped(start, 12);
  if (!order.programmeStart)
    await prisma.sirahOrder.update({
      where: { id: order.id },
      data: { programmeStart: start, programmeEnd: end },
    });
  const endTime = new Date(Math.min(Date.now(), end.getTime())).toISOString();
  const transactions = await paypalRequest(
    `/v1/billing/subscriptions/${providerId}/transactions?start_time=${encodeURIComponent(start.toISOString())}&end_time=${encodeURIComponent(endTime)}`,
  );
  let paid = false;
  for (const transaction of transactions.transactions || []) {
    if (
      transaction.status !== "COMPLETED" &&
      !(
        order.paymentState === "REFUND_PENDING" &&
        ["REFUNDED", "PARTIALLY_REFUNDED"].includes(transaction.status)
      )
    )
      continue;
    const gross = transaction.amount_with_breakdown?.gross_amount;
    if (
      !gross ||
      gross.currency_code !== order.currency ||
      decimalToMinor(gross.value, order.currency) !== order.amountMinor
    )
      throw new SirahError(
        "PayPal subscription settlement amount or currency mismatch.",
      );
    await confirmSirahPayment({
      orderId,
      eventId: `paypal:sale:${transaction.id}`,
      provider: "PAYPAL",
      amountMinor: order.amountMinor,
      currency: order.currency,
      actor: "provider:paypal",
    });
    paid = true;
  }
  const providerNext = sub.billing_info?.next_billing_time;
  if (paid && providerNext && Number.isFinite(Date.parse(providerNext)))
    await prisma.sirahOrder.updateMany({
      where: {
        id: order.id,
        paidCount: { lt: 12 },
        cancelledAt: null,
        enrolmentState: "ACTIVE",
      },
      data: { nextBillingAt: new Date(providerNext) },
    });
  return { state: paid ? "PAID" : "PROCESSING" };
}
export async function markSirahProviderFailure(
  order: SirahOrder,
  eventId: string,
) {
  await serializable(async (tx) => {
    if (await tx.sirahPaymentEvent.findUnique({ where: { id: eventId } }))
      return;
    const current = await tx.sirahOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    if (
      !!current.cancelledAt ||
      ["REFUNDED"].includes(current.paymentState) ||
      ["CANCELLED", "COMPLETED"].includes(current.enrolmentState)
    )
      return;
    await tx.sirahPaymentEvent.create({
      data: {
        id: eventId,
        orderId: order.id,
        provider: order.method!,
        amountMinor: 0,
        currency: order.currency,
        kind: "FAILED",
      },
    });
    const terms = current.terms as import("@/lib/sirah/config").SirahTerms | null;
    const days = terms?.failedPaymentGraceDays || 0;
    const now = new Date();
    const due = current.nextBillingAt || now;
    const graceEnd = current.paymentState === "FAILED" && current.accessEndsAt
      ? current.accessEndsAt
      : new Date(Math.min(due.getTime() + days * 86400000, current.programmeEnd?.getTime() ?? Infinity));
    const allowGrace = terms?.failedPaymentAccess === "PAUSE" && days > 0 &&
      current.paidCount > 0 && !current.cancelledAt && graceEnd > now;
    await tx.sirahOrder.update({
      where: { id: order.id },
      data: {
        paymentState: "FAILED",
        ...(terms?.failedPaymentAccess === "PAUSE"
          ? { enrolmentState: allowGrace ? "ACTIVE" : "PENDING",
              ...(days > 0 && !current.cancelledAt ? { accessEndsAt: graceEnd } : {}) }
          : {}),
        revision: { increment: 1 },
      },
    });
    await queueSirahNotice(tx, order.id, "FAILED", eventId);
  });
  await dispatchSirahNotifications(order.id).catch(() => {});
}

/** Expire only an unsettled hosted checkout before allowing a new quote.
 * Completed or asynchronous payments stay locked until verified/reconciled. */
export async function resetUnsettledSirahCheckout(
  orderId: string,
  userId: string,
) {
  const order = await ownedSirahOrder(orderId, userId);
  if (
    order.paidCount ||
    !["PROCESSING", "FAILED"].includes(order.paymentState) ||
    order.method !== "STRIPE" ||
    !order.providerOrderId
  )
    throw new SirahError(
      "This checkout cannot be safely reset. Check its verified payment status or contact support.",
      409,
    );
  const stripe = stripeClient();
  await verifyStripeMerchant(stripe);
  let session = await stripe.checkout.sessions.retrieve(order.providerOrderId);
  if (
    session.metadata?.sirahOrderId !== order.id ||
    session.metadata?.checkoutToken !== order.checkoutToken
  )
    throw new SirahError("Checkout ownership mismatch.");
  if (session.payment_status === "paid") {
    await verifySirahStripeSession(order.id, session.id, stripe);
    throw new SirahError(
      "The payment has settled; its agreed amount is preserved.",
      409,
    );
  }
  if (session.status === "open")
    session = await stripe.checkout.sessions.expire(session.id);
  if (
    session.status !== "expired" ||
    session.subscription ||
    session.payment_status !== "unpaid"
  )
    throw new SirahError(
      "The payment may still settle. It has not been replaced or repriced.",
      409,
    );
  const quote = await import("@/lib/sirah/catalog").then(({ priceFor }) =>
    priceFor(
      order.countryCode,
      order.plan as SirahPlan,
      order.countryCode === "PK" ? "BANK_TRANSFER" : null,
    ),
  );
  await prisma.$transaction(async (tx) => {
    const result = await tx.sirahOrder.updateMany({
      where: {
        id: order.id,
        userId,
        revision: order.revision,
        paidCount: 0,
        paymentState: { in: ["PROCESSING", "FAILED"] },
      },
      data: {
        providerOrderId: null,
        providerSubscriptionId: null,
        checkoutToken: null,
        method: null,
        paymentState: "UNPAID",
        amountMinor: quote.amountMinor,
        totalMinor: quote.totalMinor,
        revision: { increment: 1 },
      },
    });
    if (!result.count)
      throw new SirahError(
        "Payment status changed. Reload before continuing.",
        409,
      );
    await auditSirah(
      tx,
      order.id,
      `student:${userId}`,
      "UNSETTLED_CHECKOUT_EXPIRED",
      { providerOrderId: session.id },
    );
  });
}

/** Resume only the same approved voluntary subscription; activation is not settlement. */
export async function resumeSirahPaypalRenewals(
  orderId: string,
  userId: string,
  revision: number,
  acceptedTermsVersion: string,
) {
  const order = await ownedSirahOrder(orderId, userId);
  const terms = order.terms as import("@/lib/sirah/config").SirahTerms | null;
  if (
    order.revision !== revision ||
    order.plan !== "MONTHLY" ||
    order.method !== "PAYPAL" ||
    !order.providerSubscriptionId ||
    order.cancelledAt ||
    order.paidCount >= 12 ||
    order.paymentState !== "FAILED" ||
    ["CANCELLED", "COMPLETED"].includes(order.enrolmentState) ||
    (order.programmeEnd && order.programmeEnd <= new Date())
  )
    throw new SirahError(
      "Only the unchanged failed subscription can resume future renewals.",
      409,
    );
  if (
    !methodAvailable("PAYPAL", order.countryCode, order.currency, "MONTHLY", {
      id: order.id,
      amountMinor: order.amountMinor,
    }) ||
    terms?.version !== acceptedTermsVersion ||
    termsFor("MONTHLY")?.version !== acceptedTermsVersion
  )
    throw new SirahError(
      "Review the currently approved renewal terms before resuming.",
      409,
    );
  const path = `/v1/billing/subscriptions/${order.providerSubscriptionId}`;
  const owns = (sub: { custom_id?: string; plan_id?: string }) =>
    sub.custom_id === order.id && sub.plan_id === order.providerPlanId;
  const current = await paypalRequest(path);
  if (!owns(current)) throw new SirahError("Subscription ownership mismatch.");
  const issue = paypalPlanIssue(
    await paypalRequest(`/v1/billing/plans/${order.providerPlanId}`),
    {
      productId: process.env.SIRAH_PAYPAL_PRODUCT_ID || "",
      currency: order.currency,
      amountMinor: order.amountMinor,
    },
  );
  if (issue) throw new SirahError(issue, 409);
  if (current.status === "SUSPENDED")
    await paypalRequest(
      `${path}/activate`,
      "POST",
      { reason: "Student requested future voluntary renewals" },
      `resume-${order.id}-${revision}`,
    );
  else if (current.status !== "ACTIVE")
    throw new SirahError(
      "A cancelled or expired subscription cannot be resumed.",
      409,
    );
  const verified = await paypalRequest(path);
  if (!owns(verified) || verified.status !== "ACTIVE")
    throw new SirahError("PayPal has not confirmed resumed renewals.", 409);
  await prisma.$transaction((tx) =>
    auditSirah(tx, order.id, `student:${userId}`, "RENEWALS_RESUMED", {
      subscriptionId: order.providerSubscriptionId,
      acceptedTermsVersion,
      settlementConfirmed: false,
    }),
  );
  return {
    message:
      "Existing future renewals resumed. Payment remains pending and access changes only after verified settlement.",
  };
}
