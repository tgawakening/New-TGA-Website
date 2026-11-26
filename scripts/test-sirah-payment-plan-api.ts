import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const file = (relative: string) => pathToFileURL(path.resolve(__dirname, relative)).href;
class TestError extends Error { constructor(message: string, public status = 400) { super(message); } }
let allowed = true, planEnabled = true;
const payments: Record<string, unknown>[] = [];
const plan = { periods: [{ id: "period-a", periodMonth: "2026-11", amountMinor: 5000, paidMinor: 2000 }] };
const tx = {
  sirahOrder: { findUnique: async () => ({ id: "order-a", currency: "PKR" }), findUniqueOrThrow: async () => ({ currency: "PKR" }) },
  sirahLedgerPayment: { create: async ({ data }: { data: Record<string, unknown> }) => { payments.push(data); } },
};
mock.module("server-only", { namedExports: {} });
mock.module(file("../lib/prisma.ts"), { namedExports: { prisma: tx } });
mock.module(file("../lib/sirah/http.ts"), { namedExports: {
  checkSirahOrigin: () => {}, sirahExclusionActor: async () => { if (!allowed) throw new TestError("Forbidden", 403); return "reviewer:test"; },
  privateJson: (body: unknown) => Response.json(body), sirahReadAccess: async () => ({ role: "MANAGER" }),
  sirahResponseError: (error: unknown) => Response.json({ error: (error as Error).message }, { status: error instanceof TestError ? error.status : 500 }),
} });
mock.module(file("../services/sirah-confirmation.service.ts"), { namedExports: { serializable: async (work: (tx: unknown) => unknown) => work(tx) } });
mock.module(file("../services/sirah-settlement.service.ts"), { namedExports: { lockLedgerOrder: async () => {}, assertLedgerUnlocked: async () => {} } });
mock.module(file("../services/sirah-registration.service.ts"), { namedExports: { SirahError: TestError, auditSirah: async () => {} } });
mock.module(file("../services/sirah-payment-plan.service.ts"), { namedExports: { freezePeriods: async () => planEnabled ? plan : null, planSnapshot: async () => null, savePaymentPlan: async () => {} } });
let post: typeof import("../app/api/admin/sirah/ledger/route").POST;
before(async () => { ({ POST: post } = await import("../app/api/admin/sirah/ledger/route")); });
function payment(amount: string, periodMonth = "2026-11") {
  return new Request("https://example.test/api/admin/sirah/ledger", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "order-a", action: "payment", amount, method: "BANK", date: "2026-11-01", periodMonth }) });
}
test("period payment is linked and an overpayment or unknown period is rejected", async () => {
  payments.length = 0; planEnabled = true; allowed = true;
  assert.equal((await post(payment("30"))).status, 200);
  assert.equal(payments[0].periodId, "period-a");
  assert.equal((await post(payment("30.01"))).status, 409);
  assert.equal((await post(payment("1", "2026-10"))).status, 400);
  assert.equal(payments.length, 1);
});
test("one-off payments remain unlinked and unauthorized callers cannot record payments", async () => {
  payments.length = 0; planEnabled = false;
  assert.equal((await post(payment("60"))).status, 200);
  assert.equal(payments[0].periodId, null);
  allowed = false;
  assert.equal((await post(payment("1"))).status, 403);
  assert.equal(payments.length, 1);
});
