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
let share: string | null = null;
let schema = true;
let advances: { id: string; zoomHostId: string; amountMinor: number; currency: string; reason: string; occurredOn: Date; createdBy: string; createdAt: Date }[] = [];
let reads = 0;
mock.module("server-only", { namedExports: {} });
mock.module("next/navigation", { namedExports: {
  notFound: () => { throw new Error("NOT_FOUND"); },
  redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); },
} });
mock.module(file("../lib/auth/sirah-workspace.ts"), { namedExports: { getSirahWorkspaceAccess: async () => role ? { role } : null } });
mock.module(file("../lib/auth/session.ts"), { namedExports: { getSessionIdentity: async () => identity } });
mock.module(file("../lib/lms/schedule.ts"), { namedExports: { hostsForIdentity: async (who: unknown) => who ? hosts : [] } });
mock.module(file("../lib/prisma.ts"), { namedExports: { prisma: { zoomHost: {
  findMany: async ({ where, select }: { where: { revenuePartner?: boolean; id?: { in: string[] } }; select: Record<string, boolean> }) => {
    const rows = partner ? (where.id ? hosts.filter(host => where.id!.in.includes(host.id)) : [{ id: "host_1" }]) : [];
    return rows.map(host => ({ id: host.id, email: "teacher@example.test", ...(select.revenueSharePercent ? { revenueSharePercent: share } : {}) }));
  },
} } } });
mock.module(file("../services/teacher-advances.service.ts"), { namedExports: {
  teacherRevenueSchemaAvailable: async () => schema,
  teacherAdvanceHistory: async (ids: string[]) => schema ? advances.filter(entry => ids.includes(entry.zoomHostId)) : [],
} });
mock.module(file("../services/course-revenue.service.ts"), { namedExports: { courseRevenueReport: async () => {
  reads++;
  return { programs: [
    { id: "course:legacy", title: "Legacy", received: [{ currency: "GBP", amountMinor: 999900 }], refunds: [], ambiguous: [], undatedRefunds: 0 },
    { id: "course:sirah", title: "Sīrah", received: [{ currency: "GBP", amountMinor: 100000 }, { currency: "PKR", amountMinor: 5000000 }], refunds: [{ currency: "GBP", amountMinor: 20000 }], ambiguous: [], undatedRefunds: 0 },
  ] };
} } });

beforeEach(() => { role = null; identity = null; hosts = []; partner = false; share = null; schema = true; advances = []; reads = 0; });
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

test("earnings use only the current Sīrah programme, after refunds, per currency, with the 70% default", async () => {
  const { sirahTeacherEarnings } = await import("../services/teacher-earnings.service");
  const { reportPeriod } = await import("../lib/sirah/course-revenue-period");
  const result = await sirahTeacherEarnings(reportPeriod("all"), null);
  assert.equal(result.percent, 70);
  assert.deepEqual(result.rows, [
    { currency: "GBP", receivedMinor: 100000, refundedMinor: 20000, netMinor: 80000, shareMinor: 56000, advanceMinor: 0, payableMinor: 56000 },
    { currency: "PKR", receivedMinor: 5000000, refundedMinor: 0, netMinor: 5000000, shareMinor: 3500000, advanceMinor: 0, payableMinor: 3500000 },
  ]);
});

