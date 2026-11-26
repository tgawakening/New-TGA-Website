import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateCourseRevenue } from "../services/course-revenue.service";

test("verified payments, unresolved ledger entries and next plan dues remain distinct by currency and program", () => {
  const course = { id: "course", slug: "seerah-course", title: "Sīrah" };
  const march = new Date("2026-03-10T00:00:00Z");
  const event = { id: "admin-paid:abc", provider: "BANK", amountMinor: 1000, currency: "PKR", createdAt: march };
  const plan = { firstDueAt: new Date("2026-03-01T00:00:00Z"), billingDay: 1, monthlyMinor: 1000, arrearsPartMinor: 0, openingArrearsMinor: 0, changeAt: null, nextMonthlyMinor: null, nextArrearsMinor: null, periods: [] };
  const order = { reference: "R1", course, currency: "PKR", amountMinor: 1000, paymentState: "PAID", enrolmentState: "ACTIVE", events: [event], ledgerPayments: [{ id: "duplicate", method: "BANK", amountMinor: 1000, currency: "PKR", receivedAt: march }, { id: "review", method: "CASH", amountMinor: 2000, currency: "PKR", receivedAt: march }], paymentPlan: plan };
  const unlinked = { ...order, reference: "R2", events: [], ledgerPayments: [{ id: "manual", method: "CASH", amountMinor: 700, currency: "PKR", receivedAt: march }], paymentPlan: null };
  const pending = { ...order, reference: "R3", currency: "GBP", amountMinor: 500, paymentState: "UNPAID", enrolmentState: "PENDING", events: [], ledgerPayments: [], paymentPlan: null };
  const legacy = [{ id: "legacy-a", paymentReference: "legacy-ref", pricingSnapshot: {}, course, status: "ACTIVE", finalAmount: 200, selectedCurrency: "GBP", payment: { id: "payment-a", amount: 200, currency: "GBP", provider: "STRIPE", status: "SUCCEEDED", paidAt: march, createdAt: march, rawPayloadJson: { payment_status: "paid" } } }, { id: "legacy-b", paymentReference: null, pricingSnapshot: {}, course, status: "MANUAL_REVIEW", finalAmount: 300, selectedCurrency: "PKR", payment: null }];
  const report = aggregateCourseRevenue([course], legacy, [order, unlinked, pending], new Date("2026-03-15T00:00:00Z"));
  assert.deepEqual(report.totals.received, [{ currency: "GBP", amountMinor: 200 }, { currency: "PKR", amountMinor: 1700 }]);
  assert.deepEqual(report.totals.ambiguous, [{ currency: "PKR", amountMinor: 2000 }]);
  assert.deepEqual(report.totals.pending, [{ currency: "GBP", amountMinor: 500 }, { currency: "PKR", amountMinor: 300 }]);
  assert.deepEqual(report.totals.due, [{ currency: "PKR", amountMinor: 1000 }]);
  assert.deepEqual(report.totals.upcoming, [{ currency: "PKR", amountMinor: 1000 }]);
  assert.equal(report.programs.find(p => p.id === "course:sirah")?.review[0].reference, "R1");
  assert.equal(report.programs.find(p => p.id === "course:legacy")?.methods[0].method, "STRIPE");
});

test("a PayPal subscription being active and an unpaid Stripe checkout do not prove receipt", () => {
  const course = { id: "c", slug: "seerah-course", title: "Sīrah" }, at = new Date("2026-03-01T00:00:00Z");
  const base = { id: "legacy", paymentReference: null, course, status: "ACTIVE", finalAmount: 1000, selectedCurrency: "GBP", pricingSnapshot: { selectedPaymentPlanType: "SUBSCRIPTION" } };
  const rows = [
    { ...base, id: "paypal", payment: { id: "p", amount: 1000, currency: "GBP", provider: "PAYPAL", status: "SUCCEEDED", paidAt: at, createdAt: at, rawPayloadJson: { status: "ACTIVE" } } },
    { ...base, id: "stripe", payment: { id: "s", amount: 1000, currency: "GBP", provider: "STRIPE", status: "SUCCEEDED", paidAt: at, createdAt: at, rawPayloadJson: { payment_status: "unpaid" } } },
  ];
  const report = aggregateCourseRevenue([course], rows, [], at);
  assert.deepEqual(report.totals.received, []);
  assert.deepEqual(report.totals.ambiguous, [{ currency: "GBP", amountMinor: 2000 }]);
});

test("pending orders with plans are counted once and cancelled plans are not forecast", () => {
  const course = { id: "c", slug: "seerah-course", title: "Sīrah" };
  const plan = { firstDueAt: new Date("2026-04-01T00:00:00Z"), billingDay: 1, monthlyMinor: 1000, arrearsPartMinor: 0, openingArrearsMinor: 0, changeAt: null, nextMonthlyMinor: null, nextArrearsMinor: null, periods: [] };
  const base = { reference: "P", course, currency: "PKR", amountMinor: 1000, paymentState: "UNPAID", enrolmentState: "PENDING", events: [], ledgerPayments: [], paymentPlan: plan };
  const report = aggregateCourseRevenue([course], [], [base, { ...base, reference: "C", enrolmentState: "CANCELLED" }], new Date("2026-03-15T00:00:00Z"));
  assert.deepEqual(report.totals.pending, []);
  assert.deepEqual(report.totals.upcoming, [{ currency: "PKR", amountMinor: 1000 }]);
  assert.equal(report.programs.find(p => p.id === "c:sirah")?.pendingCount, 1);
});
