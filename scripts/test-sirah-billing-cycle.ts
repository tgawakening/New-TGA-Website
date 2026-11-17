/* Sīrah cohort billing cycle: renewal, grace and access computation.
 * Pure: no database or provider is touched.
 *   npm run test:sirah-billing-cycle */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CYCLE_PAYMENTS,
  DEFAULT_SIRAH_CYCLE as C,
  addCycles,
  afterCyclePayment,
  cycleAccessCeiling,
  cycleCopy,
  cycleFieldsForMove,
  cycleGraceEnd,
  cycleProgrammeEnd,
  dueAfterPayments,
  firstRenewalAfterPayment,
  graceEndFor,
  movedRenewal,
  nextDueAfter,
  ordinal,
  startCycle,
  validCycle,
} from "../lib/sirah/billing-cycle";
import { planCycleMove, type MoveCandidate } from "../lib/sirah/billing-cycle-move";
import { canAccessSirah } from "../services/sirah-confirmation.service";
import { paidSirahPeriodEnd } from "../lib/sirah/subscription-access";

/** Pakistan local time → instant. pk("2026-12-07") is 00:00 on 7 Dec in Pakistan. */
const pk = (local: string) => new Date(Date.parse(`${local.length === 10 ? `${local}T00:00:00` : local}+05:00`));
const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;
const DAY = 86400000;

test("the cohort setting: 7th / 15th by default, and only sane values are accepted", () => {
  assert.deepEqual(C, { billingDay: 7, graceDay: 15 });
  assert.ok(validCycle({ billingDay: 7, graceDay: 15 }));
  assert.ok(validCycle({ billingDay: 1, graceDay: 28 }));
  for (const bad of [
    { billingDay: 0, graceDay: 15 },
    { billingDay: 7, graceDay: 7 },
    { billingDay: 15, graceDay: 7 },
    { billingDay: 7, graceDay: 29 },
    { billingDay: 29, graceDay: 30 },
    { billingDay: 7.5, graceDay: 15 },
    { billingDay: null, graceDay: 15 },
  ])
    assert.equal(validCycle(bad), false, JSON.stringify(bad));
});

test("due is 00:00 on the 7th and grace runs through the whole 15th, Pakistan time", () => {
  const due = nextDueAfter(pk("2026-11-17T10:00:00"), C);
  assert.equal(iso(due), iso(pk("2026-12-07")));
  assert.equal(iso(due), "2026-12-06T19:00:00.000Z");
  const graceEnd = graceEndFor(due, C);
  assert.equal(iso(graceEnd), iso(pk("2026-12-16")), "access ends as the 16th begins");
  assert.equal(iso(graceEnd), "2026-12-15T19:00:00.000Z");
  // The 7th itself (Pakistan) is not "after" a due at 00:00 on the 7th.
  assert.equal(iso(nextDueAfter(pk("2026-12-07"), C)), iso(pk("2027-01-07")));
  assert.equal(iso(nextDueAfter(pk("2026-12-06T23:59:59"), C)), iso(pk("2026-12-07")));
  // Late on the 6th in London is already the 7th in Pakistan.
  assert.equal(iso(nextDueAfter(new Date("2026-12-06T20:00:00Z"), C)), iso(pk("2027-01-07")));
});

test("first renewal for a new joiner: next 7th, or the one after if it is under 15 days away", () => {
  const cases: [string, string][] = [
    ["2026-11-17", "2026-12-07"], // 20 days
    ["2026-11-22", "2026-12-07"], // 15 days: still the next 7th
    ["2026-11-23", "2027-01-07"], // 14 days: the following 7th
    ["2026-11-30", "2027-01-07"],
    ["2026-12-01", "2027-01-07"],
    ["2026-12-06", "2027-01-07"], // 1 day
    ["2026-12-07", "2027-01-07"], // paid on the due day itself
    ["2026-12-08", "2027-01-07"], // 30 days
    ["2026-12-31", "2027-02-07"], // 7 days → following
    ["2027-01-23", "2027-02-07"], // 15 days
    ["2027-01-24", "2027-03-07"], // 14 days
    ["2028-01-24", "2028-03-07"], // leap year February
  ];
  for (const [paid, due] of cases)
    assert.equal(iso(firstRenewalAfterPayment(pk(`${paid}T15:30:00`), C)), iso(pk(due)), `paid ${paid}`);
  // Time of day does not matter, only the Pakistan calendar day.
  assert.equal(iso(firstRenewalAfterPayment(pk("2026-11-22T00:00:01"), C)), iso(pk("2026-12-07")));
  assert.equal(iso(firstRenewalAfterPayment(pk("2026-11-22T23:59:59"), C)), iso(pk("2026-12-07")));
});

