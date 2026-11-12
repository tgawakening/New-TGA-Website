import { sirahSchemaAvailable } from "@/lib/sirah/readiness";
import type Stripe from "stripe";
import "server-only";
import { type SirahTerms } from "@/lib/sirah/config";
import { prisma } from "@/lib/prisma";
import { cancelSirahProvider } from "./sirah-admin.service";
import {
  queuePendingInvitations,
  dispatchSirahNotifications,
  queueSirahNotice,
} from "./sirah-notifications.service";
import { addMonthsClamped, serializable } from "./sirah-confirmation.service";
import { auditSirah } from "./sirah-registration.service";
import {
  verifySirahStripeSession,
  verifySirahPaypal,
  resetUnsettledSirahCheckout,
  paypalRequest,
} from "./sirah-online.service";

/** Minutes a checkout may sit in PROCESSING before the sweep reconciles it. */
const SIRAH_PROCESSING_GRACE_MS = 20 * 60 * 1000;

/**
 * Reconcile orders stuck in PROCESSING past the grace window. For each, a
 * read-only provider check (capture=false) confirms a genuinely settled payment
 * to PAID; otherwise the existing safe reset clears it to UNPAID. The reset
 * re-checks the provider and REFUSES to clear anything that could still settle,
 * so this never drops an order that might still pay — a refusal simply leaves it
 * PROCESSING for the next pass or manual handling.
 */
async function reconcileProcessingSirahOrders(now: Date, stripe?: Stripe) {
  const stale = new Date(now.getTime() - SIRAH_PROCESSING_GRACE_MS);
  const processing = await prisma.sirahOrder.findMany({
    where: {
      paymentState: "PROCESSING",
      updatedAt: { lte: stale },
      cancelledAt: null,
      method: { in: ["STRIPE", "PAYPAL"] },
      OR: [
        { providerOrderId: { not: null } },
        { providerSubscriptionId: { not: null } },
      ],
    },
    take: 100,
  });
  let paid = 0;
  let cleared = 0;
  let retained = 0;
  for (const order of processing) {
    try {
      const ref = order.providerOrderId || order.providerSubscriptionId!;
      if (order.method === "PAYPAL") {
        // A background job must never capture an authorised-but-uncaptured
        // order. If PayPal reports APPROVED, the payer authorised a payment that
        // is not yet captured; skip it (retained) so only the student's own
        // return/reset can settle it. The manual reset (capture-first) is
        // unchanged. On an unreadable status, skip conservatively.
        const live = await paypalRequest(
          order.plan === "ANNUAL"
            ? `/v2/checkout/orders/${ref}`
            : `/v1/billing/subscriptions/${ref}`,
        ).catch(() => null);
        if (!live || live.status === "APPROVED") {
          retained++;
          continue;
        }
        // Read-only confirmation only: capture=false never charges.
        await verifySirahPaypal(order.id, ref, false).catch(() => {});
      } else if (order.method === "STRIPE" && order.providerOrderId)
        // Stripe confirmation only ever confirms an already-paid session.
        await verifySirahStripeSession(
          order.id,
          order.providerOrderId,
          stripe,
        ).catch(() => {});
      const after = await prisma.sirahOrder.findUnique({
        where: { id: order.id },
      });
      if (!after) continue;
      if (after.paymentState === "PAID") {
        paid++;
        continue;
      }
      if (after.paymentState !== "PROCESSING") continue;
      // Still unsettled: clear via the same safety the student's "close unpaid
      // checkout" button uses. Throws (and is caught) if it might still settle.
      try {
        await resetUnsettledSirahCheckout(order.id, order.userId, { stripe });
        cleared++;
      } catch {
        retained++;
      }
    } catch {
      retained++;
    }
  }
  return { scanned: processing.length, paid, cleared, retained };
}
/** `options.stripe` is a test seam; production callers pass nothing and the
 * sweep uses the configured Sīrah Stripe client exactly as before. */
