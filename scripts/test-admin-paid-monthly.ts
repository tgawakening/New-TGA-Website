import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Prisma } from "@prisma/client";

const file = (relative: string) => pathToFileURL(path.resolve(__dirname, relative)).href;
class TestError extends Error { constructor(message: string, public status = 400) { super(message); } }
type Payment = { id: string; orderId: string; periodId: string | null; amountMinor: number; currency: string; receivedAt: Date; method: string };
type Period = { id: string; planId: string; periodMonth: string; dueAt: Date; amountMinor: number; arrearsPartMinor: number };
let order: Record<string, unknown>, plan: Record<string, unknown> | null, payments: Payment[], periods: Period[];
const tx = {
  user: { findUnique: async () => null, create: async () => ({ id: "user", status: "ACTIVE" }) },
  sirahOrder: { findUnique: async () => null },
  sirahLedgerPayment: {
    create: async ({ data }: { data: Omit<Payment, "id" | "periodId"> }) => { const payment = { id: "payment", periodId: null, ...data }; payments.push(payment); return payment; },
    findMany: async () => payments.filter(payment => payment.periodId === null),
    updateMany: async ({ where, data }: { where: { id: string; periodId: null }; data: { periodId: string } }) => { const payment = payments.find(row => row.id === where.id && row.periodId === null); if (!payment) return { count: 0 }; payment.periodId = data.periodId; return { count: 1 }; },
  },
  sirahPaymentPlan: {
    findUnique: async () => plan && ({ ...plan, periods: periods.map(period => ({ ...period, payments: payments.filter(payment => payment.periodId === period.id) })) }),
    create: async ({ data }: { data: Record<string, unknown> }) => { plan = { id: "plan", ...data }; return plan; },
    update: async ({ data }: { data: Record<string, unknown> }) => { plan = { ...plan!, ...data }; return plan; },
  },
  sirahPaymentPeriod: { create: async ({ data }: { data: Omit<Period, "id"> }) => { const period = { id: `period-${periods.length}`, ...data }; periods.push(period); return period; } },
};
mock.module("server-only", { namedExports: {} });
mock.module(file("../lib/prisma.ts"), { namedExports: { prisma: { sirahCohort: { findMany: async () => [] } } } });
mock.module(file("../services/sirah-registration.service.ts"), { namedExports: {
  SirahError: TestError, ensureSirahCourse: async () => ({ id: "course" }),
  createSirahOrderRecord: async (_tx: unknown, data: Record<string, unknown>) => { order = { id: "order", reference: "REF", ...data }; return order; },
  auditSirah: async () => {},
} });
mock.module(file("../services/sirah-confirmation.service.ts"), { namedExports: {
  serializable: async (work: (arg: typeof tx) => unknown) => work(tx),
  confirmSirahPaymentInTransaction: async () => { order.paymentState = "PAID"; order.enrolmentState = "ACTIVE"; },
} });
mock.module(file("../lib/sirah/direct-upload.ts"), { namedExports: { readDirectUpload: async () => { throw new Error("unexpected upload"); }, verifyDirectUpload: async () => { throw new Error("unexpected upload"); } } });
mock.module(file("../services/sirah-receipts.service.ts"), { namedExports: { validateSirahReceipt: async () => { throw new Error("unexpected receipt"); } } });
let create: typeof import("../services/sirah-admin-paid-registration.service").createAdminPaidRegistration;
let snapshot: typeof import("../services/sirah-payment-plan.service").planSnapshot;
before(async () => { ({ createAdminPaidRegistration: create } = await import("../services/sirah-admin-paid-registration.service")); ({ planSnapshot: snapshot } = await import("../services/sirah-payment-plan.service")); });
beforeEach(() => { order = {}; plan = null; payments = []; periods = []; });
const localDate = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
const base = { fullName: "Test Student", email: "student@example.test", phone: "03001234567", country: "PK", cohort: "beyond-chronology-2026", amount: "1500", method: "CASH" as const, paymentDate: localDate, scope: "00000000-0000-4000-8000-000000000000" };
test("monthly add-registration makes a plan and links its received payment to month one", async () => {
  await create({ ...base, plan: "MONTHLY" }, "admin:test");
  assert.equal(order.ledgerFeeMinor, null); assert.equal(order.ledgerFeeCurrency, null);
  assert.equal(order.paymentState, "PAID"); assert.equal(order.enrolmentState, "ACTIVE");
  assert.ok(plan); const created = plan as unknown as { monthlyMinor: number; billingDay: number; firstDueAt: Date };
  assert.equal(created.monthlyMinor, 150000); assert.equal(created.billingDay, Number(localDate.slice(-2))); assert.equal(created.firstDueAt.toISOString().slice(0, 10), localDate);
  assert.equal(periods[0].periodMonth, localDate.slice(0, 7)); assert.equal(periods[0].dueAt.toISOString().slice(0, 10), localDate);
  assert.equal(payments.length, 1); assert.equal(payments[0].periodId, periods[0].id); assert.equal(payments[0].amountMinor, 150000); assert.equal(payments[0].method, "CASH"); assert.equal(payments[0].receivedAt.toISOString().slice(0, 10), localDate);
  const view = await snapshot(tx as unknown as Prisma.TransactionClient, "order");
  assert.equal(view?.periods[0].status, "PAID"); assert.equal(view?.periods[0].paidMinor, 150000);
  assert.equal(view?.periods[1].paidMinor, 0); assert.equal(view?.periods[1].amountMinor, 150000);
});
test("one-off add-registration keeps the original fee and unlinked payment", async () => {
  await create({ ...base, plan: "ANNUAL" }, "admin:test");
  assert.equal(order.ledgerFeeMinor, 150000); assert.equal(order.ledgerFeeCurrency, "PKR"); assert.equal(plan, null); assert.equal(payments[0].periodId, null);
});