test("every possible join day gets a first period of 15 to 45 days, always ending on a 7th", () => {
  for (let t = pk("2026-01-01").getTime(); t < pk("2028-01-01").getTime(); t += DAY) {
    const paid = new Date(t + 9 * 3600000);
    const due = firstRenewalAfterPayment(paid, C);
    const days = (due.getTime() - pk(paid.toISOString().slice(0, 10)).getTime()) / DAY;
    assert.ok(days >= 15 && days <= 46, `${paid.toISOString()} → ${days} days`);
    assert.equal(new Date(due.getTime() + 5 * 3600000).getUTCDate(), 7);
    assert.equal(due.getUTCHours(), 19);
  }
});

test("a cycle order's schedule: twelve payments, one billing day apart, ending on the 7th", () => {
  const order = startCycle(pk("2026-11-17T12:00:00"), C);
  assert.equal(iso(order.cycleFirstDueAt), iso(pk("2026-12-07")));
  const dues = Array.from({ length: CYCLE_PAYMENTS }, (_, k) => iso(dueAfterPayments(order, k + 1)));
  assert.deepEqual(dues, [
    "2026-12-07", "2027-01-07", "2027-02-07", "2027-03-07", "2027-04-07", "2027-05-07",
    "2027-06-07", "2027-07-07", "2027-08-07", "2027-09-07", "2027-10-07", "2027-11-07",
  ].map((s) => iso(pk(s))));
  assert.equal(iso(order.programmeEnd), iso(pk("2027-11-07")), "programme ends where the 12th payment's month ends");
  assert.equal(iso(cycleProgrammeEnd(order.cycleFirstDueAt, C)), iso(order.programmeEnd));

  // After the first payment: due 7 Dec, manual access through 15 Dec.
  const first = afterCyclePayment(order, 1)!;
  assert.equal(iso(first.nextBillingAt), iso(pk("2026-12-07")));
  assert.equal(iso(first.paidThrough), iso(pk("2026-12-07")));
  assert.equal(iso(first.graceEnd), iso(pk("2026-12-16")));
  // After the second payment (whenever it is made): due 7 Jan.
  assert.equal(iso(afterCyclePayment(order, 2)!.nextBillingAt), iso(pk("2027-01-07")));
  // Eleventh payment: the last renewal is still due; twelfth: nothing more due.
  assert.equal(iso(afterCyclePayment(order, 11)!.nextBillingAt), iso(pk("2027-10-07")), "the 12th payment is due 7 Oct and runs to the end");
  const last = afterCyclePayment(order, 12)!;
  assert.equal(last.nextBillingAt, null);
  assert.equal(iso(last.graceEnd), iso(order.programmeEnd), "never past the programme end");
});

test("a late payment does not reset the cycle: missed months stay owed", () => {
  const order = startCycle(pk("2026-11-17"), C);
  // Paid the December renewal late, on 20 December: still paid only to 7 January.
  assert.equal(iso(afterCyclePayment(order, 2)!.nextBillingAt), iso(pk("2027-01-07")));
  // Two payments recorded but now it is March: access ceiling is the January grace end.
  const ceiling = cycleAccessCeiling({ ...order, paidCount: 2 });
  assert.equal(iso(ceiling), iso(pk("2027-01-16")));
});

test("access for a manual cycle order: open through the 15th, closed from the 16th", () => {
  const cycle = startCycle(pk("2026-11-17"), C);
  const order = {
    ...cycle,
    plan: "MONTHLY" as const,
    method: "BANK_TRANSFER" as const,
    programmeStart: pk("2026-11-17"),
    paidCount: 1,
    enrolmentState: "ACTIVE" as const,
    accessEndsAt: pk("2026-12-16"),
  };
  assert.equal(canAccessSirah(order, pk("2026-12-06T23:00:00")), true, "before the due date");
  assert.equal(canAccessSirah(order, pk("2026-12-10")), true, "unpaid, inside grace");
  assert.equal(canAccessSirah(order, pk("2026-12-15T23:59:59")), true, "last second of the 15th");
  assert.equal(canAccessSirah(order, pk("2026-12-16")), false, "the 16th: paused");
  // A stale or missing accessEndsAt can never stretch access past the paid month's grace.
  assert.equal(canAccessSirah({ ...order, accessEndsAt: null }, pk("2026-12-15T12:00:00")), true);
  assert.equal(canAccessSirah({ ...order, accessEndsAt: null }, pk("2026-12-16")), false);
  assert.equal(canAccessSirah({ ...order, accessEndsAt: pk("2027-06-01") }, pk("2026-12-20")), false);
  // Paused by the sweep: no access even inside the window.
  assert.equal(canAccessSirah({ ...order, enrolmentState: "PENDING" }, pk("2026-12-10")), false);
  // Two payments: open until 15 Jan.
  assert.equal(canAccessSirah({ ...order, paidCount: 2, accessEndsAt: pk("2027-01-16") }, pk("2027-01-15T20:00:00")), true);
  assert.equal(canAccessSirah({ ...order, paidCount: 2, accessEndsAt: pk("2027-01-16") }, pk("2027-01-16")), false);
});

