/**
 * In-memory stand-in for the shared Prisma client, for service and route tests
 * that must not touch any database. Call installFakePrisma() before importing
 * anything that loads lib/prisma (it reuses globalThis.prisma).
 *
 * Supports the subset of the Prisma API the Sīrah services use: equality,
 * in/not/lt/lte/gt/gte/contains filters, relation filters (course/user/order),
 * compound unique keys, include/select of relations, increment, DbNull,
 * upsert and interactive $transaction. `select` returns whole rows.
 */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

export type Row = Record<string, unknown>;
export const tables = new Map<string, Row[]>();
export const table = (name: string) => {
  if (!tables.has(name)) tables.set(name, []);
  return tables.get(name)!;
};
const relationTable: Record<string, string> = {
  course: "course",
  user: "user",
  order: "sirahOrder",
  registration: "registration",
};
const OPS = ["in", "not", "lt", "lte", "gt", "gte", "contains", "equals"];
function matchValue(actual: unknown, expected: unknown): boolean {
  if (expected === null) return actual === null || actual === undefined;
  if (expected instanceof Date) return actual instanceof Date && actual.getTime() === expected.getTime();
  if (typeof expected === "object" && Object.keys(expected as object).some((k) => OPS.includes(k))) {
    const e = expected as Record<string, unknown>;
    if ("equals" in e && !matchValue(actual, e.equals)) return false;
    if ("in" in e && !(e.in as unknown[]).includes(actual)) return false;
    if ("not" in e && matchValue(actual, e.not)) return false;
    if ("contains" in e && !String(actual ?? "").includes(String(e.contains))) return false;
    const n = (v: unknown) => (v instanceof Date ? v.getTime() : (v as number));
    if ("lt" in e && !(n(actual) < n(e.lt))) return false;
    if ("lte" in e && !(n(actual) <= n(e.lte))) return false;
    if ("gt" in e && !(n(actual) > n(e.gt))) return false;
    if ("gte" in e && !(n(actual) >= n(e.gte))) return false;
    return true;
  }
  return actual === expected;
}
export function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected === undefined) return true;
    if (key === "OR") return (expected as Row[]).some((w) => matches(row, w));
    if (key === "AND") return (expected as Row[]).every((w) => matches(row, w));
    if (key === "NOT") return !matches(row, expected as Row);
    if (relationTable[key] && !(key in row) && `${key}Id` in row) {
      const related = table(relationTable[key]).find((r) => r.id === row[`${key}Id`]);
      return !!related && matches(related, expected as Row);
    }
    if (!(key in row) && expected && typeof expected === "object" && !(expected instanceof Date))
      return matches(row, expected as Row); // compound unique, e.g. userId_courseId_batchCode
    return matchValue(row[key], expected);
  });
}
function applyData(row: Row, data: Row) {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value === Prisma.DbNull || value === Prisma.JsonNull) row[key] = null;
    else if (value && typeof value === "object" && "increment" in (value as Row))
      row[key] = ((row[key] as number) || 0) + ((value as Row).increment as number);
    else if (value && typeof value === "object" && "create" in (value as Row)) continue;
    else row[key] = value;
  }
  row.updatedAt = new Date();
}
export const defaults: Record<string, Row> = {
  sirahOrder: { paymentState: "UNPAID", enrolmentState: "PENDING", revision: 0, paidMinor: 0, paidCount: 0, refundedMinor: 0, invitationState: "PENDING", method: null, discount: null, terms: null, providerOrderId: null, providerSubscriptionId: null, providerPlanId: null, providerCustomerId: null, checkoutToken: null, cancelledAt: null, accessEndsAt: null, programmeStart: null, programmeEnd: null, nextBillingAt: null, registrationId: null, groupAddedAt: null, groupAddedBy: null },
  user: { status: "ACTIVE", role: "STUDENT" },
};
function attach(row: Row, shape?: Row) {
  if (!shape) return { ...row };
  const out: Row = { ...row };
  for (const [key, spec] of Object.entries(shape)) {
    if (!spec) continue;
    if (relationTable[key] && `${key}Id` in row) {
      const related = table(relationTable[key]).find((r) => r.id === row[`${key}Id`]);
      out[key] = related ? { ...related } : null;
    } else if (!(key in row)) {
      const child = key === "audits" ? "sirahAudit" : key === "events" ? "sirahPaymentEvent" : key === "notifications" ? "sirahNotification" : key === "receipts" ? "sirahReceipt" : "";
      out[key] = child ? table(child).filter((r) => r.orderId === row.id).map((r) => ({ ...r })) : [];
    }
  }
  return out;
}
function delegate(name: string) {
  const rows = () => table(name);
  const first = (args: Row = {}) => rows().find((r) => matches(r, args.where as Row));
  const api = {
    findUnique: async (args: Row) => { const r = first(args); return r ? attach(r, (args.include || args.select) as Row) : null; },
    findFirst: async (args: Row = {}) => { const r = first(args); return r ? attach(r, (args.include || args.select) as Row) : null; },
    findUniqueOrThrow: async (args: Row) => { const r = first(args); if (!r) throw new Error(`${name} not found`); return attach(r, (args.include || args.select) as Row); },
    findFirstOrThrow: async (args: Row) => api.findUniqueOrThrow(args),
    findMany: async (args: Row = {}) => rows().filter((r) => matches(r, args.where as Row)).map((r) => attach(r, (args.include || args.select) as Row)),
    count: async (args: Row = {}) => rows().filter((r) => matches(r, args.where as Row)).length,
    create: async (args: Row) => {
      const row: Row = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...(defaults[name] || {}) };
      applyData(row, args.data as Row);
      const nestedProfile = (args.data as Row).studentProfile as Row | undefined;
      if (nestedProfile?.create) table("studentProfile").push({ id: randomUUID(), userId: row.id, ...(nestedProfile.create as Row) });
      rows().push(row);
      return { ...row };
    },
    createMany: async (args: Row) => { for (const data of args.data as Row[]) await api.create({ data }); return { count: (args.data as Row[]).length }; },
    update: async (args: Row) => { const r = first(args); if (!r) throw new Error(`${name} not found for update`); applyData(r, args.data as Row); return { ...r }; },
    updateMany: async (args: Row) => { const hit = rows().filter((r) => matches(r, args.where as Row)); hit.forEach((r) => applyData(r, args.data as Row)); return { count: hit.length }; },
    upsert: async (args: Row) => { const r = first(args); if (r) { applyData(r, args.update as Row); return { ...r }; } return api.create({ data: args.create }); },
    delete: async (args: Row) => { const r = first(args); tables.set(name, rows().filter((x) => x !== r)); return r; },
    deleteMany: async (args: Row = {}) => { const keep = rows().filter((r) => !matches(r, args.where as Row)); const count = rows().length - keep.length; tables.set(name, keep); return { count }; },
  };
  return api;
}
export function installFakePrisma() {
  process.env.DATABASE_URL = "mysql://fake-in-memory.invalid:1/never";
  const fakePrisma: Row = new Proxy({} as Row, {
    get(target, prop: string) {
      if (prop === "$transaction")
        return async (work: unknown) => (typeof work === "function" ? (work as (tx: unknown) => unknown)(fakePrisma) : Promise.all(work as Promise<unknown>[]));
      if (prop === "$queryRaw" || prop === "$queryRawUnsafe" || prop === "$executeRaw") return async () => [];
      if (prop === "$disconnect" || prop === "$connect") return async () => {};
      if (prop === "then") return undefined;
      if (!(prop in target)) target[prop] = delegate(prop);
      return target[prop];
    },
  });
  (globalThis as unknown as { prisma: unknown }).prisma = fakePrisma;
  return fakePrisma;
}
