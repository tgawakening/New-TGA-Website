import "server-only";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  verifySirahStripeSession,
  verifySirahStripeInvoice,
  verifySirahPaypal,
  markSirahProviderFailure,
  paypalRequest,
} from "./sirah-online.service";
import { recordSirahRefund, holdSirahRefund } from "./sirah-admin.service";
import { SirahError, auditSirah } from "./sirah-registration.service";
import { decimalToMinor } from "@/lib/sirah/catalog";
import { type SirahTerms } from "@/lib/sirah/config";
import {
  queueSirahNotice,
  dispatchSirahNotifications,
} from "./sirah-notifications.service";
export async function handleSirahStripeEvent(
  event: Stripe.Event,
  stripe: Stripe,
): Promise<boolean> {
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    const session = event.data.object;
    const orderId = session.metadata?.sirahOrderId;
    if (!orderId) return false;
    const order = await prisma.sirahOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    if (session.metadata?.checkoutToken !== order.checkoutToken)
      throw new SirahError("Checkout event ownership mismatch.");
    if (event.type === "checkout.session.async_payment_failed") {
      const latest = await stripe.checkout.sessions.retrieve(session.id);
      if (latest.payment_status !== "paid")
        await markSirahProviderFailure(order, `stripe:failed:${event.id}`);
    } else await verifySirahStripeSession(orderId, session.id, stripe);
    return true;
  }
  if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_failed"
  ) {
    const invoice = event.data.object;
    const ref = invoice.parent?.subscription_details?.subscription;
    const subId = typeof ref === "string" ? ref : ref?.id;
    if (!subId) return false;
    const sub = await stripe.subscriptions.retrieve(subId);
    const orderId = sub.metadata.sirahOrderId;
    if (!orderId) return false;
    const order = await prisma.sirahOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    if (sub.metadata.checkoutToken !== order.checkoutToken)
      throw new SirahError("Invoice event ownership mismatch.");
    if (!order.providerSubscriptionId) {
      if (!order.providerOrderId)
        throw new SirahError(
          "Checkout is still being recorded; retry the signed event.",
          503,
        );
      await verifySirahStripeSession(order.id, order.providerOrderId, stripe);
    }
    const latest = await stripe.invoices.retrieve(invoice.id);
    if (latest.status === "paid")
      await verifySirahStripeInvoice(order.id, invoice.id, stripe);
    else if (event.type === "invoice.payment_failed")
      await markSirahProviderFailure(order, `stripe:failed:${event.id}`);
    return true;
  }
  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.updated"
  ) {
    const subscription = event.data.object;
    const orderId = subscription.metadata.sirahOrderId;
    if (!orderId) return false;
    const current = await stripe.subscriptions.retrieve(subscription.id);
    const order = await prisma.sirahOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    if (
      order.providerSubscriptionId &&
      order.providerSubscriptionId !== current.id
    )
      throw new SirahError("Subscription event ownership mismatch.");
    if (current.status === "canceled") {
      const programmeFinished =
        !order.cancelledAt &&
        !!order.programmeEnd &&
        order.programmeEnd <= new Date();
      const terms = order.terms as SirahTerms | null;
      await prisma.$transaction(async (tx) => {
        await tx.sirahOrder.update({
          where: { id: order.id },
          data: {
            cancelledAt: order.cancelledAt || new Date(),
            nextBillingAt: null,
            ...(programmeFinished
              ? { enrolmentState: "COMPLETED" }
              : terms?.cancellationTiming === "IMMEDIATE"
                ? { enrolmentState: "CANCELLED" }
                : {
                    accessEndsAt: new Date(
                      current.ended_at ? current.ended_at * 1000 : Date.now(),
                    ),
                  }),
          },
        });
        await auditSirah(
          tx,
          order.id,
          "provider:stripe",
          "PROVIDER_CANCELLED",
          { eventId: event.id },
        );
        await queueSirahNotice(
          tx,
          order.id,
          programmeFinished ? "COMPLETED" : "CANCELLED",
          current.id,
        );
      });
      await dispatchSirahNotifications(order.id).catch(() => {});
    }
    return true;
  }
  if (event.type === "refund.updated" || event.type === "refund.created") {
    const refund = event.data.object;
    if (refund.status !== "succeeded") return false;
    const intent =
      typeof refund.payment_intent === "string"
        ? refund.payment_intent
        : refund.payment_intent?.id;
    if (!intent) return false;
    // Payment events identify the actual settled charge, never a browser return URL.
    const relatedInvoices: string[] = [];
    let payment = await prisma.sirahPaymentEvent.findUnique({
      where: { id: `stripe:payment:${intent}` },
    });
    if (!payment) {
      const links = await stripe.invoicePayments.list({
        payment: { type: "payment_intent", payment_intent: intent },
        limit: 10,
      });
      for (const link of links.data) {
        const invoiceId =
          typeof link.invoice === "string" ? link.invoice : link.invoice.id;
        relatedInvoices.push(invoiceId);
        payment = await prisma.sirahPaymentEvent.findUnique({
          where: { id: `stripe:invoice:${invoiceId}` },
        });
        if (payment) break;
      }
    }
    const verified = await stripe.refunds.retrieve(refund.id);
    if (!payment) {
      const intentRecord = await stripe.paymentIntents.retrieve(intent);
      let orderId = intentRecord.metadata.sirahOrderId;
      if (!orderId) {
        const links = await stripe.invoicePayments.list({
          payment: { type: "payment_intent", payment_intent: intent },
          limit: 10,
        });
        for (const link of links.data) {
          const invoice = await stripe.invoices.retrieve(
            typeof link.invoice === "string" ? link.invoice : link.invoice.id,
          );
          if (!relatedInvoices.includes(invoice.id))
            relatedInvoices.push(invoice.id);
          const sub = invoice.parent?.subscription_details?.subscription;
          if (sub) {
            const record = await stripe.subscriptions.retrieve(
              typeof sub === "string" ? sub : sub.id,
            );
            if (record.metadata.sirahOrderId) {
              orderId = record.metadata.sirahOrderId;
              break;
            }
          }
        }
      }
      if (!orderId) return false;
      const order = await prisma.sirahOrder.findUniqueOrThrow({
        where: { id: orderId },
      });
      if (
        order.method !== "STRIPE" ||
        intentRecord.amount !== order.amountMinor ||
        intentRecord.currency.toUpperCase() !== order.currency
      )
        throw new SirahError("Refund settlement identity mismatch.");
      await holdSirahRefund(
        order.id,
        `stripe:refund:${verified.id}`,
        verified.currency.toUpperCase(),
        verified.amount,
      );
      if (order.providerOrderId)
        await verifySirahStripeSession(order.id, order.providerOrderId, stripe);
      for (const invoiceId of relatedInvoices)
        await verifySirahStripeInvoice(order.id, invoiceId, stripe);
      const recorded = await prisma.sirahPaymentEvent.findFirst({
        where: {
          id: {
            in: [
              `stripe:payment:${intent}`,
              ...relatedInvoices.map((id) => `stripe:invoice:${id}`),
            ],
          },
          orderId: order.id,
        },
      });
      if (recorded) return handleSirahStripeEvent(event, stripe);
      throw new SirahError(
        "The refund is held pending its settlement record. Retry the signed event.",
        503,
      );
    }
    if (verified.status !== "succeeded") return true;
    await recordSirahRefund(
      payment.orderId,
      `stripe:refund:${verified.id}`,
      verified.amount,
      verified.currency.toUpperCase(),
      "provider:stripe",
      "Verified Stripe refund event",
    );
    await dispatchSirahNotifications(payment.orderId).catch(() => {});
    return true;
  }
  return false;
}
export async function handleSirahPaypalWebhook(request: Request) {
  const bodyText = await request.text();
  if (bodyText.length > 1024 * 1024)
    throw new SirahError("Webhook too large.", 413);
  const event = JSON.parse(bodyText);
  const check = await paypalRequest(
    "/v1/notifications/verify-webhook-signature",
    "POST",
    {
      auth_algo: request.headers.get("paypal-auth-algo"),
      cert_url: request.headers.get("paypal-cert-url"),
      transmission_id: request.headers.get("paypal-transmission-id"),
      transmission_sig: request.headers.get("paypal-transmission-sig"),
      transmission_time: request.headers.get("paypal-transmission-time"),
      webhook_id: process.env.SIRAH_PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    },
  );
  if (check?.verification_status !== "SUCCESS")
    throw new SirahError("Invalid PayPal webhook signature.", 400);
  const resource = event.resource;
  if (
    ["PAYMENT.CAPTURE.REFUNDED", "PAYMENT.SALE.REFUNDED"].includes(
      event.event_type,
    )
  ) {
    const sale = event.event_type === "PAYMENT.SALE.REFUNDED";
    const verified = await paypalRequest(
      sale
        ? `/v1/payments/refund/${encodeURIComponent(resource.id)}`
        : `/v2/payments/refunds/${encodeURIComponent(resource.id)}`,
    );
    if (verified.status !== "COMPLETED" && verified.state !== "completed")
      return { received: true };
    const original =
      verified.sale_id ||
      verified.supplementary_data?.related_ids?.capture_id ||
      verified.links
        ?.find(
          (link: { rel: string }) => link.rel === "up" || link.rel === "sale",
        )
        ?.href?.match(/\/(?:captures|sale)\/([^/]+)/)?.[1];
    if (!original)
      throw new SirahError(
        "Refund settlement reference is unavailable; retry the event.",
        503,
      );
    let paid = await prisma.sirahPaymentEvent.findUnique({
      where: { id: `paypal:${sale ? "sale" : "capture"}:${original}` },
    });
    const currency = verified.amount.currency_code || verified.amount.currency;
    const amount = decimalToMinor(
      verified.amount.value || verified.amount.total,
      currency,
    );
    if (!paid) {
      const capture = await paypalRequest(
        sale
          ? `/v1/payments/sale/${original}`
          : `/v2/payments/captures/${original}`,
      );
      const related = capture.supplementary_data?.related_ids?.order_id;
      const pending = await prisma.sirahOrder.findFirst({
        where: {
          method: "PAYPAL",
          OR: [
            ...(capture.billing_agreement_id
              ? [{ providerSubscriptionId: capture.billing_agreement_id }]
              : []),
            ...(related ? [{ providerOrderId: related }] : []),
          ],
        },
      });
      if (!pending) return { received: true };
      await holdSirahRefund(
        pending.id,
        `paypal:refund:${verified.id}`,
        currency,
        amount,
      );
      await verifySirahPaypal(
        pending.id,
        (pending.providerOrderId || pending.providerSubscriptionId)!,
      );
      paid = await prisma.sirahPaymentEvent.findUnique({
        where: { id: `paypal:${sale ? "sale" : "capture"}:${original}` },
      });
      if (!paid)
        throw new SirahError(
          "Refund held pending settlement reconciliation. Retry the signed event.",
          503,
        );
    }
    await recordSirahRefund(
      paid.orderId,
      `paypal:refund:${verified.id}`,
      amount,
      currency,
      "provider:paypal",
      "Verified PayPal refund event",
    );
    await dispatchSirahNotifications(paid.orderId).catch(() => {});
    return { received: true };
  }
  const orderId = resource?.custom_id;
  const subscriptionId =
    resource?.billing_agreement_id ||
    ([
      "BILLING.SUBSCRIPTION.CANCELLED",
      "BILLING.SUBSCRIPTION.EXPIRED",
      "BILLING.SUBSCRIPTION.SUSPENDED",
      "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
    ].includes(event.event_type)
      ? resource?.id
      : null);
  const captureOrderId =
    event.event_type === "CHECKOUT.ORDER.APPROVED"
      ? resource?.id
      : resource?.supplementary_data?.related_ids?.order_id;
  const order = await prisma.sirahOrder.findFirst({
    where: {
      method: "PAYPAL",
      OR: [
        ...(orderId ? [{ id: orderId }] : []),
        ...(subscriptionId ? [{ providerSubscriptionId: subscriptionId }] : []),
        ...(captureOrderId ? [{ providerOrderId: captureOrderId }] : []),
      ],
    },
  });
  if (!order) return { received: true };
  if (event.event_type === "CHECKOUT.ORDER.APPROVED" && order.providerOrderId)
    await verifySirahPaypal(order.id, order.providerOrderId, true);
  else if (
    event.event_type === "PAYMENT.CAPTURE.COMPLETED" &&
    order.providerOrderId
  )
    await verifySirahPaypal(order.id, order.providerOrderId);
  else if (
    event.event_type === "PAYMENT.SALE.COMPLETED" &&
    order.providerSubscriptionId
  )
    await verifySirahPaypal(order.id, order.providerSubscriptionId);
  else if (event.event_type === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") {
    const current = await paypalRequest(
      `/v1/billing/subscriptions/${order.providerSubscriptionId}`,
    );
    if (current.custom_id !== order.id)
      throw new SirahError("Subscription identity mismatch.");
    if (
      current.billing_info?.outstanding_balance &&
      decimalToMinor(
        current.billing_info.outstanding_balance.value,
        order.currency,
      ) > 0
    )
      await markSirahProviderFailure(order, `paypal:failed:${event.id}`);
  } else if (
    event.event_type === "BILLING.SUBSCRIPTION.SUSPENDED" &&
    order.providerSubscriptionId
  ) {
    const current = await paypalRequest(
      `/v1/billing/subscriptions/${order.providerSubscriptionId}`,
    );
    if (current.custom_id !== order.id)
      throw new SirahError("Subscription identity mismatch.");
    if (current.status === "SUSPENDED")
      await markSirahProviderFailure(order, `paypal:suspended:${event.id}`);
  } else if (
    ["BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.EXPIRED"].includes(
      event.event_type,
    )
  ) {
    const current = await paypalRequest(
      `/v1/billing/subscriptions/${order.providerSubscriptionId}`,
    );
    if (current.custom_id !== order.id)
      throw new SirahError("Subscription identity mismatch.");
    if (["CANCELLED", "EXPIRED"].includes(current.status)) {
      const programmeFinished =
        current.status === "EXPIRED" ||
        (!order.cancelledAt &&
          !!order.programmeEnd &&
          order.programmeEnd <= new Date());
      const terms = order.terms as SirahTerms | null;
      await prisma.$transaction(async (tx) => {
        await tx.sirahOrder.update({
          where: { id: order.id },
          data: {
            cancelledAt: order.cancelledAt || new Date(),
            nextBillingAt: null,
            ...(programmeFinished
              ? { enrolmentState: "COMPLETED" }
              : terms?.cancellationTiming === "IMMEDIATE"
                ? { enrolmentState: "CANCELLED" }
                : { accessEndsAt: order.nextBillingAt || order.programmeEnd }),
          },
        });
        await auditSirah(
          tx,
          order.id,
          "provider:paypal",
          "PROVIDER_CANCELLED",
          { eventId: event.id },
        );
        await queueSirahNotice(
          tx,
          order.id,
          programmeFinished ? "COMPLETED" : "CANCELLED",
          current.id,
        );
      });
    }
  }
  await dispatchSirahNotifications(order.id).catch(() => {});
  return { received: true };
}
