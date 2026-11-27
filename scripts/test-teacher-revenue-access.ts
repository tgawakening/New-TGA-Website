/**
 * Teacher earnings: who may see them, and the share calculation. Mocks only;
 * no database is touched. Run with:
 *   node --experimental-test-module-mocks --import tsx --test scripts/test-teacher-revenue-access.ts
 */
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test, { beforeEach, mock } from "node:test";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("node:module") as { _extensions: Record<string, (m: { exports: unknown }) => void> };
Module._extensions[".css"] = (m) => { m.exports = new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) }); };
const file = (p: string) => pathToFileURL(path.resolve(__dirname, p)).href;

let role: string | null = null;
let identity: { id: string; email: string; fullName: string } | null = null;
let hosts: { id: string }[] = [];
let partner = false;
let reads = 0;
mock.module("server-only", { namedExports: {} });
mock.module("next/navigation", { namedExports: {
  notFound: () => { throw new Error("NOT_FOUND"); },
  redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); },
} });
mock.module(file("../lib/auth/sirah-workspace.ts"), { namedExports: { getSirahWorkspaceAccess: async () => role ? { role } : null } });
mock.module(file("../lib/auth/session.ts"), { namedExports: { getSessionIdentity: async () => identity } });
mock.module(file("../lib/lms/schedule.ts"), { namedExports: { hostsForIdentity: async (who: unknown) => who ? hosts : [] } });
mock.module(file("../lib/prisma.ts"), { namedExports: { prisma: { zoomHost: { findFirst: async () => partner && hosts.length ? { id: hosts[0].id } : null } } } });
mock.module(file("../services/course-revenue.service.ts"), { namedExports: { courseRevenueReport: async () => {
  reads++;
  return { programs: [
    { id: "course:legacy", title: "Legacy", received: [{ currency: "GBP", amountMinor: 999900 }], refunds: [], ambiguous: [], undatedRefunds: 0 },
    { id: "course:sirah", title: "Sīrah", received: [{ currency: "GBP", amountMinor: 100000 }, { currency: "PKR", amountMinor: 5000000 }], refunds: [{ currency: "GBP", amountMinor: 20000 }], ambiguous: [], undatedRefunds: 0 },
  ] };
} } });

beforeEach(() => { role = null; identity = null; hosts = []; partner = false; reads = 0; });
const page = async () => (await import("../app/seerah/classroom/teaching/revenue/page")).default({ searchParams: Promise.resolve({}) });

test("signed-out visitors are sent to sign in and nothing is read", async () => {
  await assert.rejects(page(), /REDIRECT:\/login/);
  assert.equal(reads, 0);
});

test("managers, community leads, students and non-partner hosts cannot read earnings", async () => {
  identity = { id: "u1", email: "teacher@example.test", fullName: "Teacher" };
  for (const forbidden of [null, "MANAGER", "COMMUNITY_LEAD"]) {
    role = forbidden;
    await assert.rejects(page(), /NOT_FOUND/);
  }
  role = null; hosts = [{ id: "host_1" }]; partner = false;
  await assert.rejects(page(), /NOT_FOUND/);
  assert.equal(reads, 0);
});

test("the Super Admin and a designated revenue-partner host can read earnings", async () => {
  role = "SUPER_ADMIN";
  await page(); assert.equal(reads, 1);
  role = null; identity = { id: "u1", email: "teacher@example.test", fullName: "Teacher" }; hosts = [{ id: "host_1" }]; partner = true;
  await page(); assert.equal(reads, 2);
});

test("earnings use only the current Sīrah programme, after refunds, per currency", async () => {
  role = "SUPER_ADMIN";
  const { sirahTeacherEarnings } = await import("../services/teacher-earnings.service");
  const { reportPeriod } = await import("../lib/sirah/course-revenue-period");
  const result = await sirahTeacherEarnings(reportPeriod("all"));
  assert.equal(result.percent, 70);
  assert.deepEqual(result.rows, [
    { currency: "GBP", receivedMinor: 100000, refundedMinor: 20000, netMinor: 80000, shareMinor: 56000 },
    { currency: "PKR", receivedMinor: 5000000, refundedMinor: 0, netMinor: 5000000, shareMinor: 3500000 },
  ]);
});

test("the share calculation rounds to the minor unit, keeps currencies apart and rejects bad percentages", async () => {
  const { teacherEarnings } = await import("../lib/lms/teacher-earnings");
  assert.deepEqual(teacherEarnings([{ currency: "GBP", amountMinor: 2999 }], [], 70), [
    { currency: "GBP", receivedMinor: 2999, refundedMinor: 0, netMinor: 2999, shareMinor: 2099 },
  ]);
  // A refund-only period gives a negative share (the refund claws back).
  assert.equal(teacherEarnings([], [{ currency: "USD", amountMinor: 1000 }], 70)[0].shareMinor, -700);
  assert.deepEqual(teacherEarnings([], [], 70), []);
  assert.throws(() => teacherEarnings([], [], 101));
  assert.throws(() => teacherEarnings([], [], -1));
});
