/* Moving existing monthly students onto the cohort billing cycle.
 * Pure planner, used by scripts/sirah-move-to-cohort-cycle.ts and its tests.
 * It decides nothing silently: every order gets an explicit outcome and reason.
 *
 *   MOVE   bank transfer / JazzCash, paid at least once, not cancelled or
 *          refunded, in good standing (ACTIVE, paid or receipt under review):
 *          the renewal moves to a billing day whose grace covers everything
 *          already paid for (lib/sirah/billing-cycle.ts movedRenewal).
 *   REVIEW the same kind of order but paused or overdue: the planner shows the
 *          proposed dates, but it is only moved with an explicit flag, and it
 *          stays paused either way (moving never restores access).
 *   KEEP   card subscriptions (Stripe, PayPal): the provider charges on its
 *          own date, so they stay on the anniversary schedule (phase 1).
 *   SKIP   not a renewing monthly order (annual, unpaid, cancelled, refunded,
 *          complete, already on the cycle).
 */
import {
  CYCLE_PAYMENTS,
  cycleFieldsForMove,
  graceEndFor,
  movedRenewal,
  type BillingCycle,
} from "./billing-cycle";

export type MoveCandidate = {
  id: string;
  reference: string;
  plan: string;
  method: string | null;
  paymentState: string;
  enrolmentState: string;
  paidCount: number;
  cancelledAt: Date | null;
  archivedAt?: Date | null;
  programmeStart: Date | null;
  programmeEnd: Date | null;
  nextBillingAt: Date | null;
  accessEndsAt: Date | null;
  cycleFirstDueAt: Date | null;
};

export type MovePlan = {
  outcome: "MOVE" | "REVIEW" | "KEEP" | "SKIP";
  reason: string;
  before?: { nextBillingAt: Date | null; accessEndsAt: Date | null; programmeEnd: Date | null };
  after?: {
    nextBillingAt: Date;
    accessEndsAt: Date | null;
    programmeEnd: Date;
    cycleBillingDay: number;
    cycleGraceDay: number;
    cycleFirstDueAt: Date;
  };
  /** Whole days the renewal moves: negative = earlier, positive = later. */
  shiftDays?: number;
};

const DAY = 86400000;

/** Legacy schedule: the k-th renewal is k calendar months after the start (UTC, clamped). */
function legacyDue(start: Date, months: number) {
  const r = new Date(start);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

export function planCycleMove(order: MoveCandidate, now: Date, cycle: BillingCycle): MovePlan {
  if (order.archivedAt) return { outcome: "SKIP", reason: "Archived (deleted) record." };
  if (order.plan !== "MONTHLY") return { outcome: "SKIP", reason: "Full-course (annual) payment: no renewals." };
  if (order.cycleFirstDueAt) return { outcome: "SKIP", reason: "Already on the cohort cycle." };
  if (order.paidCount < 1) return { outcome: "SKIP", reason: "No verified payment yet: joins the cycle on first payment." };
  if (order.paidCount >= CYCLE_PAYMENTS) return { outcome: "SKIP", reason: "All 12 payments made." };
  if (order.cancelledAt) return { outcome: "SKIP", reason: "Future payments cancelled." };
  if (["REFUNDED", "REFUND_PENDING"].includes(order.paymentState)) return { outcome: "SKIP", reason: "Refunded or refund pending." };
  if (!["ACTIVE", "PENDING"].includes(order.enrolmentState)) return { outcome: "SKIP", reason: `Enrolment ${order.enrolmentState}.` };
  if (order.method === "STRIPE" || order.method === "PAYPAL")
    return { outcome: "KEEP", reason: `${order.method === "STRIPE" ? "Card (Stripe)" : "PayPal"} subscription: the provider still charges on the original date, so it keeps that schedule for now.` };
  if (order.method !== "BANK_TRANSFER" && order.method !== "JAZZCASH") return { outcome: "SKIP", reason: `Unknown method ${order.method}.` };

  const currentDue =
    order.nextBillingAt ?? (order.programmeStart ? legacyDue(order.programmeStart, order.paidCount) : null);
  if (!currentDue) return { outcome: "REVIEW", reason: "No renewal date or programme start on record: needs a manual decision." };

  const goodStanding =
    order.enrolmentState === "ACTIVE" && ["PAID", "AWAITING_REVIEW"].includes(order.paymentState) && currentDue > now;
  const newDue = movedRenewal(currentDue, now, cycle, goodStanding);
  const fields = cycleFieldsForMove(newDue, order.paidCount, cycle);
  const plan: MovePlan = {
    outcome: goodStanding ? "MOVE" : "REVIEW",
    reason: goodStanding
      ? "Paid up: renewal moves to the cohort cycle; access already paid for is kept."
      : order.enrolmentState === "PENDING"
        ? "Access paused for an unpaid renewal: dates can move, access stays paused until payment."
        : "Renewal overdue: needs a decision before moving.",
    before: { nextBillingAt: order.nextBillingAt, accessEndsAt: order.accessEndsAt, programmeEnd: order.programmeEnd },
    after: {
      nextBillingAt: newDue,
      accessEndsAt: goodStanding ? graceEndFor(newDue, cycle) : order.accessEndsAt,
      programmeEnd: fields.programmeEnd,
      cycleBillingDay: fields.cycleBillingDay,
      cycleGraceDay: fields.cycleGraceDay,
      cycleFirstDueAt: fields.cycleFirstDueAt,
    },
    shiftDays: Math.round((newDue.getTime() - currentDue.getTime()) / DAY),
  };
  return plan;
}