test("a host's stored share and outstanding advances give the net payable per currency", async () => {
  const { sirahTeacherEarnings, teacherEarningsAccess } = await import("../services/teacher-earnings.service");
  const { reportPeriod } = await import("../lib/sirah/course-revenue-period");
  identity = { id: "u1", email: "teacher@example.test", fullName: "Teacher" }; hosts = [{ id: "host_1" }]; partner = true; share = "60.00";
  const at = new Date("2026-11-01T00:00:00Z");
  advances = [
    { id: "a1", zoomHostId: "host_1", amountMinor: 30000, currency: "GBP", reason: "Advance", occurredOn: at, createdBy: "admin@example.test", createdAt: at },
    { id: "a2", zoomHostId: "host_1", amountMinor: -10000, currency: "GBP", reason: "Recovered", occurredOn: at, createdBy: "admin@example.test", createdAt: at },
    { id: "a3", zoomHostId: "host_1", amountMinor: 5000, currency: "USD", reason: "USD advance", occurredOn: at, createdBy: "admin@example.test", createdAt: at },
    { id: "x", zoomHostId: "someone_else", amountMinor: 99999, currency: "GBP", reason: "Other", occurredOn: at, createdBy: "admin@example.test", createdAt: at },
  ];
  const access = await teacherEarningsAccess(identity);
  assert.equal(access.allowed, true);
  assert.deepEqual(access.hosts, [{ id: "host_1", email: "teacher@example.test", percent: 60, customShare: true }]);
  const result = await sirahTeacherEarnings(reportPeriod("all"), access.hosts[0]);
  assert.equal(result.percent, 60);
  assert.deepEqual(result.rows.map(row => [row.currency, row.shareMinor, row.advanceMinor, row.payableMinor]), [
    ["GBP", 48000, 20000, 28000],
    ["PKR", 3000000, 0, 3000000],
    // An advance in a currency with no income still shows, as a negative payable.
    ["USD", 0, 5000, -5000],
  ]);
  assert.equal(result.history.length, 3);
});

test("before the migration is applied, the default share is used and no advances are read", async () => {
  const { sirahTeacherEarnings, teacherEarningsAccess } = await import("../services/teacher-earnings.service");
  const { reportPeriod } = await import("../lib/sirah/course-revenue-period");
  role = "SUPER_ADMIN"; partner = true; share = "60.00"; schema = false;
  const access = await teacherEarningsAccess(null);
  assert.deepEqual(access.hosts, [{ id: "host_1", email: "teacher@example.test", percent: 70, customShare: false }]);
  const result = await sirahTeacherEarnings(reportPeriod("all"), access.hosts[0]);
  assert.equal(result.percent, 70);
  assert.equal(result.history.length, 0);
});

test("the share calculation rounds to the minor unit, keeps currencies apart and rejects bad percentages", async () => {
  const { teacherEarnings } = await import("../lib/lms/teacher-earnings");
  assert.deepEqual(teacherEarnings([{ currency: "GBP", amountMinor: 2999 }], [], 70), [
    { currency: "GBP", receivedMinor: 2999, refundedMinor: 0, netMinor: 2999, shareMinor: 2099, advanceMinor: 0, payableMinor: 2099 },
  ]);
  // A refund-only period gives a negative share (the refund claws back).
  assert.equal(teacherEarnings([], [{ currency: "USD", amountMinor: 1000 }], 70)[0].shareMinor, -700);
  assert.deepEqual(teacherEarnings([], [], 70), []);
  assert.throws(() => teacherEarnings([], [], 101));
  assert.throws(() => teacherEarnings([], [], -1));
});

test("share input accepts 0 to 100 with up to two decimals; empty clears it", async () => {
  const { parseSharePercent, resolveSharePercent } = await import("../lib/lms/teacher-earnings");
  assert.deepEqual(parseSharePercent(""), { ok: true, value: null });
  assert.deepEqual(parseSharePercent(" 70 "), { ok: true, value: "70.00" });
  assert.deepEqual(parseSharePercent("62.5"), { ok: true, value: "62.50" });
  assert.deepEqual(parseSharePercent("100"), { ok: true, value: "100.00" });
  for (const bad of ["101", "-1", "70.555", "abc", "1e2"]) assert.equal(parseSharePercent(bad).ok, false, bad);
  assert.equal(resolveSharePercent(null), 70);
  assert.equal(resolveSharePercent("62.50"), 62.5);
});

test("outstanding advances sum the ledger per currency and drop settled currencies", async () => {
  const { outstandingAdvances } = await import("../lib/lms/teacher-earnings");
  assert.deepEqual(outstandingAdvances([
    { currency: "GBP", amountMinor: 30000 }, { currency: "GBP", amountMinor: -30000 },
    { currency: "PKR", amountMinor: 500000 }, { currency: "PKR", amountMinor: -100000 },
  ]), [{ currency: "PKR", amountMinor: 400000 }]);
});
