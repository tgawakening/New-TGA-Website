import { SCHOLARSHIP_ORDER_VERSION } from "@/lib/sirah/scholarship-application";
import { canRecoverSirahManualPayment } from "@/lib/sirah/manual-review";
import "server-only";
import { Prisma, type SirahOrder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  SIRAH_TITLE,
  SIRAH_MONTHS,
  type SirahMethod,
} from "@/lib/sirah/catalog";
import { getGroupInvitation } from "@/lib/sirah/config";
import {
  afterCyclePayment,
  cycleAccessCeiling,
  orderCycle,
  startCycle,
  type CycleFields,
} from "@/lib/sirah/billing-cycle";
import { sirahBillingCycle } from "./sirah-billing-cycle.service";
import {
  auditSirah,
  jsonValue,
  SirahError,
} from "./sirah-registration.service";
import {
  queueSirahNotice,
  dispatchSirahNotifications,
} from "./sirah-notifications.service";
export async function serializable<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      });
    } catch (error) {
      if (
        attempt < 3 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(error.code)
      )
        continue;
      throw error;
    }
  }
}
export function addMonthsClamped(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}
export type VerifiedSirahPayment = {
  eventId: string;
  orderId: string;
  provider: SirahMethod;
  amountMinor: number;
  currency: string;
  actor: string;
  kind?: "FIRST" | "RENEWAL";
  note?: string;
  expectedRevision?: number;
  allowCancelledTransfer?: boolean;
  allowUnsubmittedManual?: boolean;
};
export async function confirmSirahPayment(input: VerifiedSirahPayment) {
  const result = await serializable(async (tx) => {
    const seen = await tx.sirahPaymentEvent.findUnique({
      where: { id: input.eventId },
    });
    if (seen) {
      if (
        seen.orderId !== input.orderId ||
        seen.amountMinor !== input.amountMinor ||
        seen.currency !== input.currency
      )
        throw new SirahError("Payment event identity mismatch.");
      return { duplicate: true };
    }
    const order = await tx.sirahOrder.findUniqueOrThrow({
      where: { id: input.orderId },
    });
    const recovery = input.allowUnsubmittedManual === true &&
      input.expectedRevision !== undefined && !!input.note?.trim() &&
      ["BANK_TRANSFER", "JAZZCASH"].includes(input.provider) &&
      canRecoverSirahManualPayment(order);
    const method = order.method || (recovery ? input.provider : null);
    if (
      order.currency !== input.currency ||
      order.amountMinor !== input.amountMinor ||
      method !== input.provider
    )
      throw new SirahError(
        "Payment amount, currency or method does not match the locked order.",
      );
    if (
      input.expectedRevision !== undefined &&
      (input.expectedRevision !== order.revision ||
        (order.paymentState !== "AWAITING_REVIEW" && !recovery &&
          !(
            input.allowCancelledTransfer &&
            order.enrolmentState === "CANCELLED" &&
            order.paidCount === 0
          )))
    )
      throw new SirahError(
        "This submission has already changed or been reviewed.",
        409,
      );
    if (order.paidCount >= (order.plan === "ANNUAL" ? 1 : SIRAH_MONTHS))
      throw new SirahError(
        "Programme payment limit reached; additional payment requires reconciliation.",
      );
    const terminal =
      ["CANCELLED", "COMPLETED"].includes(order.enrolmentState) ||
      ["REFUNDED", "REFUND_PENDING"].includes(order.paymentState) ||
      !!order.cancelledAt ||
      (!!order.programmeEnd && order.programmeEnd <= new Date());
    if (recovery)
      await auditSirah(tx, order.id, input.actor, "MANUAL_PAYMENT_RECOVERED", {
        previousMethod: order.method, previousPaymentState: order.paymentState,
        method, note: input.note, staffVerifiedWithoutStudentSubmission: true,
      });
    await tx.sirahPaymentEvent.create({
      data: {
        id: input.eventId,
        orderId: order.id,
        provider: input.provider,
        amountMinor: input.amountMinor,
        currency: input.currency,
        kind: order.paidCount ? "RENEWAL" : "FIRST",
      },
    });
    const now = new Date();
    const start = order.programmeStart || now;
    // Cohort billing cycle (lib/sirah/billing-cycle.ts). On the first monthly
    // payment the method decides: bank / JazzCash start the cycle from this
    // verified payment; Stripe keeps exactly the cycle its checkout sent to
    // Stripe (or none, for a checkout made before the cycle existed); PayPal
    // bills on its own anniversary schedule, so never a cycle. Orders without
    // cycle fields keep the legacy anniversary schedule.
    const firstMonthly =
      order.plan === "MONTHLY" && order.paidCount === 0 && !terminal;
    const joinCycle =
      firstMonthly && ["BANK_TRANSFER", "JAZZCASH"].includes(method || "")
        ? startCycle(start, await sirahBillingCycle(tx))
        : null;
    const leaveCycle = firstMonthly && method === "PAYPAL" && !!orderCycle(order);
    const effective = joinCycle
      ? { ...order, ...joinCycle }
      : leaveCycle
        ? { ...order, cycleBillingDay: null, cycleGraceDay: null, cycleFirstDueAt: null }
        : order;
    const cycled =
      order.plan === "MONTHLY"
        ? afterCyclePayment(effective, order.paidCount + 1)
        : null;
    const end =
      joinCycle?.programmeEnd ||
      order.programmeEnd ||
      addMonthsClamped(start, SIRAH_MONTHS);
    const next =
      order.plan === "MONTHLY" && order.paidCount + 1 < SIRAH_MONTHS
        ? cycled
          ? cycled.nextBillingAt
          : addMonthsClamped(start, order.paidCount + 1)
        : null;
    let registrationId = order.registrationId;
    if (!registrationId) {
      const registration = await tx.registration.create({
        data: {
          userId: order.userId,
          courseId: order.courseId,
          selectedCountryCode: order.countryCode,
          selectedCountryName: order.countryName,
          selectedCurrency: order.currency,
          baseAmount: order.discount ? (order.discount as { originalAmountMinor: number }).originalAmountMinor : order.amountMinor,
          couponDiscountAmount: order.discount ? (order.discount as { originalAmountMinor: number }).originalAmountMinor - order.amountMinor : 0,
          finalAmount: order.amountMinor,
          paymentMethod: input.provider,
          paymentReference: order.reference,
          status: terminal ? "PAID" : "ACTIVE",
          pricingSnapshot: jsonValue({
            courseTitle: SIRAH_TITLE,
            batchCode: order.batchCode,
            pricingVersion: order.pricingVersion,
            discount: order.discount,
            currency: order.currency,
            chargeCurrency: order.currency,
            chargeAmount: order.amountMinor,
            months: SIRAH_MONTHS,
            selectedPaymentPlanType:
              order.plan === "ANNUAL" ? "FULL_COURSE" : "SUBSCRIPTION",
            terms: order.terms,
          }),
        },
      });
      registrationId = registration.id;
      await tx.payment.create({
        data: {
          registrationId,
          provider: input.provider,
          providerPaymentId: input.eventId,
          amount: order.amountMinor,
          currency: order.currency,
          status: "CONFIRMED",
          paidAt: now,
        },
      });
      const existing = await tx.enrollment.findUnique({
        where: {
          userId_courseId: { userId: order.userId, courseId: order.courseId },
        },
      });
      // Preserve earlier batch enrolments and receipts. Current-batch access also checks SirahOrder.
      if (!existing)
        await tx.enrollment.create({
          data: {
            userId: order.userId,
            courseId: order.courseId,
            registrationId,
            status: terminal ? "PENDING" : "ACTIVE",
            activatedAt: terminal ? null : now,
          },
        });
    }
    await tx.sirahOrder.update({
      where: { id: order.id },
      data: {
        registrationId,
        method,
        paymentState: ["REFUNDED", "REFUND_PENDING"].includes(
          order.paymentState,
        )
          ? order.paymentState
          : "PAID",
        enrolmentState: terminal ? order.enrolmentState : "ACTIVE",
        paidMinor: { increment: input.amountMinor },
        paidCount: { increment: 1 },
        programmeStart: start,
        programmeEnd: end,
        ...(joinCycle || leaveCycle
          ? {
              cycleBillingDay: effective.cycleBillingDay,
              cycleGraceDay: effective.cycleGraceDay,
              cycleFirstDueAt: effective.cycleFirstDueAt,
            }
          : {}),
        nextBillingAt: terminal ? null : next,
        ...(!terminal
          ? {
              // Manual monthly: paid through the next due date; on the cohort
              // cycle access also runs through that month's grace day.
              accessEndsAt:
                order.plan === "MONTHLY" &&
                ["BANK_TRANSFER", "JAZZCASH"].includes(method || "")
                  ? cycled
                    ? cycled.graceEnd
                    : addMonthsClamped(start, order.paidCount + 1)
                  : null,
            }
          : {}),
        ...(!order.paidCount && !terminal
          ? {
              invitationState: getGroupInvitation(order.countryCode)
                ? "QUEUED"
                : "PENDING",
            }
          : {}),
        revision: { increment: 1 },
      },
    });
    // --- Discount redemption bookkeeping (ADDITIVE; no money logic changed) ---
    // Record the redemption exactly once, on the first paid event for an order
    // that used a personal code. This runs inside the same serializable, event-
    // id-idempotent transaction: a duplicate webhook returns at `seen` above, so
    // replays never reach here. The conditional updateMany (guarded on the read
    // redeemedCount) means two different orders can never push a single-use code
    // past its maxRedemptions.
    const grantId =
      order.paidCount === 0
        ? (order.discount as { grantId?: string } | null)?.grantId
        : undefined;
    if (grantId) {
      const grant = await tx.sirahManualDiscount.findUnique({
        where: { id: grantId },
      });
      if (grant && grant.redeemedCount < grant.maxRedemptions) {
        const redeemer = await tx.user.findUnique({
          where: { id: order.userId },
          select: { email: true },
        });
        await tx.sirahManualDiscount.updateMany({
          where: { id: grantId, redeemedCount: grant.redeemedCount },
          data: {
            redeemedCount: { increment: 1 },
            // Lock-on-first-use: bind the code to the first redeeming student.
            ...(grant.redeemedCount === 0
              ? { redeemedEmail: redeemer?.email ?? null, redeemedOrderId: order.id }
              : {}),
          },
        });
      }
    }
    await auditSirah(tx, order.id, input.actor, "PAYMENT_VERIFIED", {
      provider: input.provider,
      eventId: input.eventId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      note: input.note || null,
      terminal,
    });
    await queueSirahNotice(
      tx,
      order.id,
      terminal
        ? "PAYMENT_RECONCILIATION"
        : order.paidCount
          ? "RENEWED"
          : "CONFIRMED",
      input.eventId,
      input.note,
    );
    if (!terminal && !getGroupInvitation(order.countryCode))
      await queueSirahNotice(
        tx,
        order.id,
        "INVITATION_PENDING",
        `paid:${order.id}`,
      );
    return { duplicate: false };
  });
  await dispatchSirahNotifications(input.orderId).catch(() => {});
  // The classroom welcome follows a first confirmation. Outside the payment
  // transaction and best effort: the sweep queues any welcome missed here.
  // (Loaded lazily: the classroom email service imports canAccessSirah from here.)
  if (!result.duplicate)
    await import("./sirah-classroom-email.service")
      .then(async ({ queueWelcomeForOrder, dispatchClassroomEmails }) => {
        if (await queueWelcomeForOrder(input.orderId)) await dispatchClassroomEmails({ limit: 5 });
      })
      .catch(() => {});
  return result;
}
export function canAccessSirah(
  order: Pick<SirahOrder, "enrolmentState" | "paidCount" | "programmeEnd"> & CycleFields & {
    accessEndsAt?: Date | null;
    pricingVersion?: string;
    plan?: SirahOrder["plan"];
    method?: SirahOrder["method"];
    programmeStart?: Date | null;
  },
  now = new Date(),
) {
  // Also protect pre-fix rows with a null/overlong accessEndsAt. A receipt
  // buys a month of the programme schedule, never the whole year. On the
  // cohort cycle that month runs to a billing day, plus its grace period.
  const manual =
    order.plan === "MONTHLY" &&
    ["BANK_TRANSFER", "JAZZCASH"].includes(order.method || "");
  const manualEnd = !manual
    ? null
    : orderCycle(order)
      ? cycleAccessCeiling(order)
      : order.programmeStart
        ? addMonthsClamped(
            order.programmeStart,
            Math.min(order.paidCount, SIRAH_MONTHS),
          )
        : null;
  return (
    (!manualEnd || manualEnd > now) &&
    (order.paidCount > 0 || order.pricingVersion === SCHOLARSHIP_ORDER_VERSION) &&
    ["ACTIVE", "COMPLETED"].includes(order.enrolmentState) &&
    (!order.programmeEnd || order.programmeEnd > now) &&
    (!order.accessEndsAt || order.accessEndsAt > now)
  );
}