export async function maintainSirahOrders(options: { stripe?: Stripe } = {}) {
  if (!(await sirahSchemaAvailable()))
    return { available: false, reason: "Database migration pending" };
  const now = new Date();
  const reconciledProcessing = await reconcileProcessingSirahOrders(
    now,
    options.stripe,
  );
  const ended = await prisma.sirahOrder.findMany({
    where: {
      OR: [{ programmeEnd: { lte: now } }, { accessEndsAt: { lte: now } }],
      enrolmentState: { in: ["ACTIVE", "PENDING"] },
    },
    take: 100,
  });
  const failures: string[] = [];
  for (const order of ended) {
    try {
      if (
        order.plan === "MONTHLY" &&
        ["BANK_TRANSFER", "JAZZCASH"].includes(order.method || "") &&
        !order.cancelledAt &&
        order.paidCount > 0 &&
        order.paidCount < 12 &&
        !["REFUNDED", "REFUND_PENDING"].includes(order.paymentState) &&
        order.programmeEnd &&
        order.programmeEnd > now
      ) {
        // An unpaid manual renewal pauses access; it must remain receiptable,
        // rather than becoming a terminal completed programme.
        if (order.enrolmentState === "PENDING" && order.paymentState !== "PAID")
          continue;
        await serializable(async (tx) => {
          const changed = await tx.sirahOrder.updateMany({
            where: { id: order.id, revision: order.revision },
            data: {
              enrolmentState: "PENDING",
              ...(order.paymentState === "PAID"
                ? { paymentState: "UNPAID" }
                : {}),
              revision: { increment: 1 },
            },
          });
          if (changed.count && order.enrolmentState === "ACTIVE")
            await auditSirah(
              tx,
              order.id,
              "system:maintenance",
              "MANUAL_PAID_PERIOD_ENDED",
              {},
            );
        });
        continue;
      }
      if (
        order.plan === "MONTHLY" &&
        order.paymentState === "FAILED" &&
        !order.cancelledAt &&
        (order.terms as SirahTerms | null)?.failedPaymentGraceDays &&
        (!order.programmeEnd || order.programmeEnd > now)
      ) {
        await prisma.$transaction(async (tx) => {
          const changed = await tx.sirahOrder.updateMany({
            where: {
              id: order.id,
              paymentState: "FAILED",
              enrolmentState: "ACTIVE",
              accessEndsAt: { lte: now },
            },
            data: { enrolmentState: "PENDING", revision: { increment: 1 } },
          });
          if (changed.count)
            await auditSirah(
              tx,
              order.id,
              "system:maintenance",
              "RENEWAL_GRACE_EXPIRED",
              {},
            );
        });
        continue; // Keep the existing subscription available for verified recovery.
      }
      await cancelSirahProvider(order, "IMMEDIATE");
      await prisma.$transaction(async (tx) => {
        await tx.sirahOrder.update({
          where: { id: order.id },
          data: {
            nextBillingAt: null,
            enrolmentState: order.cancelledAt ? "CANCELLED" : "COMPLETED",
          },
        });
        await auditSirah(
          tx,
          order.id,
          "system:maintenance",
          "PROGRAMME_BOUNDARY",
          {},
        );
      });
    } catch {
      failures.push(order.reference);
    }
  }
  const refunds = await prisma.sirahOrder.findMany({
    where: {
      refundedMinor: { gt: 0 },
      providerSubscriptionId: { not: null },
      cancelledAt: null,
    },
    take: 100,
  });
  for (const order of refunds) {
    if ((order.terms as SirahTerms | null)?.refundBilling !== "CANCEL")
      continue;
    try {
      await cancelSirahProvider(order, "IMMEDIATE");
      await prisma.$transaction(async (tx) => {
        await tx.sirahOrder.update({
          where: { id: order.id },
          data: { cancelledAt: new Date(), nextBillingAt: null },
        });
        await auditSirah(
          tx,
          order.id,
          "system:maintenance",
          "REFUND_BILLING_CANCELLED",
          {},
        );
      });
    } catch {
      failures.push(order.reference);
    }
  }
  const due = await prisma.sirahOrder.findMany({
    where: {
      plan: "MONTHLY",
      enrolmentState: { in: ["ACTIVE", "PENDING"] },
      cancelledAt: null,
      nextBillingAt: { lte: now },
      paidCount: { lt: 12 },
      method: { in: ["BANK_TRANSFER", "JAZZCASH"] },
    },
    take: 100,
  });
  for (const order of due) {
    await prisma.$transaction(async (tx) => {
      await queueSirahNotice(
        tx,
        order.id,
        "RENEWAL_DUE",
        order.nextBillingAt!.toISOString(),
      );
      if (order.paymentState === "PAID")
        await tx.sirahOrder.updateMany({
          where: {
            id: order.id,
            revision: order.revision,
            paymentState: "PAID",
          },
          data: {
            paymentState: "UNPAID",
            enrolmentState: "PENDING",
            accessEndsAt: order.programmeStart
              ? addMonthsClamped(order.programmeStart, order.paidCount)
              : order.nextBillingAt,
            revision: { increment: 1 },
          },
        });
    });
  }
  await queuePendingInvitations();
  const notifications = await dispatchSirahNotifications();
  return {
    ended: ended.length,
    manualReminders: due.length,
    reconciledProcessing,
    failures,
    ...notifications,
  };
}
