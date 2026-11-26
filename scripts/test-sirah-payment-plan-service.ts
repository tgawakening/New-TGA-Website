import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Prisma } from "@prisma/client";
import { freezePeriods, planSnapshot, savePaymentPlan } from "../services/sirah-payment-plan.service";

test("saving edits freezes current terms and keeps earlier ledger history separate", async () => {
  let plan: Record<string, unknown> | null = null;
  const periods: Record<string, unknown>[] = [];
  const tx = {
    sirahPaymentPlan: {
      findUnique: async () => plan && ({ ...plan, periods: periods.map(period => ({ ...period, payments: [] })) }),
      create: async ({ data }: { data: Record<string, unknown> }) => { plan = { id: "plan", ...data }; return plan; },
      update: async ({ data }: { data: Record<string, unknown> }) => { plan = { ...plan!, ...data }; return plan; },
    },
    sirahPaymentPeriod: { create: async ({ data }: { data: Record<string, unknown> }) => { const period = { id: `p${periods.length}`, ...data }; periods.push(period); return period; } },
  } as unknown as Prisma.TransactionClient;
  const local = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const firstDue = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const initial = { monthly: "50", arrearsPart: "20", billingDay: "1", firstDue, openingArrears: "40", changeAt: "" };
  await savePaymentPlan(tx, "order", "PKR", initial);
  assert.equal((await planSnapshot(tx, "order"))!.periods[0].amountMinor, 5000);
  await savePaymentPlan(tx, "order", "PKR", { ...initial, monthly: "80", arrearsPart: "30", openingArrears: "999" });
  const snapshot = await freezePeriods(tx, "order");
  assert.equal(snapshot!.periods[0].amountMinor, 5000);
  assert.equal(snapshot!.periods[0].arrearsPartMinor, 2000);
  assert.equal(snapshot!.openingArrearsMinor, 4000);
  assert.equal(snapshot!.monthlyMinor, 8000);
  assert.equal(periods.length, 1);
  await assert.rejects(() => savePaymentPlan(tx, "order", "PKR", { ...initial, monthly: "10", arrearsPart: "11" }));
});
