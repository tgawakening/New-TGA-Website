import "server-only";
import type { SirahTerms } from "@/lib/sirah/config";
import {
  courseStartRefundThrough,
  pakistanCalendarDate,
} from "@/lib/sirah/cohort-dates";
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
    const terms = order.terms as SirahTerms | null;
    const promisedDates: string[] = [];
    if (terms?.requiresConfirmedCommencement) {
      if (terms.cohortCommencementDate)
        promisedDates.push(terms.cohortCommencementDate);
      const cohort = await tx.sirahCohort.findUnique({
        where: { batchCode: order.batchCode },
      });
      if (cohort?.confirmedAt && cohort.commencementAt)
        promisedDates.push(cohort.commencementAt.toISOString().slice(0, 10));
      for (const change of Array.isArray(cohort?.history)
        ? cohort.history
        : []) {
        if (
          change &&
          typeof change === "object" &&
          !Array.isArray(change) &&
          typeof change.commencementDate === "string" &&
          typeof change.at === "string" &&
          new Date(change.at) >= order.createdAt
        )
          promisedDates.push(change.commencementDate);
      }
    }
    const commencementDate =
      promisedDates
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .sort()
        .at(-1) || null;
    const through = commencementDate
      ? courseStartRefundThrough(commencementDate)
      : null;
    const today = pakistanCalendarDate(new Date());
    const fullRefundEligible =
      !!commencementDate && today >= commencementDate && today <= through!;
    const courseStartProtection = {
      commencementDate,
      fullRefundThrough: through,
      timeZone: "Asia/Karachi",
      status: !commencementDate
        ? "PENDING"
        : today < commencementDate
          ? "NOT_STARTED_REVIEW_REQUIRED"
          : fullRefundEligible
            ? "ELIGIBLE_FULL_REFUND"
            : "EXPIRED",
    };
    if (
      !fullRefundEligible &&
      unusedEligibleMonths > calendar.unusedEligibleMonths
    )
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
      ...(fullRefundEligible
        ? {
            cumulativeCapMinor: collected,
            additionalRefundMinor: collected - order.refundedMinor,
            priorRefundExceedsPolicyCap: false,
            calculationVersion: "sirah-course-start-full-refund-v1",
          }
        : {}),
      courseStartProtection,
      statutoryCancellationReviewRequired: true,
      usedMonths: calendar.usedMonths,
      proposedAccessEndsAt: fullRefundEligible
        ? new Date().toISOString()
        : calendar.paidThrough.toISOString(),
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
