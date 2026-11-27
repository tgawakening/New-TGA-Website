import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateCourseRevenue } from "../services/course-revenue.service";
import { reportPeriod } from "../lib/sirah/course-revenue-period";
import { formattedAmounts } from "../components/sirah/course-revenue-display";

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
  assert.deepEqual(report.totals.pending, [{ currency: "GBP", amountMinor: 500 }, { currency: "PKR", amountMinor: 30000 }]);
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

test("monthly receipts use Karachi payment dates and refunds use verification dates", () => {
  const course = { id: "c", slug: "seerah-course", title: "Sīrah" };
  const now = new Date("2026-12-15T00:00:00Z");
  const order = { reference: "R", course, currency: "GBP", amountMinor: 1000, paymentState: "PAID", enrolmentState: "ACTIVE", paymentPlan: null,
    events: [
      { id: "first", kind: "FIRST", provider: "STRIPE", amountMinor: 1000, currency: "GBP", createdAt: new Date("2026-10-31T19:00:00Z") },
      { id: "renewal", kind: "RENEWAL", provider: "STRIPE", amountMinor: 500, currency: "GBP", createdAt: new Date("2026-11-30T19:00:00Z") },
      { id: "refund-a", kind: "REFUND", provider: "STRIPE", amountMinor: 300, currency: "GBP", createdAt: new Date("2026-11-29T00:00:00Z") },
      { id: "refund-unknown", kind: "REFUND", provider: "STRIPE", amountMinor: 50, currency: "GBP", createdAt: new Date("2026-11-10T00:00:00Z") },
    ], audits: [{ detail: { refundId: "refund-a" }, createdAt: new Date("2026-11-30T19:01:00Z") }], ledgerPayments: [] };
  const november = aggregateCourseRevenue([course], [], [order], now, reportPeriod("2026-11", now));
  assert.deepEqual(november.totals.received, [{ currency: "GBP", amountMinor: 1000 }]);
  assert.deepEqual(november.totals.refunds, []);
  assert.equal(november.totals.undatedRefunds, 1);
  const december = aggregateCourseRevenue([course], [], [order], now, reportPeriod("2026-12", now));
  assert.deepEqual(december.totals.received, [{ currency: "GBP", amountMinor: 500 }]);
  assert.deepEqual(december.totals.refunds, [{ currency: "GBP", amountMinor: 300 }]);
  const all = aggregateCourseRevenue([course], [], [order], now);
  assert.deepEqual(all.totals.received, [{ currency: "GBP", amountMinor: 1500 }]);
  assert.deepEqual(all.totals.refunds, [{ currency: "GBP", amountMinor: 350 }]);
});

test("removing a ledger-only payment updates received and net on the next report", () => {
  const course = { id: "c", slug: "seerah-course", title: "Sirah" };
  const at = new Date("2026-11-25T00:00:00Z");
  const order = { reference: "R", course, currency: "PKR", amountMinor: 300000, paymentState: "PAID", enrolmentState: "ACTIVE", events: [], paymentPlan: null, ledgerPayments: [
    { id: "one", method: "CASH", amountMinor: 150000, currency: "PKR", receivedAt: at },
    { id: "two", method: "CASH", amountMinor: 150000, currency: "PKR", receivedAt: at },
  ] };
  const before = aggregateCourseRevenue([course], [], [order], at);
  const after = aggregateCourseRevenue([course], [], [{ ...order, ledgerPayments: order.ledgerPayments.slice(0, 1) }], at);
  assert.deepEqual(before.totals.received, [{ currency: "PKR", amountMinor: 300000 }]);
  assert.deepEqual(after.totals.received, [{ currency: "PKR", amountMinor: 150000 }]);
  assert.deepEqual(after.totals.refunds, []);
});

test("legacy amounts use pence for GBP and whole units for PKR throughout the report", () => {
  const course = { id: "c", slug: "seerah-course", title: "Sirah" };
  const at = new Date("2026-11-25T00:00:00Z");
  const base = { paymentReference: null, pricingSnapshot: {}, course, status: "ACTIVE", finalAmount: 2000, selectedCurrency: "PKR" };
  const payment = { id: "jazzcash", amount: 2000, currency: "PKR", provider: "JAZZCASH", status: "CONFIRMED", paidAt: at, createdAt: at, rawPayloadJson: {} };
  const registrations = [
    { ...base, id: "paid", payment },
    { ...base, id: "pounds", selectedCurrency: "GBP", payment: { ...payment, id: "stripe", amount: 1094, currency: "GBP", provider: "STRIPE", rawPayloadJson: { payment_status: "paid" } } },
    { ...base, id: "review", payment: { ...payment, id: "uncertain", provider: "STRIPE", rawPayloadJson: {} } },
    { ...base, id: "pending", status: "PENDING_PAYMENT", payment: null },
  ];
  const order = { reference: "new", course, currency: "PKR", amountMinor: 1500, paymentState: "PAID", enrolmentState: "ACTIVE", events: [{ id: "event", provider: "JAZZCASH", amountMinor: 1500, currency: "PKR", createdAt: at }], ledgerPayments: [], paymentPlan: null };
  const report = aggregateCourseRevenue([course], registrations, [order], at);
  const legacy = report.programs.find(row => row.id === "c:legacy")!;
  const sirah = report.programs.find(row => row.id === "c:sirah")!;
  assert.deepEqual(legacy.received, [{ currency: "GBP", amountMinor: 1094 }, { currency: "PKR", amountMinor: 200000 }]);
  assert.deepEqual(formattedAmounts(legacy.received).map(text => text.replace(/\s+/g, " ")), ["GBP 10.94", "PKR 2,000.00"]);
  assert.deepEqual(legacy.pending, [{ currency: "PKR", amountMinor: 200000 }]);
  assert.deepEqual(legacy.ambiguous, [{ currency: "PKR", amountMinor: 200000 }]);
  assert.equal(legacy.review[0].amountMinor, 200000);
  assert.deepEqual(sirah.received, [{ currency: "PKR", amountMinor: 1500 }]);
  assert.deepEqual(report.totals.received, [{ currency: "GBP", amountMinor: 1094 }, { currency: "PKR", amountMinor: 201500 }]);
});
