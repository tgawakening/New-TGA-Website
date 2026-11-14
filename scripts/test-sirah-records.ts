/**
 * Super-admin test-record housekeeping: exclude / un-exclude from analytics and
 * permanent deletion of payment-free junk rows. Exercised through the real
 * route handlers and services against an in-memory Prisma stand-in (no
 * database, no network).
 */
import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";
import { randomUUID } from "node:crypto";
import { installFakePrisma, table, tables, defaults, type Row } from "./fixtures/fake-prisma";

const base = "https://tga.example";
const SUPER_TOKEN = "isolated-super-admin-token";
for (const key of Object.keys(process.env))
  if (key.startsWith("SIRAH_") || key.startsWith("ADMIN_") || key === "RESEND_API_KEY")
    delete process.env[key];
Object.assign(process.env, {
  NEXT_PUBLIC_APP_URL: base,
  ADMIN_DASHBOARD_EMAIL: "owner@tga.example",
  ADMIN_DASHBOARD_PASSWORD: "owner-test-password",
  ADMIN_DASHBOARD_SECRET: "isolated-admin-test-secret",
  ADMIN_API_TOKEN: SUPER_TOKEN,
});
installFakePrisma();

type Handler = (request: Request) => Promise<Response>;
let recordsPost: Handler;
let enrolmentsGet: Handler;
let createSession: typeof import("../lib/auth/session").createSession;
let listSirahAdmin: typeof import("../services/sirah-admin.service").listSirahAdmin;
let sirahCsv: typeof import("../services/sirah-admin.service").sirahCsv;
let sirahOverviewCounts: typeof import("../services/sirah-group.service").sirahOverviewCounts;
let SIRAH_SLUG = "";

before(async () => {
  ({ POST: recordsPost } = await import("../app/api/admin/sirah/records/route"));
  ({ GET: enrolmentsGet } = await import("../app/api/admin/sirah/route"));
  ({ createSession } = await import("../lib/auth/session"));
  ({ listSirahAdmin, sirahCsv } = await import("../services/sirah-admin.service"));
  ({ sirahOverviewCounts } = await import("../services/sirah-group.service"));
  ({ SIRAH_SLUG } = await import("../lib/sirah/catalog"));
});

let courseId = "";
beforeEach(() => {
  tables.clear();
  courseId = randomUUID();
  table("course").push({ id: courseId, slug: SIRAH_SLUG });
});

