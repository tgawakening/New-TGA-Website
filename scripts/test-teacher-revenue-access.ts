import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test, { mock } from "node:test";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("node:module") as { _extensions: Record<string, (m: { exports: unknown }) => void> };
Module._extensions[".css"] = (m) => { m.exports = new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) }); };
const file = (p: string) => pathToFileURL(path.resolve(__dirname, p)).href;
let role: string | null = null;
let partner = false;
let hasIdentity = false;
let reads = 0;
mock.module("server-only", { namedExports: {} });
mock.module("next/navigation", { namedExports: { notFound: () => { throw new Error("NOT_FOUND"); } } });
mock.module(file("../lib/auth/session.ts"), { namedExports: { getSessionIdentity: async () => hasIdentity ? { id: "u", email: "teacher@example.test" } : null } });
mock.module(file("../lib/auth/sirah-workspace.ts"), { namedExports: { getSirahWorkspaceAccess: async () => role ? { role } : null } });
mock.module(file("../lib/lms/schedule.ts"), { namedExports: { hostsForIdentity: async (identity: unknown) => identity ? [{ id: "host" }] : [] } });
mock.module(file("../lib/prisma.ts"), { namedExports: { prisma: { zoomHost: { findFirst: async () => partner ? { id: "host" } : null }, sirahOrder: { findMany: async () => { reads++; return []; } } } } });
mock.module(file("../services/sirah-payment-totals.service.ts"), { namedExports: { sirahPaymentTotals: async () => { reads++; return { currencies: [], truncated: false }; } } });

test("revenue is read only after partner or administrator authorisation", async () => {
  const { default: page } = await import("../app/seerah/classroom/teaching/revenue/page");
  for (const scenario of [{ role: null, identity: false }, { role: null, identity: true }, { role: "COMMUNITY_LEAD", identity: true }]) {
    role = scenario.role; hasIdentity = scenario.identity; partner = false; reads = 0;
    await assert.rejects(page(), /NOT_FOUND/);
    assert.equal(reads, 0);
  }
  role = null; hasIdentity = true; partner = true; reads = 0;
  await page(); assert.equal(reads, 2);
  role = "SUPER_ADMIN"; hasIdentity = false; partner = false; reads = 0;
  await page(); assert.equal(reads, 2);
});
