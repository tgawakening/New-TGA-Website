/**
 * Sīrah admin roles, group-added tracking and access management, exercised
 * through the real route handlers and services against an in-memory Prisma
 * stand-in (no database, no network).
 */
import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";
import { randomUUID } from "node:crypto";
import { installFakePrisma, table, tables, defaults, type Row } from "./fixtures/fake-prisma";

const base = "https://tga.example";
const SUPER_EMAIL = "owner@tga.example";
const SUPER_TOKEN = "isolated-super-admin-token";
for (const key of Object.keys(process.env))
  if (key.startsWith("SIRAH_") || key.startsWith("ADMIN_") || key === "RESEND_API_KEY")
    delete process.env[key];
Object.assign(process.env, {
  NEXT_PUBLIC_APP_URL: base,
  ADMIN_DASHBOARD_EMAIL: SUPER_EMAIL,
  ADMIN_DASHBOARD_PASSWORD: "owner-test-password",
  ADMIN_DASHBOARD_SECRET: "isolated-admin-test-secret",
  ADMIN_API_TOKEN: SUPER_TOKEN,
});
installFakePrisma();

type Handler = (request: Request) => Promise<Response>;
let createSession: typeof import("../lib/auth/session").createSession;
let getSirahWorkspaceAccess: typeof import("../lib/auth/sirah-workspace").getSirahWorkspaceAccess;
let groupStatus: Handler;
let enrolmentsGet: Handler;
let enrolmentsPost: Handler;
let discountPost: Handler;
let customLinkPost: Handler;
let scholarshipPost: Handler;
let accessGet: Handler;
let accessPost: Handler;
let listSirahAdmin: typeof import("../services/sirah-admin.service").listSirahAdmin;
let sirahCsv: typeof import("../services/sirah-admin.service").sirahCsv;
let sirahOverviewCounts: typeof import("../services/sirah-group.service").sirahOverviewCounts;
let guard: typeof import("../lib/sirah/team-guard");
let SIRAH_SLUG = "";

before(async () => {
  ({ createSession } = await import("../lib/auth/session"));
  ({ getSirahWorkspaceAccess } = await import("../lib/auth/sirah-workspace"));
  ({ POST: groupStatus } = await import("../app/api/admin/sirah/group-status/route"));
  ({ GET: enrolmentsGet, POST: enrolmentsPost } = await import("../app/api/admin/sirah/route"));
  ({ POST: discountPost } = await import("../app/api/admin/sirah/discount/route"));
  ({ POST: customLinkPost } = await import("../app/api/admin/sirah/custom-link/route"));
  ({ POST: scholarshipPost } = await import("../app/api/admin/sirah/scholarships/route"));
  ({ GET: accessGet, POST: accessPost } = await import("../app/api/admin/sirah/access/route"));
  ({ listSirahAdmin, sirahCsv } = await import("../services/sirah-admin.service"));
  ({ sirahOverviewCounts } = await import("../services/sirah-group.service"));
  guard = await import("../lib/sirah/team-guard");
  ({ SIRAH_SLUG } = await import("../lib/sirah/catalog"));
});

let courseId = "";
beforeEach(() => {
  tables.clear();
  courseId = randomUUID();
  table("course").push({ id: courseId, slug: SIRAH_SLUG });
});

