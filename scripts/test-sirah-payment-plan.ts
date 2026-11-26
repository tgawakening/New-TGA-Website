import { strict as assert } from "node:assert";
import { test } from "node:test";
import { paymentPlanPeriods, remainingArrears, totalPlanOutstanding, type PlanTerms, type StoredPeriod } from "../lib/sirah/payment-plan";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const terms: PlanTerms = { firstDueAt: date("2026-03-31"), billingDay: 31, monthlyMinor: 1000, arrearsPartMinor: 0, openingArrearsMinor: 4000, changeAt: date("2026-04-01"), nextMonthlyMinor: 5000, nextArrearsMinor: 2000 };

test("phase changes apply on the first due date after the change, and arrears are scheduled only once", () => {
  const periods = paymentPlanPeriods(terms, [], date("2026-07-31"));
  assert.deepEqual(periods.map(p => [p.periodMonth, p.dueAt.toISOString().slice(0, 10), p.amountMinor, p.arrearsPartMinor]), [
    ["2026-03", "2026-03-31", 1000, 0], ["2026-04", "2026-04-30", 5000, 2000], ["2026-05", "2026-05-31", 5000, 2000], ["2026-06", "2026-06-30", 3000, 0], ["2026-07", "2026-07-31", 3000, 0],
  ]);
  assert.equal(totalPlanOutstanding(4000, periods), 17000);
});

test("partial payments repay the regular amount before arrears and cannot double-count old arrears", () => {
  const periods = [
    { amountMinor: 5000, arrearsPartMinor: 2000, paidMinor: 4000 },
    { amountMinor: 5000, arrearsPartMinor: 2000, paidMinor: 2000 },
  ];
  assert.equal(remainingArrears(4000, periods), 3000);
  assert.equal(totalPlanOutstanding(4000, periods), 4000);
  assert.equal(remainingArrears(500, [{ amountMinor: 1000, arrearsPartMinor: 1000, paidMinor: 1000 }]), 0);
});

test("stored periods preserve prior terms when the plan changes", () => {
  const saved: StoredPeriod[] = [{ id: "period", periodMonth: "2026-03", dueAt: date("2026-03-31"), amountMinor: 800, arrearsPartMinor: 0, payments: [{ amountMinor: 300 }] }];
  const [march] = paymentPlanPeriods({ ...terms, monthlyMinor: 9000, billingDay: 10 }, saved, date("2026-03-31"));
  assert.equal(march.amountMinor, 800);
  assert.equal(march.paidMinor, 300);
  assert.equal(march.dueAt.toISOString().slice(0, 10), "2026-03-31");
});
