/* Sīrah monthly renewals on the cohort cycle.
 *
 * Management decision (Nov 2026): monthly renewals are due on the cohort's
 * billing day (the 7th, the cohort commencement day) for every student, with
 * a grace period that keeps access open through the cohort's grace day (the
 * 15th). Unpaid after the grace day, access pauses until payment is verified.
 *
 * Pure functions only (no database, no provider). Every date the services
 * store or compare for a cycle order is computed here, so the rules can be
 * tested on their own (scripts/test-sirah-billing-cycle.ts).
 *
 * Calendar days are Pakistan calendar days (Asia/Karachi, UTC+5 all year,
 * no daylight saving), the cohort's published time zone:
 *   - "due on the 7th"     = 00:00 on the 7th, Pakistan time
 *   - "grace until the 15th" = through the whole 15th, so access ends at
 *     00:00 on the 16th, Pakistan time.
 *
 * Orders store their own copy of the days (cycleBillingDay, cycleGraceDay)
 * and the first due date (cycleFirstDueAt). A later change to the cohort
 * setting therefore never moves an enrolled student's dates silently. An
 * order without these fields is on the legacy anniversary schedule.
 */

const PKT_OFFSET_MS = 5 * 3600 * 1000;
const DAY_MS = 86400000;

export type BillingCycle = { billingDay: number; graceDay: number };

/** The current cohort's setting, used when the cohort row has none. */
export const DEFAULT_SIRAH_CYCLE: BillingCycle = { billingDay: 7, graceDay: 15 };

/** A first payment always covers at least this many days. If the next
 * billing day is closer than this, the first renewal is the one after it. */
export const FIRST_PERIOD_MIN_DAYS = 15;

/** The programme is twelve monthly payments. */
export const CYCLE_PAYMENTS = 12;

/** Days 1–28 only, so every month has the day; grace must come after the
 * billing day within the same month. */
export function validCycle(cycle: { billingDay?: unknown; graceDay?: unknown } | null | undefined): cycle is BillingCycle {
  const b = cycle?.billingDay;
  const g = cycle?.graceDay;
  return (
    Number.isInteger(b) && Number.isInteger(g) &&
    (b as number) >= 1 && (b as number) <= 28 &&
    (g as number) > (b as number) && (g as number) <= 28
  );
}

/** Pakistan calendar date of an instant. */
function pkt(d: Date) {
  const p = new Date(d.getTime() + PKT_OFFSET_MS);
  return { y: p.getUTCFullYear(), m: p.getUTCMonth(), day: p.getUTCDate() };
}

/** 00:00 Pakistan time on a calendar day (month may overflow; Date.UTC normalises it). */
function pktMidnight(y: number, m: number, day: number) {
  return new Date(Date.UTC(y, m, day) - PKT_OFFSET_MS);
}

/** The billing-day instant in the Pakistan calendar month that contains `d`. */
export function dueInMonthOf(d: Date, cycle: BillingCycle) {
  const { y, m } = pkt(d);
  return pktMidnight(y, m, cycle.billingDay);
}

/** Move a billing-day instant by whole cycles (months). */
export function addCycles(due: Date, n: number, cycle: BillingCycle) {
  const { y, m } = pkt(due);
  return pktMidnight(y, m + n, cycle.billingDay);
}

/** Access in grace ends at the end of the grace day of the due date's month. */
export function graceEndFor(due: Date, cycle: BillingCycle) {
  const { y, m } = pkt(due);
  return pktMidnight(y, m, cycle.graceDay + 1);
}

/** The first billing day strictly after an instant. */
export function nextDueAfter(at: Date, cycle: BillingCycle) {
  const inMonth = dueInMonthOf(at, cycle);
  return inMonth > at ? inMonth : addCycles(inMonth, 1, cycle);
}

/** Whole Pakistan calendar days from the day of `from` to `due`. */
function calendarDaysUntil(from: Date, due: Date) {
  const { y, m, day } = pkt(from);
  return Math.round((due.getTime() - pktMidnight(y, m, day).getTime()) / DAY_MS);
}

/**
 * First renewal for a student whose first payment is made at `paidAt`.
 * Normally the next billing day; but if that is fewer than
 * FIRST_PERIOD_MIN_DAYS calendar days away, the billing day after it, so a
 * late-month joiner is not charged again almost immediately.
 * Examples (7th / 15 days): paid 17 Nov → 7 Dec (20 days);
 * paid 22 Nov → 7 Dec (15 days); paid 23 Nov → 7 Jan (45 days);
 * paid 7 Dec → 7 Jan; paid 6 Dec → 7 Jan (32 days).
 */
export function firstRenewalAfterPayment(paidAt: Date, cycle: BillingCycle) {
  const next = nextDueAfter(paidAt, cycle);
  return calendarDaysUntil(paidAt, next) < FIRST_PERIOD_MIN_DAYS ? addCycles(next, 1, cycle) : next;
}

/* ---------- Per-order schedule ---------- */

export type CycleFields = {
  cycleBillingDay?: number | null;
  cycleGraceDay?: number | null;
  cycleFirstDueAt?: Date | null;
};

