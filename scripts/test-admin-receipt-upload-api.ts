/**
 * Staff receipt upload endpoint: server-side role enforcement. Mocks only.
 *   node --experimental-test-module-mocks --import tsx --test scripts/test-admin-receipt-upload-api.ts
 */
import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
const file = (relative: string) => pathToFileURL(path.resolve(__dirname, relative)).href;
// Mirrors the real helpers: taskAdminRole admits SUPER_ADMIN or MANAGER only, and
// sirahExclusionActor refuses every other workspace role.
let role: "SUPER_ADMIN" | "MANAGER" | "COMMUNITY_LEAD" | null = null;
let attached: unknown[] = [];
class TestError extends Error { constructor(message: string, public status = 400) { super(message); } }
mock.module("server-only", { namedExports: {} });
mock.module(file("../lib/lms/task-admin-access.ts"), { namedExports: { taskAdminRole: async () => role === "SUPER_ADMIN" || role === "MANAGER" ? role : null } });
mock.module(file("../lib/sirah/http.ts"), { namedExports: {
  checkSirahOrigin: () => {}, privateJson: (value: unknown) => Response.json(value),
  sirahExclusionActor: async () => {
    if (role === "SUPER_ADMIN") return "admin:owner@example.test";
    if (role === "MANAGER") return "reviewer:manager@example.test";
    throw new TestError("Only the super admin or a manager can exclude test records.", 403);
  },
  sirahResponseError: (error: TestError) => Response.json({ error: error.message }, { status: error.status || 500 }),
} });
mock.module(file("../services/sirah-registration.service.ts"), { namedExports: { SirahError: TestError } });
mock.module(file("../services/sirah-receipts.service.ts"), { namedExports: {
  attachAdminSirahReceipt: async (...args: unknown[]) => { attached.push(args); return { id: "receipt-new", revision: 2 }; },
} });
let route: typeof import("../app/api/admin/sirah/receipts/route");
before(async () => { route = await import("../app/api/admin/sirah/receipts/route"); });
beforeEach(() => { attached = []; });
const req = (body: unknown = { id: "order-a", uploadToken: "token", note: "Received on WhatsApp" }) =>
  new Request("https://example.test/api/admin/sirah/receipts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("anonymous and community-lead users cannot attach a receipt", async () => {
  for (const value of [null, "COMMUNITY_LEAD"] as const) {
    role = value;
    assert.equal((await route.POST(req())).status, 403);
  }
  assert.equal(attached.length, 0);
});
test("super admin and manager may attach, recorded under their own identity", async () => {
  role = "SUPER_ADMIN";
  assert.equal((await route.POST(req())).status, 200);
  role = "MANAGER";
  assert.equal((await route.POST(req())).status, 200);
  assert.deepEqual(attached.map((args) => (args as unknown[])[2]), ["admin:owner@example.test", "reviewer:manager@example.test"]);
  assert.deepEqual((attached[0] as unknown[]).slice(0, 2), ["order-a", "token"]);
});
test("a missing upload or an over-long note is refused before anything is stored", async () => {
  role = "SUPER_ADMIN";
  assert.equal((await route.POST(req({ id: "order-a" }))).status, 400);
  assert.equal((await route.POST(req({ id: "order-a", uploadToken: "token", note: "x".repeat(501) }))).status, 400);
  assert.equal(attached.length, 0);
});
