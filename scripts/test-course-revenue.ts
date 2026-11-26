import assert from "node:assert/strict";
import { test } from "node:test";
import { addMoney, moneyGroups, planNextDueTotals, revenueProgram } from "../lib/sirah/course-revenue";

test("legacy and newer Seerah registrations are separate programs despite sharing a course", () => {
  const c = { id: "course", slug: "seerah-course", title: "Sīrah" };
  assert.notEqual(revenueProgram(c, "legacy").id, revenueProgram(c, "sirah").id);
  assert.equal(revenueProgram({ id: "other", slug: "other", title: "Other" }, "legacy").id, "other");
});
test("currencies remain separate and unsafe sums fail", () => {
  const groups = new Map<string, number>();
  addMoney(groups, "PKR", 100); addMoney(groups, "GBP", 200); addMoney(groups, "PKR", 300);
  assert.deepEqual(moneyGroups(groups), [{ currency: "GBP", amountMinor: 200 }, { currency: "PKR", amountMinor: 400 }]);
  assert.throws(() => addMoney(groups, "PKR", Number.MAX_SAFE_INTEGER));
});
test("future plan amounts use phase changes and never re-charge allocated arrears", () => {
  const plan = { firstDueAt: new Date("2026-03-01T00:00:00Z"), billingDay: 1, monthlyMinor: 1000, arrearsPartMinor: 0, openingArrearsMinor: 4000, changeAt: new Date("2026-04-01T00:00:00Z"), nextMonthlyMinor: 5000, nextArrearsMinor: 2000 };
  assert.deepEqual(planNextDueTotals(plan, [], new Date("2026-03-15T00:00:00Z")), { dueMinor: 1000, upcomingMinor: 5000 });
  const futurePlan = { ...plan, firstDueAt: new Date("2026-12-01T00:00:00Z") };
  assert.deepEqual(planNextDueTotals(futurePlan, [], new Date("2026-03-15T00:00:00Z")), { dueMinor: 0, upcomingMinor: 5000 });
});
