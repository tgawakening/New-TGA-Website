import assert from "node:assert/strict";
import { before, test } from "node:test";
import type { Prisma } from "@prisma/client";
import { savePaymentPlan } from "../services/sirah-payment-plan.service";

type Period = { id: string; planId: string; periodMonth: string; dueAt: Date; amountMinor: number; arrearsPartMinor: number };
type Payment = { id: string; orderId: string; periodId: string | null; amountMinor: number; currency: string; receivedAt: Date };
function fixture() {
  let plan: Record<string, unknown> | null = null;
  const periods: Period[] = [], payments: Payment[] = [];
  const tx = {
    sirahPaymentPlan: {
      findUnique: async () => plan && ({ ...plan, periods: periods.map(period => ({ ...period, payments: payments.filter(payment => payment.periodId === period.id) })) }),
      create: async ({ data }: { data: Record<string, unknown> }) => { plan = { id: "plan", ...data }; return plan; },
      update: async ({ data }: { data: Record<string, unknown> }) => { plan = { ...plan!, ...data }; return plan; },
    },
    sirahPaymentPeriod: { create: async ({ data }: { data: Omit<Period, "id"> }) => { const row = { id: `period-${periods.length}`, ...data }; periods.push(row); return row; } },
    sirahLedgerPayment: {
      findMany: async () => payments.filter(payment => payment.periodId === null).sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id)),
      updateMany: async ({ where, data }: { where: { id: string; orderId: string; periodId: null }; data: { periodId: string } }) => { const row = payments.find(payment => payment.id === where.id && payment.orderId === where.orderId && payment.periodId === null); if (!row) return { count: 0 }; row.periodId = data.periodId; return { count: 1 }; },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, periods, payments };
}
const now = new Date();
const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
const firstDue = first.toISOString().slice(0, 10);
const input = { monthly: "1500", arrearsPart: "0", billingDay: 1, firstDue, openingArrears: "0", changeAt: "" };
const payment = (id: string, amountMinor: number, date: string): Payment => ({ id, orderId: "order", periodId: null, amountMinor, currency: "PKR", receivedAt: new Date(date) });

before(() => assert.ok(firstDue));
test("plan setup links old payments to earliest open periods in date order and is idempotent", async () => {
  const f = fixture();
  f.payments.push(payment("later", 150000, "2026-03-01T00:00:00Z"), payment("early", 50000, "2026-01-01T00:00:00Z"), payment("middle", 100000, "2026-02-01T00:00:00Z"));
  await savePaymentPlan(f.tx, "order", "PKR", input);
  assert.equal(f.payments[1].periodId, f.periods[0].id);
  assert.equal(f.payments[2].periodId, f.periods[0].id);
  assert.equal(f.payments[0].periodId, f.periods[1].id);
  const links = f.payments.map(row => row.periodId);
  await savePaymentPlan(f.tx, "order", "PKR", input);
  assert.deepEqual(f.payments.map(row => row.periodId), links);
  assert.deepEqual(f.payments.map(row => row.amountMinor), [150000, 50000, 100000]);
});
test("an oversized payment remains unlinked while later clean payments are allocated", async () => {
  const f = fixture(); f.payments.push(payment("large", 300000, "2026-01-01T00:00:00Z"), payment("clean", 150000, "2026-02-01T00:00:00Z"));
  const saved = await savePaymentPlan(f.tx, "order", "PKR", input);
  assert.deepEqual(saved.reconciliation, { linkedCount: 1, unlinkedCount: 1 });
  assert.equal(f.payments[0].periodId, null);
  assert.equal(f.payments[0].amountMinor, 300000);
  assert.equal(f.payments[1].periodId, f.periods[0].id);
  await savePaymentPlan(f.tx, "order", "PKR", input);
  assert.equal(f.payments[0].periodId, null);
  assert.equal(f.payments[1].periodId, f.periods[0].id);
});
test("currency mismatch is refused before linking", async () => {
  const f = fixture(); f.payments.push({ ...payment("wrong", 1000, "2026-01-01T00:00:00Z"), currency: "GBP" });
  await assert.rejects(() => savePaymentPlan(f.tx, "order", "PKR", input), /currencies differ/);
  assert.equal(f.payments[0].periodId, null);
});
test("payments beyond elapsed periods create only the future periods needed", async () => {
  const f = fixture();
  f.payments.push(...Array.from({ length: 4 }, (_, i) => payment(`p${i}`, 150000, `2026-01-0${i + 1}T00:00:00Z`)));
  await savePaymentPlan(f.tx, "order", "PKR", input);
  assert.equal(new Set(f.payments.map(row => row.periodId)).size, 4);
  assert.equal(f.periods.length, 4);
});
test("a future first due date creates and links its first period", async () => {
  const f = fixture(); f.payments.push(payment("advance", 150000, "2026-01-01T00:00:00Z"));
  const future = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1)).toISOString().slice(0, 10);
  await savePaymentPlan(f.tx, "order", "PKR", { ...input, firstDue: future });
  assert.equal(f.periods.length, 1);
  assert.equal(f.periods[0].periodMonth, future.slice(0, 7));
  assert.equal(f.payments[0].periodId, f.periods[0].id);
});
test("payments without any future amount due remain unlinked without creating empty future periods", async () => {
  const f = fixture();
  const local = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const current = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1)).toISOString().slice(0, 10);
  f.payments.push(payment("first", 150000, "2026-01-01T00:00:00Z"), payment("extra", 100000, "2026-02-01T00:00:00Z"));
  const saved = await savePaymentPlan(f.tx, "order", "PKR", { ...input, firstDue: current, arrearsPart: "1500", openingArrears: "1500" });
  assert.deepEqual(saved.reconciliation, { linkedCount: 1, unlinkedCount: 1 });
  assert.equal(f.periods.length, 1);
  assert.equal(f.payments[1].periodId, null);
});