function user(role: string, email = `${role.toLowerCase()}-${randomUUID()}@example.test`, status = "ACTIVE") {
  const row: Row = { id: randomUUID(), email, fullName: `${role} person`, role, status, passwordHash: "x", phoneCountryCode: "", phoneNumber: "", createdAt: new Date(), updatedAt: new Date() };
  table("user").push(row);
  return row as Row & { id: string; email: string };
}
function order(overrides: Row = {}) {
  const owner = user("STUDENT");
  const row: Row = {
    ...defaults.sirahOrder,
    id: randomUUID(), userId: owner.id, courseId, batchCode: "beyond-chronology-2026",
    reference: `SIRAH-${randomUUID().toUpperCase()}`, phoneE164: "", countryCode: "GB", countryName: "United Kingdom",
    marketCode: "GB", plan: "ANNUAL", method: "STRIPE", currency: "GBP", amountMinor: 32389, totalMinor: 32389,
    pricingVersion: "v", paymentState: "PAID", enrolmentState: "ACTIVE", paidCount: 1, paidMinor: 32389, revision: 4,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  table("sirahOrder").push(row);
  return row as Row & { id: string };
}
type As = { session?: string; superAdmin?: boolean; origin?: string };
function req(path: string, as: As, body?: unknown) {
  const headers: Record<string, string> = { origin: as.origin ?? base, "content-type": "application/json" };
  if (as.session) headers.cookie = `ga_session=${as.session}`;
  if (as.superAdmin) headers["x-admin-token"] = SUPER_TOKEN;
  return new Request(base + path, { method: body === undefined ? "GET" : "POST", headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const sessionFor = async (role: string) => {
  const u = user(role);
  return { user: u, session: await createSession(u.id, 12) };
};
const sirahOrderRow = (id: string) => table("sirahOrder").find((r) => r.id === id)!;

test("workspace roles map onto the existing access flags (no new auth)", async () => {
  const sup = await getSirahWorkspaceAccess(req("/", { superAdmin: true }));
  assert.deepEqual(sup, { role: "SUPER_ADMIN", readOnly: false, canApproveScholarships: true, canCreateDiscountCodes: true, canManageEnrolments: true, canManageAccess: true, canMarkGroupAdded: true });
  const manager = await sessionFor("SIRAH_REVIEWER");
  assert.deepEqual(await getSirahWorkspaceAccess(req("/", manager)), { role: "MANAGER", readOnly: true, canApproveScholarships: true, canCreateDiscountCodes: true, canManageEnrolments: true, canManageAccess: false, canMarkGroupAdded: true });
  const lead = await sessionFor("SIRAH_VIEWER");
  assert.deepEqual(await getSirahWorkspaceAccess(req("/", lead)), { role: "COMMUNITY_LEAD", readOnly: true, canApproveScholarships: false, canCreateDiscountCodes: false, canManageEnrolments: false, canManageAccess: false, canMarkGroupAdded: true });
  const student = await sessionFor("STUDENT");
  assert.equal(await getSirahWorkspaceAccess(req("/", student)), null);
  assert.equal(await getSirahWorkspaceAccess(req("/", {})), null);
});

test("a Community Lead can mark added-to-group, and that write touches nothing else", async () => {
  const lead = await sessionFor("SIRAH_VIEWER");
  const o = order();
  const before = { ...o };
  const added = await groupStatus(req("/api/admin/sirah/group-status", lead, { orderId: o.id, added: true }));
  assert.equal(added.status, 200);
  assert.equal((await added.json()).changed, true);
  const row = sirahOrderRow(o.id);
  assert.ok(row.groupAddedAt instanceof Date);
  assert.equal(row.groupAddedBy, `lead:${lead.user.email}`);
  for (const key of ["revision", "paymentState", "enrolmentState", "paidMinor", "paidCount", "amountMinor", "invitationState", "method"])
    assert.equal(row[key], before[key], `${key} unchanged`);
  // Idempotent: a second "added" is a no-op with no second audit.
  const again = await groupStatus(req("/api/admin/sirah/group-status", lead, { orderId: o.id, added: true }));
  assert.equal((await again.json()).changed, false);
  assert.equal(table("sirahAudit").filter((a) => a.action === "GROUP_ADDED").length, 1);
  assert.equal(table("sirahAudit")[0].actor, `lead:${lead.user.email}`);
  // Undo clears both fields and is audited.
  const removed = await groupStatus(req("/api/admin/sirah/group-status", lead, { orderId: o.id, added: false }));
  assert.equal(removed.status, 200);
  assert.equal(sirahOrderRow(o.id).groupAddedAt, null);
  assert.equal(sirahOrderRow(o.id).groupAddedBy, null);
  assert.ok(table("sirahAudit").some((a) => a.action === "GROUP_REMOVED"));
  assert.equal(sirahOrderRow(o.id).revision, before.revision);
});

test("the group toggle is strict and refuses students, anonymous callers and other origins", async () => {
  const lead = await sessionFor("SIRAH_VIEWER");
  const o = order();
  const smuggled = await groupStatus(req("/api/admin/sirah/group-status", lead, { orderId: o.id, added: true, paymentState: "REFUNDED" }));
  assert.equal(smuggled.status, 400);
  const student = await sessionFor("STUDENT");
  assert.equal((await groupStatus(req("/api/admin/sirah/group-status", student, { orderId: o.id, added: true }))).status, 401);
  assert.equal((await groupStatus(req("/api/admin/sirah/group-status", {}, { orderId: o.id, added: true }))).status, 401);
  assert.equal((await groupStatus(req("/api/admin/sirah/group-status", { ...lead, origin: "https://evil.example" }, { orderId: o.id, added: true }))).status, 403);
  assert.equal(sirahOrderRow(o.id).groupAddedAt, null);
  assert.equal(sirahOrderRow(o.id).paymentState, "PAID");
  // Managers and the Super Admin may toggle too.
  const manager = await sessionFor("SIRAH_REVIEWER");
  assert.equal((await groupStatus(req("/api/admin/sirah/group-status", manager, { orderId: o.id, added: true }))).status, 200);
  assert.equal(sirahOrderRow(o.id).groupAddedBy, `reviewer:${manager.user.email}`);
  assert.equal((await groupStatus(req("/api/admin/sirah/group-status", { superAdmin: true }, { orderId: o.id, added: false }))).status, 200);
});

test("a Community Lead stays read-only on every other endpoint, but can read and export", async () => {
  const lead = await sessionFor("SIRAH_VIEWER");
  const o = order({ paymentState: "AWAITING_REVIEW", enrolmentState: "PENDING", method: "BANK_TRANSFER", paidCount: 0, paidMinor: 0 });
  const snapshot = JSON.stringify(sirahOrderRow(o.id));
  assert.equal((await enrolmentsPost(req("/api/admin/sirah", lead, { orderId: o.id, revision: 4, action: "APPROVE", verifiedTransfer: true }))).status, 401);
  assert.equal((await discountPost(req("/api/admin/sirah/discount", lead, { amountMinor: 100000 }))).status, 401);
  assert.equal((await customLinkPost(req("/api/admin/sirah/custom-link", lead, { fullName: "Lead attempt", email: "lead-attempt@example.test", plan: "ANNUAL", countryCode: "GB", amount: "1" }))).status, 401);
  assert.equal((await scholarshipPost(req("/api/admin/sirah/scholarships", lead, { applicationId: "x", approve: true }))).status, 403);
  assert.equal((await accessGet(req("/api/admin/sirah/access", lead))).status, 401);
  assert.equal((await accessPost(req("/api/admin/sirah/access", lead, { action: "REVOKE", userId: lead.user.id }))).status, 401);
  assert.equal(JSON.stringify(sirahOrderRow(o.id)), snapshot, "no order field changed");
  assert.equal(table("sirahManualDiscount").length, 0);
  // Read and CSV export remain available.
  assert.equal((await enrolmentsGet(req("/api/admin/sirah", lead))).status, 200);
  const csv = await enrolmentsGet(req("/api/admin/sirah?format=csv", lead));
  assert.equal(csv.status, 200);
  assert.match((await csv.text()).split("\r\n")[0], /,Added to group,Group added at,Group added by$/);
});

test("Managers cannot reach Access and roles", async () => {
  const manager = await sessionFor("SIRAH_REVIEWER");
  const other = user("SIRAH_REVIEWER");
  assert.equal((await accessGet(req("/api/admin/sirah/access", manager))).status, 401);
  assert.equal((await accessPost(req("/api/admin/sirah/access", manager, { action: "DEMOTE", userId: other.id }))).status, 401);
  assert.equal(table("user").find((u) => u.id === other.id)!.role, "SIRAH_REVIEWER");
});

test("Super Admin manages access: add, promote, demote and revoke (revoke ends sessions)", async () => {
  const sup = { superAdmin: true };
  const added = await accessPost(req("/api/admin/sirah/access", sup, { action: "ADD_LEAD", email: "New.Lead@Example.test", fullName: "New Lead" }));
  assert.equal(added.status, 200);
  const addedBody = await added.json();
  assert.equal(addedBody.role, "SIRAH_VIEWER");
  assert.ok(addedBody.password.length >= 24);
  const lead = table("user").find((u) => u.email === "new.lead@example.test")!;
  assert.equal((await accessPost(req("/api/admin/sirah/access", sup, { action: "PROMOTE", userId: lead.id }))).status, 200);
  assert.equal(lead.role, "SIRAH_REVIEWER");
  assert.equal((await accessPost(req("/api/admin/sirah/access", sup, { action: "DEMOTE", userId: lead.id }))).status, 200);
  assert.equal(lead.role, "SIRAH_VIEWER");
  const token = await createSession(lead.id as string, 12);
  assert.ok(await getSirahWorkspaceAccess(req("/", { session: token })));
  assert.equal((await accessPost(req("/api/admin/sirah/access", sup, { action: "REVOKE", userId: lead.id }))).status, 200);
  assert.equal(lead.status, "SUSPENDED");
  assert.equal(table("session").filter((s) => s.userId === lead.id).length, 0, "sessions ended");
  assert.equal(await getSirahWorkspaceAccess(req("/", { session: token })), null);
  const list = await (await accessGet(req("/api/admin/sirah/access", sup))).json();
  assert.equal(list.rows.find((r: Row) => r.id === lead.id).status, "SUSPENDED");
  // Demote only applies to Managers; students/admin-role accounts are untouchable here.
  const student = user("STUDENT");
  assert.equal((await accessPost(req("/api/admin/sirah/access", sup, { action: "REVOKE", userId: student.id }))).status, 409);
  assert.equal(student.status, "ACTIVE");
});

test("the env Super Admin can never be demoted, revoked or re-provisioned, by anyone", async () => {
  const sup = { superAdmin: true };
  // Even if a team row exists with the Super Admin's email (any case), it is protected.
  const shadow = user("SIRAH_REVIEWER", "Owner@TGA.example");
  for (const action of ["DEMOTE", "REVOKE"]) {
    const response = await accessPost(req("/api/admin/sirah/access", sup, { action, userId: shadow.id }));
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /Super Admin account cannot be demoted, revoked/);
  }
  assert.equal(shadow.role, "SIRAH_REVIEWER");
  assert.equal(shadow.status, "ACTIVE");
  const reprovision = await accessPost(req("/api/admin/sirah/access", sup, { action: "ADD_LEAD", email: SUPER_EMAIL.toUpperCase(), fullName: "Impostor" }));
  assert.equal(reprovision.status, 409);
  // Pure guard: quoted/whitespace env values and case differences still match.
  const env = { ADMIN_DASHBOARD_EMAIL: '  "Owner@TGA.example" ' };
  assert.equal(guard.isProtectedSuperAdminEmail("owner@tga.example", env), true);
  assert.match(guard.teamChangeRefusal("REVOKE", { email: "OWNER@tga.example", role: "SIRAH_VIEWER", status: "ACTIVE" }, env)!, /Super Admin/);
  assert.equal(guard.isProtectedSuperAdminEmail("anyone@example.test", {}), false);
});

test("Students list filters not-yet-added and needs-attention; CSV and overview count the group", async () => {
  const added = order({ groupAddedAt: new Date("2026-11-10T10:00:00Z"), groupAddedBy: "lead:a@example.test" });
  const notAdded = order();
  const review = order({ paymentState: "AWAITING_REVIEW", enrolmentState: "PENDING", paidCount: 0, paidMinor: 0 });
  order({ paymentState: "UNPAID", enrolmentState: "PENDING", paidCount: 0, paidMinor: 0 });
  const notYet = await listSirahAdmin(new URLSearchParams({ group: "NOT_ADDED", payment: "PAID" }));
  assert.deepEqual(notYet.rows.map((r) => r.id), [notAdded.id]);
  const yes = await listSirahAdmin(new URLSearchParams({ group: "ADDED" }));
  assert.deepEqual(yes.rows.map((r) => r.id), [added.id]);
  const attention = await listSirahAdmin(new URLSearchParams({ payment: "NEEDS_ATTENTION" }));
  assert.deepEqual(attention.rows.map((r) => r.id), [review.id]);
  await assert.rejects(listSirahAdmin(new URLSearchParams({ group: "MAYBE" })), /valid group status/);
  const csv = sirahCsv(yes).split("\r\n");
  assert.match(csv[1], /"Yes","2026-11-10T10:00:00\.000Z","lead:a@example\.test"$/);
  assert.deepEqual(await sirahOverviewCounts(), { total: 4, paid: 2, pending: 2, needsReview: 1, groupAdded: 1, groupNotAdded: 1 });
});
