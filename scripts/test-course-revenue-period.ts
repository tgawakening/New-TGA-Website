import assert from "node:assert/strict";
import test from "node:test";
import { inRevenuePeriod, karachiMonth, previousMonth, reportPeriod } from "../lib/sirah/course-revenue-period";

test("Karachi months include the correct UTC boundaries", () => {
  const now = new Date("2026-11-30T19:10:00Z");
  assert.equal(karachiMonth(now), "2026-12");
  const period = reportPeriod("2026-11", now);
  assert.equal(period.start?.toISOString(), "2026-10-31T19:00:00.000Z");
  assert.equal(period.end?.toISOString(), "2026-11-30T19:00:00.000Z");
  assert.equal(inRevenuePeriod(new Date("2026-10-31T18:59:59Z"), period), false);
  assert.equal(inRevenuePeriod(new Date("2026-10-31T19:00:00Z"), period), true);
  assert.equal(inRevenuePeriod(new Date("2026-11-30T19:00:00Z"), period), false);
  assert.equal(inRevenuePeriod(null, period), false);
  assert.equal(inRevenuePeriod(null, reportPeriod("all", now)), true);
  assert.equal(previousMonth("2026-01"), "2025-12");
  assert.equal(reportPeriod("2027-01", now).key, "2026-12");
});
