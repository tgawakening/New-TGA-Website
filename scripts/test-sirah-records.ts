/**
 * Super-admin test-record housekeeping, one record at a time: exclude /
 * un-exclude from analytics, archive ("delete", a soft delete) and restore of
 * payment-free junk rows, and the 7-day maintenance purge (the only hard delete). Exercised through the real
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
let bulkExclusionPost: Handler;
let bulkArchivePost: Handler;
let enrolmentsGet: Handler;
let createSession: typeof import("../lib/auth/session").createSession;
let listSirahAdmin: typeof import("../services/sirah-admin.service").listSirahAdmin;
let sirahCsv: typeof import("../services/sirah-admin.service").sirahCsv;
let sirahOverviewCounts: typeof import("../services/sirah-group.service").sirahOverviewCounts;
let ownedSirahOrder: typeof import("../services/sirah-registration.service").ownedSirahOrder;
let purgeExpiredArchivedSirahOrders: typeof import("../services/sirah-records.service").purgeExpiredArchivedSirahOrders;
let SIRAH_SLUG = "";

before(async () => {
  ({ POST: recordsPost } = await import("../app/api/admin/sirah/records/route"));
  ({ POST: bulkExclusionPost } = await import("../app/api/admin/sirah/records/exclusion/route"));
  ({ POST: bulkArchivePost } = await import("../app/api/admin/sirah/records/archive/route"));
  ({ GET: enrolmentsGet } = await import("../app/api/admin/sirah/route"));
  ({ createSession } = await import("../lib/auth/session"));
  ({ listSirahAdmin, sirahCsv } = await import("../services/sirah-admin.service"));
  ({ sirahOverviewCounts } = await import("../services/sirah-group.service"));
  ({ ownedSirahOrder } = await import("../services/sirah-registration.service"));
  ({ purgeExpiredArchivedSirahOrders } = await import("../services/sirah-records.service"));
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
    excludedAt: null, excludedBy: null, archivedAt: null,
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

test("records with a ledger payment or monthly plan cannot be archived", async () => {
  const withPayment = order();
  table("sirahLedgerPayment").push({ id: randomUUID(), orderId: withPayment.id, amountMinor: 100, currency: "GBP" });
  const withPlan = order();
  table("sirahPaymentPlan").push({ id: randomUUID(), orderId: withPlan.id });
  for (const row of [withPayment, withPlan]) {
    const response = await act({ superAdmin: true }, { action: "ARCHIVE", orderId: row.id });
    assert.equal(response.status, 409);
    assert.equal(row.archivedAt, null);
  }
});
const bulk = (as: As, body: unknown) => bulkExclusionPost(req("/api/admin/sirah/records/exclusion", as, body));
const row = (id: string) => table("sirahOrder").find((r) => r.id === id);
const listIds = async (params = "") => (await listSirahAdmin(new URLSearchParams(params))).rows.map((r) => r.id);

const DAY = 24 * 60 * 60 * 1000;

test("excluded records leave the Students and Payments lists, the CSV and Overview, but the data is kept", async () => {
  const real = paidOrder();
  const junk = order();
  const stuck = order({ method: "STRIPE", paymentState: "PROCESSING", checkoutToken: "t", providerOrderId: "cs_test_x" });
  const before = await sirahOverviewCounts();
  assert.equal(before.total, 3);

  for (const id of [junk.id, stuck.id]) {
    const response = await act({ superAdmin: true }, { action: "EXCLUDE", orderId: id });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
  }

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
  assert.equal(kept.archivedAt, null);
  assert.ok(table("sirahAudit").some((a) => a.orderId === junk.id && a.action === "EXCLUDED_FROM_ANALYTICS"));
});

test("the super admin's excluded view lists them, and un-exclude puts them back", async () => {
  const junk = order();
  order();
  await act({ superAdmin: true }, { action: "EXCLUDE", orderId: junk.id });
  const view = await enrolmentsGet(req("/api/admin/sirah?excluded=only", { superAdmin: true }));
  const data = await view.json();
  assert.equal(data.excludedView, true);
  assert.deepEqual(data.rows.map((r: Row) => r.id), [junk.id]);

  const restored = await act({ superAdmin: true }, { action: "INCLUDE", orderId: junk.id });
  assert.equal((await restored.json()).ok, true);
  assert.equal(row(junk.id)!.excludedAt, null);
  assert.equal((await listIds()).length, 2);
  assert.ok(table("sirahAudit").some((a) => a.orderId === junk.id && a.action === "INCLUDED_IN_ANALYTICS"));
});

test("only the super admin can archive (delete), restore or see the archive view", async () => {
  const junk = order();
  const manager = user("SIRAH_REVIEWER");
  const lead = user("SIRAH_VIEWER");
  const managerSession = await createSession(manager.id, 12);
  const leadSession = await createSession(lead.id, 12);
  for (const as of [{ session: managerSession }, { session: leadSession }, {}] as As[])
    for (const action of ["ARCHIVE", "RESTORE"]) {
      const response = await act(as, { action, orderId: junk.id });
      assert.equal(response.status, 403, `${action} as ${JSON.stringify(as)}`);
    }
  // Community leads and anonymous callers cannot exclude either.
  for (const as of [{ session: leadSession }, {}] as As[])
    for (const action of ["EXCLUDE", "INCLUDE"])
      assert.equal((await act(as, { action, orderId: junk.id })).status, 403, `${action} as ${JSON.stringify(as)}`);
  // Cross-site requests are refused even with super-admin credentials.
  assert.equal((await act({ superAdmin: true, origin: "https://evil.example" }, { action: "ARCHIVE", orderId: junk.id })).status, 403);
  assert.equal((await act({ session: managerSession, origin: "https://evil.example" }, { action: "EXCLUDE", orderId: junk.id })).status, 403);
  assert.equal(row(junk.id)!.excludedAt, null);
  assert.equal(row(junk.id)!.archivedAt, null);

  // A manager asking for the archive view just gets the normal list.
  await act({ superAdmin: true }, { action: "ARCHIVE", orderId: junk.id });
  const data = await (await enrolmentsGet(req("/api/admin/sirah?archived=only", { session: managerSession }))).json();
  assert.equal(data.archivedView, false);
  assert.deepEqual(data.rows, []);
  // Community leads cannot access student records, including the excluded view.
  const leadView = await enrolmentsGet(req("/api/admin/sirah?excluded=only", { session: leadSession }));
  assert.equal(leadView.status, 403);
});

test("a manager can exclude and un-exclude one record, and sees the excluded view", async () => {
  const junk = order();
  order();
  const manager = user("SIRAH_REVIEWER");
  const session = await createSession(manager.id, 12);
  assert.equal((await act({ session }, { action: "EXCLUDE", orderId: junk.id })).status, 200);
  assert.ok(row(junk.id)!.excludedAt);
  assert.equal(row(junk.id)!.excludedBy, `reviewer:${manager.email}`);
  const view = await (await enrolmentsGet(req("/api/admin/sirah?excluded=only", { session }))).json();
  assert.equal(view.excludedView, true);
  assert.deepEqual(view.rows.map((r: Row) => r.id), [junk.id]);
  assert.equal((await act({ session }, { action: "INCLUDE", orderId: junk.id })).status, 200);
  assert.equal(row(junk.id)!.excludedAt, null);
  assert.ok(table("sirahAudit").some((a) => a.orderId === junk.id && a.action === "EXCLUDED_FROM_ANALYTICS" && a.actor === `reviewer:${manager.email}`));
  assert.ok(table("sirahAudit").some((a) => a.orderId === junk.id && a.action === "INCLUDED_IN_ANALYTICS"));
});

test("checkbox selection: bulk exclude / un-exclude for super admin and manager", async () => {
  const a = order();
  const b = paidOrder();
  const c = order();
  const manager = user("SIRAH_REVIEWER");
  const session = await createSession(manager.id, 12);
  for (const as of [{ superAdmin: true }, { session }] as As[]) {
    const excluded = await bulk(as, { action: "EXCLUDE", orderIds: [a.id, b.id] });
    assert.equal(excluded.status, 200, JSON.stringify(as));
    assert.deepEqual((await excluded.json()).results.map((r: Row) => r.ok), [true, true]);
    assert.ok(row(a.id)!.excludedAt);
    assert.ok(row(b.id)!.excludedAt);
    assert.equal(row(c.id)!.excludedAt, null);
    assert.deepEqual((await listIds()).sort(), [c.id]);
    const included = await bulk(as, { action: "INCLUDE", orderIds: [a.id, b.id] });
    assert.equal(included.status, 200);
    assert.equal(row(a.id)!.excludedAt, null);
    assert.equal(row(b.id)!.excludedAt, null);
  }
  // Exclusion never touches payment, enrolment or the archive flag.
  assert.equal(row(b.id)!.paymentState, "PAID");
  assert.equal(row(b.id)!.enrolmentState, "ACTIVE");
  for (const o of [a, b, c]) assert.equal(row(o.id)!.archivedAt, null);
});

test("the checkbox selection can never delete or archive anything", async () => {
  const a = order();
  const b = order();
  const archived = order();
  await act({ superAdmin: true }, { action: "ARCHIVE", orderId: archived.id });
  for (const body of [
    { action: "ARCHIVE", orderIds: [a.id, b.id] },
    { action: "RESTORE", orderIds: [archived.id] },
    { action: "DELETE", orderIds: [a.id] },
    { action: "DELETE", orderIds: [a.id], confirmation: "DELETE" },
    { action: "EXCLUDE", orderIds: [a.id], archive: true },
    { action: "EXCLUDE", orderId: a.id },
    { action: "EXCLUDE", orderIds: [] },
    { action: "EXCLUDE", orderIds: Array.from({ length: 101 }, () => randomUUID()) },
  ]) {
    const response = await bulk({ superAdmin: true }, body);
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 80));
  }
  // An archived row in a selection is refused for that row only; it stays archived.
  const mixed = await (await bulk({ superAdmin: true }, { action: "EXCLUDE", orderIds: [archived.id, a.id] })).json();
  assert.deepEqual(mixed.results.map((r: Row) => r.ok), [false, true]);
  assert.ok(row(archived.id)!.archivedAt);
  assert.equal(row(archived.id)!.excludedAt, null);
  for (const o of [a, b]) {
    assert.ok(row(o.id));
    assert.equal(row(o.id)!.archivedAt, null);
  }
  assert.equal(table("sirahOrder").length, 3);
  assert.ok(!table("sirahAudit").some((x) => x.action === "ARCHIVED" && x.orderId !== archived.id));
});

test("community leads, anonymous and cross-site callers cannot use the bulk exclusion", async () => {
  const a = order();
  const lead = user("SIRAH_VIEWER");
  const leadSession = await createSession(lead.id, 12);
  for (const as of [{ session: leadSession }, {}, { superAdmin: true, origin: "https://evil.example" }] as As[])
    assert.equal((await bulk(as, { action: "EXCLUDE", orderIds: [a.id] })).status, 403, JSON.stringify(as));
  assert.equal(row(a.id)!.excludedAt, null);
});

test("the single-record endpoint takes no bulk bodies and has no DELETE action", async () => {
  const a = order();
  const b = order();
  for (const body of [
    { action: "ARCHIVE", orderIds: [a.id, b.id] },
    { action: "EXCLUDE", orderIds: [a.id] },
    { action: "DELETE", orderId: a.id, confirmation: "DELETE" },
    { action: "DELETE", orderIds: [a.id], confirmation: "DELETE" },
  ]) {
    const response = await act({ superAdmin: true }, body);
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  for (const o of [a, b]) {
    assert.ok(row(o.id));
    assert.equal(row(o.id)!.archivedAt, null);
    assert.equal(row(o.id)!.excludedAt, null);
  }
});

test("delete archives (soft-deletes) a payment-free row: nothing is removed, it is hidden everywhere, and it is logged", async () => {
  const junk = order({ paymentState: "REJECTED", method: "JAZZCASH" });
  table("sirahAudit").push({ id: randomUUID(), orderId: junk.id, actor: "student", action: "REGISTERED", detail: {}, createdAt: new Date() });
  table("sirahNotification").push({ id: randomUUID(), orderId: junk.id, kind: "REGISTERED", state: "SENT", toEmail: "x@example.test" });
  const keep = order();
  const excludedJunk = order();
  await act({ superAdmin: true }, { action: "EXCLUDE", orderId: excludedJunk.id });

  for (const o of [junk, excludedJunk]) {
    const response = await act({ superAdmin: true }, { action: "ARCHIVE", orderId: o.id });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
  }

  // The row and its children are all still there.
  const archived = row(junk.id)!;
  assert.ok(archived.archivedAt instanceof Date);
  assert.equal(archived.excludedAt, null, "archive does not reuse excludedAt");
  assert.equal(archived.paymentState, "REJECTED");
  assert.equal(table("sirahNotification").filter((n) => n.orderId === junk.id).length, 1);
  assert.equal(table("sirahRecordDeletion").length, 0, "no deletion happened");
  assert.ok(table("sirahAudit").some((a) => a.orderId === junk.id && a.action === "ARCHIVED"));

  // Hidden from the normal list, the excluded view, the CSV and every count.
  assert.deepEqual(await listIds(), [keep.id]);
  assert.deepEqual(await listIds("excluded=only"), []);
  assert.ok(!sirahCsv(await listSirahAdmin(new URLSearchParams())).includes(junk.reference));
  const counts = await sirahOverviewCounts();
  assert.equal(counts.total, 1);
  assert.equal(counts.pending, 1);
  assert.equal(counts.excluded, 0);
  assert.equal(counts.archived, 2);

  // Hidden from the student.
  await assert.rejects(ownedSirahOrder(junk.id, junk.userId), /not found/i);
});

test("the archive view lists archived orders with when they were archived and days left", async () => {
  const junk = order();
  order();
  await act({ superAdmin: true }, { action: "ARCHIVE", orderId: junk.id });
  const data = await (await enrolmentsGet(req("/api/admin/sirah?archived=only", { superAdmin: true }))).json();
  assert.equal(data.archivedView, true);
  assert.deepEqual(data.rows.map((r: Row) => r.id), [junk.id]);
  const entry = data.rows[0];
  const archivedAt = new Date(entry.archivedAt).getTime();
  assert.ok(Math.abs(archivedAt - Date.now()) < 60_000);
  assert.equal(new Date(entry.purgeAt).getTime() - archivedAt, 7 * DAY);
});

test("restore clears archivedAt and puts the record back", async () => {
  const junk = order();
  await act({ superAdmin: true }, { action: "ARCHIVE", orderId: junk.id });
  assert.deepEqual(await listIds(), []);

  const response = await act({ superAdmin: true }, { action: "RESTORE", orderId: junk.id });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(row(junk.id)!.archivedAt, null);
  assert.deepEqual(await listIds(), [junk.id]);
  assert.deepEqual(await listIds("archived=only"), []);
  assert.ok(table("sirahAudit").some((a) => a.orderId === junk.id && a.action === "RESTORED_FROM_ARCHIVE"));
  assert.equal((await ownedSirahOrder(junk.id, junk.userId)).id, junk.id);
});

test("an archived record takes no exclude or enrolment-group action until restored", async () => {
  const junk = order();
  await act({ superAdmin: true }, { action: "ARCHIVE", orderId: junk.id });
  const response = await act({ superAdmin: true }, { action: "EXCLUDE", orderId: junk.id });
  assert.equal(response.status, 404);
  assert.equal(row(junk.id)!.excludedAt, null);
});

test("a record with a real payment, enrolment, open checkout or receipt can never be archived", async () => {
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
  for (const [name, o] of Object.entries(protectedOrders)) {
    const response = await act({ superAdmin: true }, { action: "ARCHIVE", orderId: o.id });
    assert.equal(response.status, 409, name);
    assert.match((await response.json()).error, /Exclude it instead\./, name);
    assert.equal(row(o.id)!.archivedAt, null, `${name} must not be archived`);
  }
  // The same protected records can still be excluded.
  for (const o of Object.values(protectedOrders))
    assert.equal((await act({ superAdmin: true }, { action: "EXCLUDE", orderId: o.id })).status, 200);
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

test("the maintenance purge hard-deletes only orders archived more than 7 days ago, and logs each", async () => {
  const now = new Date();
  const expired = order({ archivedAt: new Date(now.getTime() - 7 * DAY - 60_000), paymentState: "FAILED" });
  table("sirahAudit").push({ id: randomUUID(), orderId: expired.id, actor: "x", action: "ARCHIVED", detail: {}, createdAt: now });
  table("sirahNotification").push({ id: randomUUID(), orderId: expired.id, kind: "REGISTERED", state: "SENT", toEmail: "x@example.test" });
  table("sirahResumeLink").push({ id: randomUUID(), orderId: expired.id });
  const recent = order({ archivedAt: new Date(now.getTime() - 6 * DAY) });
  const live = order();
  const excludedOld = order({ excludedAt: new Date(now.getTime() - 30 * DAY) });
  // Archived long ago but now carries a receipt: never purged.
  const tainted = order({ archivedAt: new Date(now.getTime() - 30 * DAY), method: "JAZZCASH", paymentState: "REJECTED" });
  table("sirahReceipt").push({ id: randomUUID(), orderId: tainted.id, revision: 1, filename: "r.pdf" });

  const result = await purgeExpiredArchivedSirahOrders(now);
  assert.deepEqual(result.deleted, [expired.id]);
  assert.deepEqual(result.skipped.map((s) => s.id), [tainted.id]);

  assert.equal(row(expired.id), undefined);
  for (const o of [recent, live, excludedOld, tainted]) assert.ok(row(o.id), "untouched");
  for (const child of ["sirahAudit", "sirahNotification", "sirahResumeLink"])
    assert.equal(table(child).filter((r) => r.orderId === expired.id).length, 0, child);
  assert.ok(table("user").some((u) => u.id === expired.userId), "student account kept");
  const log = table("sirahRecordDeletion");
  assert.equal(log.length, 1);
  assert.equal(log[0].orderId, expired.id);
  assert.equal(log[0].actor, "system:archive-purge");
  assert.equal((log[0].snapshot as Row).paymentState, "FAILED");
});

test("a record restored before the purge runs is not deleted", async () => {
  const now = new Date();
  const o = order({ archivedAt: new Date(now.getTime() - 8 * DAY) });
  await act({ superAdmin: true }, { action: "RESTORE", orderId: o.id });
  const result = await purgeExpiredArchivedSirahOrders(now);
  assert.deepEqual(result.deleted, []);
  assert.ok(row(o.id));
});

const bulkArchive = (as: As, body: unknown) => bulkArchivePost(req("/api/admin/sirah/records/archive", as, body));

test("archive (kept) works on any record, including paid Stripe and excluded ones, and touches nothing else", async () => {
  const paid = paidOrder({ excludedAt: new Date(), excludedBy: "x" });
  const processing = order({ method: "STRIPE", paymentState: "PROCESSING", providerOrderId: "cs_test_1", checkoutToken: "t" });
  for (const o of [paid, processing]) {
    const response = await act({ superAdmin: true }, { action: "ARCHIVE_KEEP", orderId: o.id });
    assert.equal(response.status, 200);
    assert.ok(row(o.id)!.archivedAt);
    assert.ok(table("sirahAudit").some((a) => a.orderId === o.id && a.action === "ARCHIVED_RETAINED"));
  }
  // Payment, enrolment, provider references and the payment event are untouched.
  assert.equal(row(paid.id)!.paymentState, "PAID");
  assert.equal(row(paid.id)!.paidCount, 1);
  assert.equal(row(processing.id)!.providerOrderId, "cs_test_1");
  assert.equal(table("sirahPaymentEvent").filter((e) => e.orderId === paid.id).length, 1);
  // Hidden from the normal and excluded lists; shown in the archive view as kept.
  assert.deepEqual(await listIds(), []);
  assert.deepEqual(await listIds("excluded=only"), []);
  const archived = (await listSirahAdmin(new URLSearchParams("archived=only"))).rows;
  assert.deepEqual(archived.map((r) => r.id).sort(), [paid.id, processing.id].sort());
  for (const r of archived) {
    assert.equal(r.archiveKept, true);
    assert.equal(r.purgeAt, null);
  }
  // Restore puts it back, with history.
  assert.equal((await act({ superAdmin: true }, { action: "RESTORE", orderId: paid.id })).status, 200);
  assert.equal(row(paid.id)!.archivedAt, null);
  assert.ok(table("sirahAudit").some((a) => a.orderId === paid.id && a.action === "RESTORED_FROM_ARCHIVE"));
});

test("only the super admin can archive (kept), singly or in bulk", async () => {
  const o = order();
  const manager = user("SIRAH_REVIEWER");
  const lead = user("SIRAH_VIEWER");
  for (const as of [{ session: await createSession(manager.id, 12) }, { session: await createSession(lead.id, 12) }, {}] as As[]) {
    assert.equal((await act(as, { action: "ARCHIVE_KEEP", orderId: o.id })).status, 403);
    assert.equal((await bulkArchive(as, { orderIds: [o.id] })).status, 403);
  }
  assert.equal((await bulkArchive({ superAdmin: true, origin: "https://evil.example" }, { orderIds: [o.id] })).status, 403);
  assert.equal(row(o.id)!.archivedAt, null);
});

test("bulk archive (kept) archives each selected record and can never delete", async () => {
  const a = order();
  const b = paidOrder();
  for (const body of [{ orderIds: [] }, { action: "DELETE", orderIds: [a.id] }, { orderId: a.id }])
    assert.equal((await bulkArchive({ superAdmin: true }, body)).status, 400, JSON.stringify(body));
  const response = await bulkArchive({ superAdmin: true }, { orderIds: [a.id, b.id, "missing"] });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).results.map((r: Row) => r.ok), [true, true, false]);
  for (const o of [a, b]) assert.ok(row(o.id)!.archivedAt);
  assert.equal(table("sirahOrder").length, 2);
  assert.equal(table("sirahAudit").filter((x) => x.action === "ARCHIVED_RETAINED").length, 2);
});

test("the purge never deletes a kept archive, including a deleted record later archived (kept)", async () => {
  const now = new Date();
  const kept = order();
  await act({ superAdmin: true }, { action: "ARCHIVE_KEEP", orderId: kept.id });
  row(kept.id)!.archivedAt = new Date(now.getTime() - 30 * DAY);
  // "Deleted" (awaiting purge), then archived (kept): converted, never purged.
  const converted = order();
  await act({ superAdmin: true }, { action: "ARCHIVE", orderId: converted.id });
  const response = await act({ superAdmin: true }, { action: "ARCHIVE_KEEP", orderId: converted.id });
  assert.equal((await response.json()).reason, "It will no longer be deleted.");
  row(converted.id)!.archivedAt = new Date(now.getTime() - 30 * DAY);
  // An ordinary delete past retention is still purged.
  const junk = order({ archivedAt: new Date(now.getTime() - 8 * DAY) });
  const result = await purgeExpiredArchivedSirahOrders(now);
  assert.deepEqual(result.deleted, [junk.id]);
  assert.ok(row(kept.id));
  assert.ok(row(converted.id));
});
