import { strict as assert } from "node:assert";
import { test } from "node:test";
import { monthlyDueDate, nextMonthlyDue, periodStatus, planDate } from "../lib/sirah/payment-plan-dates";

test("billing days clamp in short months without drifting", () => {
  const january = monthlyDueDate(2024, 0, 31);
  const february = nextMonthlyDue(january, 31);
  assert.equal(february.toISOString().slice(0, 10), "2024-02-29");
  assert.equal(nextMonthlyDue(february, 31).toISOString().slice(0, 10), "2024-03-31");
  assert.equal(monthlyDueDate(2025, 1, 31).toISOString().slice(0, 10), "2025-02-28");
});

test("periods become overdue after the due date and partial payments remain due", () => {
  const due = planDate("2026-03-31");
  assert.equal(periodStatus(due, 5000, 3000, planDate("2026-03-31")), "DUE");
  assert.equal(periodStatus(due, 5000, 3000, planDate("2026-04-01")), "OVERDUE");
  assert.equal(periodStatus(due, 5000, 3000, new Date("2026-03-31T19:00:00.000Z")), "OVERDUE");
  assert.equal(periodStatus(due, 5000, 5000, planDate("2026-04-01")), "PAID");
});

test("invalid dates and billing days are rejected", () => {
  assert.throws(() => planDate("2026-02-30"));
  assert.throws(() => monthlyDueDate(2026, 0, 32));
});