test("legacy (anniversary) orders keep exactly their old rules", () => {
  const start = new Date("2026-11-17T08:00:00Z");
  const order = {
    plan: "MONTHLY" as const,
    method: "JAZZCASH" as const,
    programmeStart: start,
    programmeEnd: new Date("2027-11-17T08:00:00Z"),
    paidCount: 1,
    enrolmentState: "ACTIVE" as const,
    accessEndsAt: new Date("2026-12-17T08:00:00Z"),
    cycleFirstDueAt: null,
    cycleBillingDay: null,
    cycleGraceDay: null,
  };
  assert.equal(canAccessSirah(order, new Date("2026-12-17T07:59:59Z")), true);
  assert.equal(canAccessSirah(order, new Date("2026-12-17T08:00:00Z")), false);
  assert.equal(cycleGraceEnd(order, pk("2026-12-07")), null, "no cycle grace for a legacy order");
});

test("cancelling: the paid period ends on the due date, never the grace end", () => {
  const cycle = startCycle(pk("2026-11-17"), C);
  const base = {
    ...cycle,
    plan: "MONTHLY" as const,
    paymentState: "PAID" as const,
    cancelledAt: null,
    paidCount: 1,
    accessEndsAt: pk("2026-12-16"),
    nextBillingAt: pk("2026-12-07"),
    programmeStart: pk("2026-11-17"),
  };
  assert.equal(iso(paidSirahPeriodEnd(base)), iso(pk("2026-12-07")));
  assert.equal(iso(paidSirahPeriodEnd({ ...base, paidCount: 3 })), iso(pk("2027-02-07")));
  assert.equal(iso(paidSirahPeriodEnd({ ...base, paidCount: 12 })), iso(cycle.programmeEnd));
});

test("a failed card renewal on the cycle: grace to the end of the 15th of the due month", () => {
  const order = startCycle(pk("2026-11-17"), C);
  // Stripe's renewal timestamp (00:00 on the 7th, Pakistan) and a slightly late one both map to that month.
  assert.equal(iso(cycleGraceEnd(order, pk("2027-03-07"))), iso(pk("2027-03-16")));
  assert.equal(iso(cycleGraceEnd(order, pk("2027-03-07T01:10:00"))), iso(pk("2027-03-16")));
});

test("moving an existing student: the new grace always covers what they have paid for", () => {
  const now = pk("2026-11-18T10:00:00");
  for (let t = pk("2026-11-19").getTime(); t < pk("2027-01-19").getTime(); t += 6 * 3600000) {
    const currentDue = new Date(t);
    const due = movedRenewal(currentDue, now, C, true);
    assert.equal(new Date(due.getTime() + 5 * 3600000).getUTCDate(), 7, "lands on a 7th");
    assert.ok(due > now, "a paid-up student is never made due by the move");
    assert.ok(graceEndFor(due, C) >= currentDue, `grace covers paid access (${currentDue.toISOString()})`);
    const shift = (due.getTime() - currentDue.getTime()) / DAY;
    assert.ok(shift >= -9 && shift < 23, `shift ${shift} days for ${currentDue.toISOString()}`);
  }
  // The rule in words: renewal on the 1st–15th → the 7th of that month; the 16th or later → the next 7th.
  const table: [string, string][] = [
    ["2026-12-01", "2026-12-07"],
    ["2026-12-07", "2026-12-07"],
    ["2026-12-10", "2026-12-07"],
    ["2026-12-15T12:00:00", "2026-12-07"],
    ["2026-12-16", "2026-12-07"], // paid to 00:00 on the 16th = through the 15th
    ["2026-12-16T09:00:00", "2027-01-07"],
    ["2026-12-17", "2027-01-07"],
    ["2026-12-31", "2027-01-07"],
  ];
  for (const [cur, expected] of table) assert.equal(iso(movedRenewal(pk(cur), now, C, true)), iso(pk(expected)), cur);
  // Paid to 20 Nov while it is the 18th: 7 Nov would already be past, so 7 Dec.
  assert.equal(iso(movedRenewal(pk("2026-11-20"), now, C, true)), iso(pk("2026-12-07")));
  // Not in good standing: never pushed forward past what is owed.
  assert.equal(iso(movedRenewal(pk("2026-11-10"), now, C, false)), iso(pk("2026-11-07")));
});

