import "server-only";
import {
  calculateSirahAnnualRefund,
  calculateSirahAnnualUnusedMonths,
} from "@/lib/sirah/annual-refund";
import { serializable } from "./sirah-confirmation.service";
import { auditSirah, SirahError } from "./sirah-registration.service";
import {
  queueSirahNotice,
  dispatchSirahNotifications,
} from "./sirah-notifications.service";

export async function quoteSirahAnnualRefund(
  orderId: string,
  revision: number,
  unusedEligibleMonths: number,
  actor: string,
) {
  return serializable(async (tx) => {
    const order = await tx.sirahOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { events: true },
    });
    if (order.revision !== revision)
      throw new SirahError(
        "Registration changed; recalculate the refund quote.",
        409,
      );
    const payments = order.events.filter((event) =>
      ["FIRST", "RENEWAL"].includes(event.kind),
    );
    const refunds = order.events.filter((event) => event.kind === "REFUND");
    const collected = payments.reduce(
      (sum, event) => sum + event.amountMinor,
      0,
    );
    const refunded = refunds.reduce((sum, event) => sum + event.amountMinor, 0);
    if (
      order.plan !== "ANNUAL" ||
      order.paymentState === "REFUND_PENDING" ||
      payments.length !== 1 ||
      collected <= 0 ||
      collected !== order.paidMinor ||
      refunded !== order.refundedMinor ||
      [...payments, ...refunds].some(
        (event) => event.currency !== order.currency || event.amountMinor <= 0,
      )
    )
      throw new SirahError(
        "An upfront refund quote requires reconciled verified payment and refund records.",
        409,
      );
    if (!order.programmeStart)
      throw new SirahError(
        "Programme dates need reconciliation before a refund quote.",
        409,
      );
    const calendar = calculateSirahAnnualUnusedMonths(
      order.programmeStart,
      new Date(),
    );
    if (unusedEligibleMonths > calendar.unusedEligibleMonths)
      throw new SirahError(
        "The proposed standard refunds only fully unused months. Statutory exceptions require separate staff review.",
        409,
      );
    const quote = {
      ...calculateSirahAnnualRefund({
        collectedMinor: collected,
        refundedMinor: order.refundedMinor,
        unusedEligibleMonths,
        currency: order.currency,
      }),
      usedMonths: calendar.usedMonths,
      proposedAccessEndsAt: calendar.paidThrough.toISOString(),
    };
    await auditSirah(tx, orderId, actor, "ANNUAL_REFUND_QUOTED", {
      ...quote,
      revision,
      paymentEventIds: order.events
        .filter((event) => ["FIRST", "RENEWAL"].includes(event.kind))
        .map((event) => event.id),
      previousRefundEventIds: refunds.map((event) => event.id),
      issuance:
        "Not authorised by this calculation; staff review and final policy approval required",
    });
    return quote;
  });
}

export async function requestSirahAnnualRefund(
  orderId: string,
  userId: string,
  revision: number,
  reason: string,
) {
  const result = await serializable(async (tx) => {
    const order = await tx.sirahOrder.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new SirahError("Registration not found.", 404);
    if (order.revision !== revision)
      throw new SirahError(
        "Registration changed; refresh before requesting a refund.",
        409,
      );
    if (
      order.plan !== "ANNUAL" ||
      order.paymentState !== "PAID" ||
      order.paidMinor <= order.refundedMinor
    )
      throw new SirahError(
        "An upfront refund request requires an unrefunded verified payment.",
        409,
      );
    const existing = await tx.sirahAudit.findFirst({
      where: {
        orderId,
        action: "REFUND_REQUESTED",
        detail: { path: "$.revision", equals: revision },
      },
    });
    if (existing) return { duplicate: true };
    await auditSirah(tx, orderId, `student:${userId}`, "REFUND_REQUESTED", {
      revision,
      reason,
      status: "REQUESTED",
    });
    await queueSirahNotice(
      tx,
      orderId,
      "REFUND_REQUESTED",
      String(revision),
      "A refund review was requested. Staff must verify eligibility and the original payment; no refund or access change has been approved. Reason: " +
        reason,
    );
    return { duplicate: false };
  });
  await dispatchSirahNotifications(orderId).catch(() => {});
  return {
    ...result,
    message:
      "Refund review requested. Staff approval and provider confirmation are required; no refund or access change has been made.",
  };
}
