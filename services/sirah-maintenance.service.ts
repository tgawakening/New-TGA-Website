import { sirahSchemaAvailable } from "@/lib/sirah/readiness";
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
export async function maintainSirahOrders() {
  if (!(await sirahSchemaAvailable()))
    return { available: false, reason: "Database migration pending" };
  const now = new Date();
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
    failures,
    ...notifications,
  };
}
