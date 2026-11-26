import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const file = (relative: string) => pathToFileURL(path.resolve(__dirname, relative)).href;
const calls: { model: string; args: unknown }[] = [];
const read = (model: string) => ({ findMany: async (args: unknown) => { calls.push({ model, args }); return []; } });
mock.module("server-only", { namedExports: {} });
mock.module(file("../lib/prisma.ts"), { namedExports: { prisma: { course: read("course"), registration: read("registration"), sirahOrder: read("sirahOrder") } } });
let report: typeof import("../services/course-revenue.service").courseRevenueReport;
before(async () => { ({ courseRevenueReport: report } = await import("../services/course-revenue.service")); });
test("report issues only read queries and excludes linked, archived and test records", async () => {
  await report();
  assert.deepEqual(calls.map(call => call.model).sort(), ["course", "registration", "sirahOrder"]);
  assert.deepEqual((calls.find(call => call.model === "registration")?.args as { where: unknown }).where, { sirahOrder: null });
  assert.deepEqual((calls.find(call => call.model === "sirahOrder")?.args as { where: unknown }).where, { excludedAt: null, archivedAt: null });
});