test("moving an existing student: the schedule continues from the payments already made", () => {
  const fields = cycleFieldsForMove(pk("2026-12-07"), 3, C);
  assert.equal(iso(fields.cycleFirstDueAt), iso(pk("2026-10-07")), "virtual first due, two cycles back");
  assert.equal(iso(dueAfterPayments(fields, 3)), iso(pk("2026-12-07")));
  assert.equal(iso(fields.programmeEnd), iso(pk("2027-09-07")), "nine more cycles to the end");
  assert.equal(iso(addCycles(pk("2026-12-07"), 9, C)), iso(fields.programmeEnd));
});

const candidate = (over: Partial<MoveCandidate>): MoveCandidate => ({
  id: "o1", reference: "SIRAH-TEST", plan: "MONTHLY", method: "BANK_TRANSFER",
  paymentState: "PAID", enrolmentState: "ACTIVE", paidCount: 2, cancelledAt: null, archivedAt: null,
  programmeStart: new Date("2026-10-17T08:00:00Z"), programmeEnd: new Date("2027-10-17T08:00:00Z"),
  nextBillingAt: new Date("2026-12-17T08:00:00Z"), accessEndsAt: new Date("2026-12-17T08:00:00Z"),
  cycleFirstDueAt: null, ...over,
});

test("the migration planner: who moves, who is reviewed, who is kept", () => {
  const now = pk("2026-11-18T10:00:00");
  const moved = planCycleMove(candidate({}), now, C);
  assert.equal(moved.outcome, "MOVE");
  assert.equal(iso(moved.after!.nextBillingAt), iso(pk("2027-01-07")));
  assert.equal(iso(moved.after!.accessEndsAt), iso(pk("2027-01-16")));
  assert.equal(moved.shiftDays, 20);
  assert.equal(iso(moved.after!.cycleFirstDueAt), iso(pk("2026-12-07")));
  assert.equal(iso(dueAfterPayments(moved.after!, 2)), iso(moved.after!.nextBillingAt));

  const early = planCycleMove(candidate({ nextBillingAt: new Date("2026-12-12T08:00:00Z") }), now, C);
  assert.equal(early.outcome, "MOVE");
  assert.equal(iso(early.after!.nextBillingAt), iso(pk("2026-12-07")));
  assert.equal(iso(early.after!.accessEndsAt), iso(pk("2026-12-16")), "still has access through the 15th, after the old 12 Dec");

  assert.equal(planCycleMove(candidate({ paymentState: "AWAITING_REVIEW" }), now, C).outcome, "MOVE");
  const paused = planCycleMove(candidate({ enrolmentState: "PENDING", paymentState: "UNPAID", nextBillingAt: new Date("2026-11-10T08:00:00Z") }), now, C);
  assert.equal(paused.outcome, "REVIEW");
  assert.equal(iso(paused.after!.accessEndsAt), iso(new Date("2026-12-17T08:00:00Z")), "access fields untouched for a paused student");

  assert.equal(planCycleMove(candidate({ method: "STRIPE" }), now, C).outcome, "KEEP");
  assert.equal(planCycleMove(candidate({ method: "PAYPAL" }), now, C).outcome, "KEEP");
  assert.equal(planCycleMove(candidate({ plan: "ANNUAL" }), now, C).outcome, "SKIP");
  assert.equal(planCycleMove(candidate({ paidCount: 0 }), now, C).outcome, "SKIP");
  assert.equal(planCycleMove(candidate({ paidCount: 12 }), now, C).outcome, "SKIP");
  assert.equal(planCycleMove(candidate({ cancelledAt: now }), now, C).outcome, "SKIP");
  assert.equal(planCycleMove(candidate({ paymentState: "REFUNDED" }), now, C).outcome, "SKIP");
  assert.equal(planCycleMove(candidate({ cycleFirstDueAt: pk("2026-12-07") }), now, C).outcome, "SKIP");
  assert.equal(planCycleMove(candidate({ archivedAt: now }), now, C).outcome, "SKIP");
  assert.equal(planCycleMove(candidate({ nextBillingAt: null, programmeStart: null }), now, C).outcome, "REVIEW");
});

test("the student-facing wording", () => {
  assert.deepEqual(cycleCopy(C), {
    due: "Renewal due: 7th of each month",
    grace: "Grace period: until the 15th",
    explain:
      "Your monthly payment is due on the 7th, the day the cohort's month begins; if it hasn't been paid by then, your access continues until the end of the 15th, and after that it pauses until the payment is received.",
  });
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 28].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "28th"]);
  assert.equal(cycleCopy({ billingDay: 1, graceDay: 3 }).due, "Renewal due: 1st of each month");
});
