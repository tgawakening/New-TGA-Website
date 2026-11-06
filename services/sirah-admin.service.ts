import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  SIRAH_SLUG,
  SIRAH_TITLE,
  decimalToMinor,
  formatSirahMoney,
} from "@/lib/sirah/catalog";
import { getGroupInvitation, type SirahTerms } from "@/lib/sirah/config";
import { sirahAdminActionSchema } from "@/lib/sirah/validation";
import { auditSirah, SirahError } from "./sirah-registration.service";
import {
  confirmSirahPayment,
  addMonthsClamped,
  serializable,
} from "./sirah-confirmation.service";
import {
  queueSirahNotice,
  dispatchSirahNotifications,
  queuePendingInvitations,
} from "./sirah-notifications.service";
import {
  stripeClient,
  paypalRequest,
  paypalDecimal,
  verifySirahStripeSession,
  verifySirahPaypal,
} from "./sirah-online.service";
export async function listSirahAdmin(search: URLSearchParams) {
  const page = Math.max(1, Math.min(10000, Number(search.get("page")) || 1));
  const pageSize = 25;
  const q = (search.get("q") || "").slice(0, 150);
  const payment = search.get("payment") || "";
  const enrolment = search.get("enrolment") || "";
  const batch = search.get("batch") || "";
  const where: Prisma.SirahOrderWhereInput = {
    course: { slug: SIRAH_SLUG },
    ...(payment ? { paymentState: payment } : {}),
    ...(enrolment ? { enrolmentState: enrolment } : {}),
    ...(batch ? { batchCode: batch } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q } },
            { user: { email: { contains: q } } },
            { user: { fullName: { contains: q } } },
            { phoneE164: { contains: q } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.sirahOrder.count({ where }),
    prisma.sirahOrder.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reference: true,
        batchCode: true,
        countryCode: true,
        countryName: true,
        phoneE164: true,
        marketCode: true,
        plan: true,
        method: true,
        currency: true,
        amountMinor: true,
        paidMinor: true,
        refundedMinor: true,
        pricingVersion: true,
        revision: true,
        paymentState: true,
        enrolmentState: true,
        programmeStart: true,
        programmeEnd: true,
        nextBillingAt: true,
        paidCount: true,
        createdAt: true,
        user: { select: { fullName: true, email: true } },
        receipts: {
          select: { id: true, filename: true, revision: true },
          orderBy: { revision: "desc" },
        },
        audits: {
          select: { actor: true, action: true, detail: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        events: {
          select: {
            id: true,
            kind: true,
            amountMinor: true,
            currency: true,
            provider: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        notifications: {
          select: {
            id: true,
            kind: true,
            state: true,
            error: true,
            attempts: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ]);
  return { courseTitle: SIRAH_TITLE, total, page, pageSize, rows };
}
export async function cancelSirahProvider(
  order: {
    id: string;
    method: string | null;
    providerSubscriptionId: string | null;
  },
  timing: "IMMEDIATE" | "PERIOD_END",
) {
  if (!order.providerSubscriptionId) return;
  if (order.method === "STRIPE") {
    const stripe = stripeClient();
    if (
      (await stripe.accounts.retrieve()).id !==
      process.env.SIRAH_STRIPE_ACCOUNT_ID
    )
      throw new SirahError("Stripe merchant identity mismatch.");
    const current = await stripe.subscriptions.retrieve(
      order.providerSubscriptionId,
    );
    if (current.status === "canceled") return;
    if (timing === "PERIOD_END")
      await stripe.subscriptions.update(order.providerSubscriptionId, {
        cancel_at_period_end: true,
      });
    else
      await stripe.subscriptions.cancel(order.providerSubscriptionId, {
        invoice_now: false,
        prorate: false,
      });
  } else if (order.method === "PAYPAL") {
    // PayPal cannot guarantee a new future cancellation schedule. Keep this option
    // inactive rather than silently substituting immediate cancellation.
    if (timing === "PERIOD_END")
      throw new SirahError(
        "PayPal period-end cancellation needs provider configuration; it has not been substituted with immediate cancellation.",
        409,
      );
    const sub = await paypalRequest(
      `/v1/billing/subscriptions/${order.providerSubscriptionId}`,
    );
    if (sub.custom_id !== order.id)
      throw new SirahError("Subscription ownership mismatch.");
    if (!["CANCELLED", "EXPIRED"].includes(sub.status))
      await paypalRequest(
        `/v1/billing/subscriptions/${order.providerSubscriptionId}/cancel`,
        "POST",
        { reason: "Course cancellation requested" },
        `cancel-${order.id}`,
      );
  }
}
export async function recordSirahRefund(
  orderId: string,
  refundId: string,
  amountMinor: number,
  currency: string,
  actor: string,
  note: string,
) {
  const outcome = await serializable(async (tx) => {
    const previous = await tx.sirahPaymentEvent.findUnique({
      where: { id: refundId },
    });
    if (previous) {
      if (previous.orderId !== orderId)
        throw new SirahError("Refund identity mismatch.");
      return;
    }
    const order = await tx.sirahOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    if (
      order.currency !== currency ||
      amountMinor <= 0 ||
      amountMinor > order.paidMinor - order.refundedMinor
    )
      throw new SirahError(
        "Refund amount or currency does not match recorded payments.",
      );
    await tx.sirahPaymentEvent.create({
      data: {
        id: refundId,
        orderId,
        provider: order.method!,
        amountMinor,
        currency,
        kind: "REFUND",
      },
    });
    const all = order.refundedMinor + amountMinor === order.paidMinor;
    const terms = order.terms as SirahTerms | null;
    const releaseHold =
      order.paymentState === "REFUND_PENDING" &&
      terms?.refundAccess === "KEEP" &&
      !order.cancelledAt &&
      !["CANCELLED", "COMPLETED"].includes(order.enrolmentState);
    await tx.sirahOrder.update({
      where: { id: orderId },
      data: {
        refundedMinor: { increment: amountMinor },
        paymentState: all ? "REFUNDED" : "PAID",
        ...(terms?.refundAccess === "REVOKE"
          ? { enrolmentState: "CANCELLED" }
          : releaseHold
            ? {
                enrolmentState: "ACTIVE",
                invitationState:
                  order.invitationState === "SENT"
                    ? "SENT"
                    : getGroupInvitation(order.countryCode)
                      ? "QUEUED"
                      : "PENDING",
                nextBillingAt:
                  order.plan === "MONTHLY" &&
                  order.paidCount < 12 &&
                  order.programmeStart
                    ? addMonthsClamped(order.programmeStart, order.paidCount)
                    : null,
              }
            : {}),
        revision: { increment: 1 },
      },
    });
    if (releaseHold && !all) {
      await queueSirahNotice(
        tx,
        orderId,
        "CONFIRMED",
        `reconciled:${refundId}`,
      );
      if (!getGroupInvitation(order.countryCode))
        await queueSirahNotice(
          tx,
          orderId,
          "INVITATION_PENDING",
          `paid:${orderId}`,
        );
    }
    await auditSirah(tx, orderId, actor, "REFUND_VERIFIED", {
      refundId,
      amountMinor,
      currency,
      note,
    });
    await queueSirahNotice(tx, orderId, "REFUNDED", refundId, note);
    return {
      cancelBilling:
        !!order.providerSubscriptionId && terms?.refundBilling === "CANCEL",
      order,
    };
  });
  if (outcome?.cancelBilling) {
    try {
      await cancelSirahProvider(outcome.order, "IMMEDIATE");
      await prisma.$transaction(async (tx) => {
        await tx.sirahOrder.update({
          where: { id: orderId },
          data: { cancelledAt: new Date(), nextBillingAt: null },
        });
        await auditSirah(tx, orderId, actor, "REFUND_BILLING_CANCELLED", {
          refundId,
        });
      });
    } catch {
      await prisma.$transaction((tx) =>
        queueSirahNotice(tx, orderId, "BILLING_REVIEW", refundId),
      );
    }
  }
}
export async function actOnSirahOrder(
  input: z.infer<typeof sirahAdminActionSchema>,
  actor: string,
) {
  const order = await prisma.sirahOrder.findUnique({
    where: { id: input.orderId },
    include: { events: { where: { kind: { in: ["FIRST", "RENEWAL"] } } } },
  });
  if (!order) throw new SirahError("Registration not found.", 404);
  if (input.action === "RETRY_NOTIFICATIONS") {
    await prisma.$transaction(async (tx) => {
      await auditSirah(tx, order.id, actor, "NOTIFICATIONS_RETRY", {});
    });
    await queuePendingInvitations();
    return dispatchSirahNotifications(order.id);
  }
  if (input.action === "RECONCILE_PROVIDER") {
    if (
      order.revision !== input.revision ||
      order.paymentState !== "PROCESSING" ||
      !input.providerReference
    )
      throw new SirahError(
        "Choose the unchanged processing order and its actual provider reference.",
        409,
      );
    await prisma.$transaction((tx) =>
      auditSirah(tx, order.id, actor, "PROVIDER_RECONCILIATION_REQUESTED", {
        reference: input.providerReference,
        note: input.note || null,
      }),
    );
    if (order.method === "STRIPE")
      return verifySirahStripeSession(order.id, input.providerReference);
    if (order.method === "PAYPAL")
      return verifySirahPaypal(order.id, input.providerReference, false);
    throw new SirahError("This record is not an online checkout.");
  }
  if (input.action === "APPROVE") {
    if (!["BANK_TRANSFER", "JAZZCASH"].includes(order.method || ""))
      throw new SirahError(
        "Online payments cannot be approved through a display-status change.",
      );
    const amount = decimalToMinor(
      input.verifiedAmount!,
      input.currency!.toUpperCase(),
    );
    const eventId = `manual:${order.method}:${createHash("sha256").update(input.transactionReference!.trim()).digest("hex")}`;
    return confirmSirahPayment({
      orderId: order.id,
      eventId,
      provider: order.method as "BANK_TRANSFER" | "JAZZCASH",
      amountMinor: amount,
      currency: input.currency!.toUpperCase(),
      actor,
      note: `${input.note || ""} Verified transaction: ${input.transactionReference}`,
      expectedRevision: input.revision,
      allowCancelledTransfer:
        order.enrolmentState === "CANCELLED" &&
        !!input.note &&
        !!input.verifiedTransfer,
    });
  }
  if (order.revision !== input.revision)
    throw new SirahError(
      "Another admin or student changed this record. Reload first.",
      409,
    );
  if (input.action === "REFUND") {
    if (!input.verifiedAmount || !input.currency)
      throw new SirahError(
        "A verified refund amount and currency are required.",
      );
    const amount = decimalToMinor(
      input.verifiedAmount,
      input.currency.toUpperCase(),
    );
    if (
      input.currency.toUpperCase() !== order.currency ||
      amount > order.paidMinor - order.refundedMinor
    )
      throw new SirahError(
        "Refund exceeds unrefunded payments or uses the wrong currency.",
      );
    let refundId = input.refundReference;
    if (order.method === "STRIPE" || order.method === "PAYPAL") {
      const event = order.events.find((e) => e.id === input.paymentEventId);
      if (!event || amount > event.amountMinor)
        throw new SirahError(
          "Choose a verified payment event and an amount within that payment.",
        );
      if (order.method === "STRIPE") {
        const stripe = stripeClient();
        let intent: string;
        if (event.id.startsWith("stripe:invoice:")) {
          const invoice = await stripe.invoices.retrieve(
            event.id.replace("stripe:invoice:", ""),
            { expand: ["payments"] },
          );
          const payment = invoice.payments?.data.find(
            (p) => p.payment.type === "payment_intent",
          )?.payment.payment_intent;
          intent = typeof payment === "string" ? payment : payment?.id || "";
        } else intent = event.id.replace("stripe:payment:", "");
        if (!intent)
          throw new SirahError(
            "Provider payment reference is not yet available.",
          );
        const refund = await stripe.refunds.create(
          { payment_intent: intent, amount },
          { idempotencyKey: `sirah-refund:${order.id}:${input.revision}` },
        );
        if (refund.status !== "succeeded")
          throw new SirahError(
            "The provider refund is processing. Payment status has not been changed.",
            409,
          );
        refundId = `stripe:refund:${refund.id}`;
      } else {
        const capture = event.id.replace(/^paypal:(capture|sale):/, "");
        const recurring = event.id.startsWith("paypal:sale:");
        const refund = await paypalRequest(
          recurring
            ? `/v1/payments/sale/${capture}/refund`
            : `/v2/payments/captures/${capture}/refund`,
          "POST",
          recurring
            ? {
                amount: {
                  currency: order.currency,
                  total: paypalDecimal(amount, order.currency),
                },
              }
            : {
                amount: {
                  currency_code: order.currency,
                  value: paypalDecimal(amount, order.currency),
                },
              },
          `refund-${order.id}-${input.revision}`,
        );
        if (refund.status !== "COMPLETED" && refund.state !== "completed")
          throw new SirahError(
            "The provider refund has not settled; no status was changed.",
            409,
          );
        refundId = `paypal:refund:${refund.id}`;
      }
    } else if (!refundId)
      throw new SirahError(
        "Record the real manual-refund transaction reference.",
      );
    await recordSirahRefund(
      order.id,
      refundId!,
      amount,
      order.currency,
      actor,
      input.note!,
    );
    await dispatchSirahNotifications(order.id).catch(() => {});
    return { refunded: true };
  }
  if (input.action === "CANCEL") {
    const terms = order.terms as SirahTerms | null;
    if (order.paidCount && !terms)
      throw new SirahError("Approved cancellation terms are not configured.");
    const timing = terms?.cancellationTiming || "IMMEDIATE";
    await cancelSirahProvider(order, timing);
    await serializable(async (tx) => {
      const changed = await tx.sirahOrder.updateMany({
        where: { id: order.id, revision: input.revision },
        data: {
          cancelledAt: new Date(),
          ...(timing === "PERIOD_END" && order.nextBillingAt
            ? { accessEndsAt: order.nextBillingAt }
            : { enrolmentState: "CANCELLED", nextBillingAt: null }),
          revision: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new SirahError(
          "Cancellation was sent to the provider but the record changed; reload for reconciliation.",
          409,
        );
      await auditSirah(tx, order.id, actor, "CANCELLED", {
        timing,
        note: input.note,
      });
      await queueSirahNotice(
        tx,
        order.id,
        "CANCELLED",
        String(input.revision),
        input.note,
      );
    });
  } else if (input.action === "REJECT") {
    if (
      !["BANK_TRANSFER", "JAZZCASH"].includes(order.method || "") ||
      order.paymentState !== "AWAITING_REVIEW"
    )
      throw new SirahError(
        "Only an awaiting-review manual submission can be rejected.",
      );
    await serializable(async (tx) => {
      const changed = await tx.sirahOrder.updateMany({
        where: {
          id: order.id,
          revision: input.revision,
          paymentState: "AWAITING_REVIEW",
        },
        data: { paymentState: "REJECTED", revision: { increment: 1 } },
      });
      if (!changed.count)
        throw new SirahError("Submission already reviewed.", 409);
      await auditSirah(tx, order.id, actor, "REJECTED", { reason: input.note });
      await queueSirahNotice(
        tx,
        order.id,
        "REJECTED",
        String(input.revision),
        input.note,
      );
    });
  } else if (input.action === "COMPLETE") {
    await serializable(async (tx) => {
      const changed = await tx.sirahOrder.updateMany({
        where: { id: order.id, revision: input.revision },
        data: { enrolmentState: "COMPLETED", revision: { increment: 1 } },
      });
      if (!changed.count) throw new SirahError("Record changed.", 409);
      await auditSirah(tx, order.id, actor, "COMPLETED", {
        note: input.note || null,
        paymentStateUnchanged: order.paymentState,
      });
      await queueSirahNotice(tx, order.id, "COMPLETED", String(input.revision));
    });
  }
  await dispatchSirahNotifications(order.id).catch(() => {});
  return { updated: true };
}
export function sirahCsvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function sirahCsv(data: Awaited<ReturnType<typeof listSirahAdmin>>) {
  return [
    [
      "Reference",
      "Name",
      "Email",
      "Phone",
      "Country",
      "Batch",
      "Plan",
      "Method",
      "Expected",
      "Paid",
      "Currency",
      "Payment status",
      "Enrolment status",
    ].join(","),
    ...data.rows.map((row) =>
      [
        row.reference,
        row.user.fullName,
        row.user.email,
        row.phoneE164,
        row.countryName,
        row.batchCode,
        row.plan,
        row.method,
        formatSirahMoney(row.amountMinor, row.currency),
        formatSirahMoney(row.paidMinor, row.currency),
        row.currency,
        row.paymentState,
        row.enrolmentState,
      ]
        .map(sirahCsvCell)
        .join(","),
    ),
  ].join("\r\n");
}

/** A signed, provider-retrieved refund arriving before its settlement event must
 * block entitlement until both financial records are reconciled. */
export async function holdSirahRefund(
  orderId: string,
  refundId: string,
  currency: string,
  amountMinor: number,
) {
  await serializable(async (tx) => {
    const order = await tx.sirahOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    if (
      order.currency !== currency ||
      amountMinor <= 0 ||
      amountMinor > order.amountMinor
    )
      throw new SirahError("Refund does not match this locked order.");
    const updated = await tx.sirahOrder.updateMany({
      where: {
        id: orderId,
        paymentState: { notIn: ["REFUND_PENDING", "REFUNDED"] },
      },
      data: { paymentState: "REFUND_PENDING", revision: { increment: 1 } },
    });
    if (updated.count) {
      await auditSirah(
        tx,
        orderId,
        "provider:verified-refund",
        "REFUND_BEFORE_SETTLEMENT",
        { refundId, amountMinor, currency },
      );
      await queueSirahNotice(tx, orderId, "REFUND_PENDING", refundId);
    }
  });
}
