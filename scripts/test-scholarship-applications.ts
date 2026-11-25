import test from "node:test";
import assert from "node:assert/strict";
import { scholarshipApplicationSchema, approvedMoney, SCHOLARSHIP_ORDER_VERSION } from "../lib/sirah/scholarship-application";
import { canAccessSirah } from "../services/sirah-confirmation.service";

const application = { fullName: "A Student", email: "student@example.org", phone: "+447911123456", countryCode: "GB", arrangementType: "FULL", currency: "GBP", requestedAmount: "", reason: "I need help with the course fee." };
test("validates arrangement and currency precision", () => {
  assert.equal(scholarshipApplicationSchema.safeParse(application).success, true);
  assert.equal(scholarshipApplicationSchema.safeParse({ ...application, arrangementType: "PARTIAL", requestedAmount: "12.34" }).success, true);
  assert.equal(scholarshipApplicationSchema.safeParse({ ...application, arrangementType: "PARTIAL", requestedAmount: "0" }).success, false);
  assert.equal(scholarshipApplicationSchema.safeParse({ ...application, arrangementType: "PARTIAL", requestedAmount: "12.345" }).success, false);
  assert.equal(scholarshipApplicationSchema.safeParse({ ...application, phone: "abc" }).success, false);
  assert.equal(approvedMoney("10.25", "GBP", true), 1025);
  assert.throws(() => approvedMoney("0", "GBP", false));
});
test("only a specifically approved active scholarship order grants access without fake payment", () => {
  const base = { enrolmentState: "ACTIVE", paidCount: 0, programmeEnd: null, cycleBillingDay: null, cycleGraceDay: null, cycleFirstDueAt: null };
  assert.equal(canAccessSirah(base), false);
  assert.equal(canAccessSirah({ ...base, pricingVersion: SCHOLARSHIP_ORDER_VERSION }), true);
  assert.equal(canAccessSirah({ ...base, pricingVersion: SCHOLARSHIP_ORDER_VERSION, enrolmentState: "CANCELLED" }), false);
});