function user(role = "STUDENT") {
  const row: Row = { id: randomUUID(), email: `${role.toLowerCase()}-${randomUUID()}@example.test`, fullName: `${role} person`, role, status: "ACTIVE", passwordHash: "x", phoneCountryCode: "", phoneNumber: "", createdAt: new Date(), updatedAt: new Date() };
  table("user").push(row);
  return row as Row & { id: string; email: string };
}
/** A payment-free test registration unless overridden. */
function order(overrides: Row = {}) {
  const owner = user();
  const row: Row = {
    ...defaults.sirahOrder,
    excludedAt: null, excludedBy: null,
    id: randomUUID(), userId: owner.id, courseId, batchCode: "beyond-chronology-2026",
    reference: `SIRAH-${randomUUID().toUpperCase()}`, phoneE164: "", countryCode: "GB", countryName: "United Kingdom",
    marketCode: "GB", plan: "MONTHLY", method: null, currency: "GBP", amountMinor: 2999, totalMinor: 35988,
    pricingVersion: "v", paymentState: "UNPAID", enrolmentState: "PENDING", revision: 2,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  table("sirahOrder").push(row);
  return row as Row & { id: string; reference: string; userId: string };
}
const paidOrder = (overrides: Row = {}) => {
  const o = order({ method: "STRIPE", paymentState: "PAID", enrolmentState: "ACTIVE", paidCount: 1, paidMinor: 2999, registrationId: randomUUID(), ...overrides });
  table("sirahPaymentEvent").push({ id: `stripe:invoice:in_${o.id}`, orderId: o.id, provider: "STRIPE", amountMinor: 2999, currency: "GBP", kind: "FIRST", createdAt: new Date() });
  return o;
};
type As = { session?: string; superAdmin?: boolean; origin?: string };
function req(path: string, as: As, body?: unknown) {
  const headers: Record<string, string> = { origin: as.origin ?? base, "content-type": "application/json" };
  if (as.session) headers.cookie = `ga_session=${as.session}`;
  if (as.superAdmin) headers["x-admin-token"] = SUPER_TOKEN;
  return new Request(base + path, { method: body === undefined ? "GET" : "POST", headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const act = (as: As, body: unknown) => recordsPost(req("/api/admin/sirah/records", as, body));
const row = (id: string) => table("sirahOrder").find((r) => r.id === id);
const listIds = async (params = "") => (await listSirahAdmin(new URLSearchParams(params))).rows.map((r) => r.id);

test("excluded records leave the Students and Payments lists, the CSV and Overview, but the data is kept", async () => {
  const real = paidOrder();
  const junk = order();
  const stuck = order({ method: "STRIPE", paymentState: "PROCESSING", checkoutToken: "t", providerOrderId: "cs_test_x" });
  const before = await sirahOverviewCounts();
  assert.equal(before.total, 3);

  const response = await act({ superAdmin: true }, { action: "EXCLUDE", orderIds: [junk.id, stuck.id] });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.done, 2);

  assert.deepEqual(await listIds(), [real.id]);
  assert.deepEqual(await listIds("payment=NEEDS_ATTENTION"), []);
  const csv = sirahCsv(await listSirahAdmin(new URLSearchParams()));
  assert.ok(csv.includes(real.reference));
  assert.ok(!csv.includes(junk.reference) && !csv.includes(stuck.reference));
  const after = await sirahOverviewCounts();
  assert.equal(after.total, 1);
  assert.equal(after.needsReview, 0);
  assert.equal(after.excluded, 2);

  // Kept, unchanged apart from the flag, and audited.
  const kept = row(stuck.id)!;
  assert.ok(kept.excludedAt instanceof Date);
  assert.match(String(kept.excludedBy), /^admin/);
  assert.equal(kept.paymentState, "PROCESSING");
  assert.equal(kept.providerOrderId, "cs_test_x");
  assert.equal(kept.revision, 2);
  assert.ok(table("sirahAudit").some((a) => a.orderId === junk.id && a.action === "EXCLUDED_FROM_ANALYTICS"));
});

test("the super admin's excluded view lists them, and un-exclude puts them back", async () => {
  const junk = order();
  order();
  await act({ superAdmin: true }, { action: "EXCLUDE", orderIds: [junk.id] });
  const view = await enrolmentsGet(req("/api/admin/sirah?excluded=only", { superAdmin: true }));
  const data = await view.json();
  assert.equal(data.excludedView, true);
  assert.deepEqual(data.rows.map((r: Row) => r.id), [junk.id]);

  const restored = await act({ superAdmin: true }, { action: "INCLUDE", orderIds: [junk.id] });
  assert.equal((await restored.json()).done, 1);
  assert.equal(row(junk.id)!.excludedAt, null);
  assert.equal((await listIds()).length, 2);
  assert.ok(table("sirahAudit").some((a) => a.orderId === junk.id && a.action === "INCLUDED_IN_ANALYTICS"));
});

test("only the super admin can exclude, un-exclude, delete or see the excluded view", async () => {
  const junk = order();
  const manager = user("SIRAH_REVIEWER");
  const lead = user("SIRAH_VIEWER");
  const managerSession = await createSession(manager.id, 12);
  const leadSession = await createSession(lead.id, 12);
  for (const as of [{ session: managerSession }, { session: leadSession }, {}] as As[])
    for (const action of ["EXCLUDE", "DELETE"]) {
      const response = await act(as, { action, orderIds: [junk.id], confirmation: "DELETE" });
      assert.equal(response.status, 403, `${action} as ${JSON.stringify(as)}`);
    }
  // Cross-site requests are refused even with super-admin credentials.
  assert.equal((await act({ superAdmin: true, origin: "https://evil.example" }, { action: "EXCLUDE", orderIds: [junk.id] })).status, 403);
  assert.ok(row(junk.id));
  assert.equal(row(junk.id)!.excludedAt, null);

  // A manager asking for the excluded view just gets the normal list.
  await act({ superAdmin: true }, { action: "EXCLUDE", orderIds: [junk.id] });
  const managerView = await (await enrolmentsGet(req("/api/admin/sirah?excluded=only", { session: managerSession }))).json();
  assert.equal(managerView.excludedView, false);
  assert.deepEqual(managerView.rows, []);
});

test("delete permanently removes a payment-free junk row, keeps the account, and logs it", async () => {
  const junk = order({ paymentState: "REJECTED", method: "JAZZCASH" });
  table("sirahAudit").push({ id: randomUUID(), orderId: junk.id, actor: "student", action: "REGISTERED", detail: {}, createdAt: new Date() });
  table("sirahNotification").push({ id: randomUUID(), orderId: junk.id, kind: "REGISTERED", state: "SENT", toEmail: "x@example.test" });
  table("sirahResumeLink").push({ id: randomUUID(), orderId: junk.id });
  const keep = order();

  const response = await act({ superAdmin: true }, { action: "DELETE", orderIds: [junk.id], confirmation: "DELETE" });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).done, 1);
  assert.equal(row(junk.id), undefined);
  assert.equal(table("sirahAudit").filter((a) => a.orderId === junk.id).length, 0);
  assert.equal(table("sirahNotification").filter((n) => n.orderId === junk.id).length, 0);
  assert.equal(table("sirahResumeLink").filter((n) => n.orderId === junk.id).length, 0);
  assert.ok(table("user").some((u) => u.id === junk.userId), "student account kept");
  assert.ok(row(keep.id), "other records untouched");
  const log = table("sirahRecordDeletion");
  assert.equal(log.length, 1);
  assert.equal(log[0].reference, junk.reference);
  assert.match(String(log[0].actor), /^admin/);
  assert.equal((log[0].snapshot as Row).paymentState, "REJECTED");
});

test("delete needs the typed DELETE confirmation", async () => {
  const junk = order();
  for (const confirmation of [undefined, "delete", "yes"]) {
    const response = await act({ superAdmin: true }, { action: "DELETE", orderIds: [junk.id], ...(confirmation ? { confirmation } : {}) });
    assert.equal(response.status, 400);
  }
  assert.ok(row(junk.id));
  assert.equal(table("sirahRecordDeletion").length, 0);
});

test("a record with a real payment, enrolment, open checkout or receipt can never be hard-deleted", async () => {
  const protectedOrders = {
    paid: paidOrder(),
    refunded: paidOrder({ paymentState: "REFUNDED", enrolmentState: "CANCELLED", refundedMinor: 2999 }),
    eventOnly: (() => {
      const o = order({ paymentState: "UNPAID" });
      table("sirahPaymentEvent").push({ id: `manual:JAZZCASH:${o.id}`, orderId: o.id, provider: "JAZZCASH", amountMinor: 300000, currency: "PKR", kind: "FIRST" });
      return o;
    })(),
    enrolmentRecord: order({ registrationId: randomUUID() }),
    active: order({ enrolmentState: "ACTIVE" }),
    completed: order({ enrolmentState: "COMPLETED" }),
    openCheckout: order({ method: "STRIPE", paymentState: "PROCESSING", providerOrderId: "cs_test_open" }),
    awaitingReview: order({ method: "JAZZCASH", paymentState: "AWAITING_REVIEW" }),
    failedWithSubscription: order({ method: "STRIPE", paymentState: "FAILED", providerSubscriptionId: "sub_x" }),
    rejectedWithReceipt: (() => {
      const o = order({ method: "JAZZCASH", paymentState: "REJECTED" });
      table("sirahReceipt").push({ id: randomUUID(), orderId: o.id, revision: 1, filename: "r.pdf" });
      return o;
    })(),
  };
  const junk = order();
  const ids = [...Object.values(protectedOrders).map((o) => o.id), junk.id];
  const response = await act({ superAdmin: true }, { action: "DELETE", orderIds: ids, confirmation: "DELETE" });
  const result = await response.json();
  assert.equal(result.done, 1, "only the payment-free junk row is deleted");
  assert.equal(result.refused, Object.keys(protectedOrders).length);
  for (const [name, o] of Object.entries(protectedOrders)) {
    assert.ok(row(o.id), `${name} must still exist`);
    const entry = result.results.find((r: Row) => r.id === o.id);
    assert.equal(entry.ok, false, name);
    assert.match(entry.reason, /Exclude it instead\./, name);
  }
  assert.equal(row(junk.id), undefined);

  // The same protected records can still be excluded.
  const excluded = await (await act({ superAdmin: true }, { action: "EXCLUDE", orderIds: Object.values(protectedOrders).map((o) => o.id) })).json();
  assert.equal(excluded.done, Object.keys(protectedOrders).length);
});

test("list rows tell the super admin which records can be deleted", async () => {
  const junk = order();
  const real = paidOrder();
  const rows = (await listSirahAdmin(new URLSearchParams())).rows;
  assert.equal(rows.find((r) => r.id === junk.id)!.deleteRefusal, null);
  assert.equal(rows.find((r) => r.id === real.id)!.deleteRefusal, "It has a recorded payment.");
  // Provider references are used for the check but not sent to the browser.
  assert.equal("providerOrderId" in rows[0], false);
});