/** The order's own cycle, or null for a legacy (anniversary) order. */
export function orderCycle(order: CycleFields): (BillingCycle & { firstDue: Date }) | null {
  const cycle = { billingDay: order.cycleBillingDay, graceDay: order.cycleGraceDay };
  if (!order.cycleFirstDueAt || !validCycle(cycle)) return null;
  return { ...cycle, firstDue: order.cycleFirstDueAt };
}

/** The renewal due after `payments` verified payments (1 → the first renewal).
 * Payments are counted in sequence, so missed months stay owed: each payment
 * moves the due date on by exactly one cycle, whenever it is made. */
export function dueAfterPayments(order: CycleFields, payments: number) {
  const c = orderCycle(order);
  if (!c || payments < 1) return null;
  return addCycles(c.firstDue, payments - 1, c);
}

/** End of the programme: the due date that would follow the twelfth payment. */
export function cycleProgrammeEnd(firstDue: Date, cycle: BillingCycle) {
  return addCycles(firstDue, CYCLE_PAYMENTS - 1, cycle);
}

/** The cycle fields a new order takes from the cohort on its first payment. */
export function startCycle(paidAt: Date, cycle: BillingCycle) {
  const firstDue = firstRenewalAfterPayment(paidAt, cycle);
  return {
    cycleBillingDay: cycle.billingDay,
    cycleGraceDay: cycle.graceDay,
    cycleFirstDueAt: firstDue,
    programmeEnd: cycleProgrammeEnd(firstDue, cycle),
  };
}

/**
 * State after a verified payment brings the order to `paidCount` payments:
 * paid through the next due date; with a manual method, access continues
 * through that month's grace day (the maintenance sweep pauses it after).
 */
export function afterCyclePayment(order: CycleFields & { programmeEnd?: Date | null }, paidCount: number) {
  const c = orderCycle(order);
  if (!c) return null;
  const paidThrough = addCycles(c.firstDue, paidCount - 1, c);
  const end = order.programmeEnd ?? cycleProgrammeEnd(c.firstDue, c);
  return {
    nextBillingAt: paidCount < CYCLE_PAYMENTS ? paidThrough : null,
    paidThrough: new Date(Math.min(paidThrough.getTime(), end.getTime())),
    graceEnd: new Date(Math.min(graceEndFor(paidThrough, c).getTime(), end.getTime())),
  };
}

/** Last instant of access a manual (bank / JazzCash) cycle order may have,
 * from its verified payment count alone: the grace end of the month its
 * payments run to. Guards against a stale or missing accessEndsAt. */
export function cycleAccessCeiling(order: CycleFields & { paidCount: number }) {
  const c = orderCycle(order);
  if (!c || order.paidCount < 1) return null;
  return graceEndFor(addCycles(c.firstDue, Math.min(order.paidCount, CYCLE_PAYMENTS) - 1, c), c);
}

/** Grace for a missed renewal due at `due`: open through that month's grace day. */
export function cycleGraceEnd(order: CycleFields, due: Date) {
  const c = orderCycle(order);
  return c ? graceEndFor(due, c) : null;
}

/* ---------- Moving existing students ---------- */

/**
 * New renewal date for a student moving from the anniversary schedule.
 * `currentDue` is their current renewal date: the end of the month they have
 * paid for. The new date is the first billing day whose grace period covers
 * that whole paid month, so nobody loses access they have paid for:
 *   current renewal on the 1st–15th (the whole 16th starts after grace)
 *     → the billing day of that month (up to 6 days later, or up to 9 days
 *       earlier with access still guaranteed through the grace day);
 *   current renewal later in the month → the billing day of the next month.
 *
 * `inGoodStanding`: currently paid up. Such a student must not become due
 * because of the move, so a result that is not after `now` moves on one
 * cycle. A student already paused or overdue is not moved forward: they
 * still owe that month.
 */
export function movedRenewal(currentDue: Date, now: Date, cycle: BillingCycle, inGoodStanding: boolean) {
  let due = dueInMonthOf(currentDue, cycle);
  if (graceEndFor(due, cycle) < currentDue) due = addCycles(due, 1, cycle);
  if (inGoodStanding && due <= now) due = addCycles(due, 1, cycle);
  return due;
}

/** Cycle fields for an existing order with `paidCount` payments whose next
 * renewal moves to `newDue`. */
export function cycleFieldsForMove(newDue: Date, paidCount: number, cycle: BillingCycle) {
  const firstDue = addCycles(dueInMonthOf(newDue, cycle), -(Math.max(paidCount, 1) - 1), cycle);
  return {
    cycleBillingDay: cycle.billingDay,
    cycleGraceDay: cycle.graceDay,
    cycleFirstDueAt: firstDue,
    programmeEnd: cycleProgrammeEnd(firstDue, cycle),
  };
}

/* ---------- Wording (student-facing) ---------- */

export function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] || "th";
  return `${n}${s}`;
}

/** The persistent lines every student on the cycle sees. */
export function cycleCopy(cycle: BillingCycle) {
  const due = ordinal(cycle.billingDay);
  const grace = ordinal(cycle.graceDay);
  return {
    due: `Renewal due: ${due} of each month`,
    grace: `Grace period: until the ${grace}`,
    explain: `Your monthly payment is due on the ${due}, the day the cohort's month begins; if it hasn't been paid by then, your access continues until the end of the ${grace}, and after that it pauses until the payment is received.`,
  };
}

/** Pakistan calendar date, for display ("7 December 2026"). */
export function cycleDateLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(d);
}
