import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { createSession, getSessionIdentity } from "../lib/auth/session";
import { getSirahWorkspaceAccess } from "../lib/auth/sirah-workspace";
import { provisionSirahViewer, authenticateSirahViewer } from "../services/sirah-team.service";
import { POST as login } from "../app/api/admin/login/route";
import { GET as enrolments, POST as mutateEnrolment } from "../app/api/admin/sirah/route";
import { GET as scholarships } from "../app/api/admin/sirah/scholarships/route";
import { GET as receipt } from "../app/api/admin/fee-waiver/[id]/receipt/route";
import { GET as generalApplications } from "../app/api/admin/free-warrior/route";
import { GET as notifications } from "../app/api/admin/notifications/route";
import { GET as legacy } from "../app/api/admin/sirah/legacy/route";
import { POST as review } from "../app/api/admin/free-warrior/review/route";
import { POST as updateCohort } from "../app/api/admin/sirah/cohort/route";
import { SIRAH_SLUG } from "../lib/sirah/catalog";
import { SIRAH_SCHOLARSHIP_BATCH } from "../lib/sirah/scholarship";
const db = new URL(process.env.DATABASE_URL || "mysql://invalid");
assert.equal(db.hostname, "127.0.0.1"); assert.equal(db.pathname, "/sirah_test");
const prefix = `sirah-team-test-${randomUUID()}`;
const email = `${prefix}@example.test`;
const base = "http://localhost:3100";
let password: string, userId: string, token: string, currentId: string, unrelatedId: string;
function req(path: string, session = token, body?: object) {
  return new Request(base + path, { method: body ? "POST" : "GET", headers: { cookie: `ga_session=${session}`, origin: base, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
before(async () => {
  process.env.ADMIN_DASHBOARD_EMAIL = "owner@example.test"; process.env.ADMIN_DASHBOARD_PASSWORD = "owner-test-password"; process.env.ADMIN_DASHBOARD_SECRET = "isolated-admin-test-secret"; process.env.ADMIN_API_TOKEN = "isolated-api-admin-token"; process.env.NEXT_PUBLIC_APP_URL = base;
  ({ password } = await provisionSirahViewer(email, "Test Sīrah team"));
  userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
  token = await createSession(userId, 12);
  const data = { fullName: "Test scholarship applicant", email, whatsapp: "+923001234567", cityCountry: "Lahore, Pakistan", occupation: "Student", knowledgeLevel: "Foundational", whatDrawsYou: "Community learning", howItBenefits: "Practical service", mostInterestingTopic: "Leadership", whyThisTopic: "Community work", canAttendRegularly: "Weekly", attendedOrientation: true, reasonForWaiver: "Financial need", adabCommitment: true, genuineFinancialNeed: true, courseSlug: SIRAH_SLUG, courseTitle: "Sīrah", listedPrice: "PKR 32400", scholarshipBatch: SIRAH_SCHOLARSHIP_BATCH, scholarshipDetails: { skillLearningPlan: "Learn design to support community classes" }, receipt: { create: { method: "JAZZCASH", filename: "test.png", mime: "image/png", sha256: "0".repeat(64), data: Buffer.from("isolated-receipt-test") } } };
  currentId = (await prisma.freeWarriorApplication.create({ data })).id;
  unrelatedId = (await prisma.freeWarriorApplication.create({ data: { ...data, courseSlug: "unrelated-course", fullName: "Unrelated application" } })).id;
});
after(async () => {
  await prisma.freeWarriorApplication.deleteMany({ where: { email } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});
test("team provisioning hashes credentials and grants only SIRAH_VIEWER", async () => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  assert.equal(user.role, "SIRAH_VIEWER"); assert.notEqual(user.passwordHash, password); assert.equal(password.length, 32);
  assert.ok(await authenticateSirahViewer(email.toUpperCase(), password)); assert.equal(await authenticateSirahViewer(email, "wrong"), null);
});
test("staff login issues only the scoped database session and clears an old full-admin cookie", async () => {
  const response = await login(new Request(base + "/api/admin/login", { method: "POST", headers: { origin: base, "content-type": "application/json" }, body: JSON.stringify({ email, password }) }));
  assert.equal(response.status, 200); assert.equal((await response.json()).next, "/admin/sirah");
  const session = response.cookies.get("ga_session"); assert.ok(session?.value); assert.equal(response.cookies.get("ga_admin_session")?.value, "");
  const record = await getSessionIdentity(req("/", session.value)); assert.equal(record?.role, "SIRAH_VIEWER");
});
test("only scoped read APIs accept team access; arbitrary batch/course filters cannot expose other applications", async () => {
  // A SIRAH_VIEWER is read-only: no scholarship approval, discount codes or enrolment actions.
  assert.deepEqual(await getSirahWorkspaceAccess(req("/")), { readOnly: true, canApproveScholarships: false, canCreateDiscountCodes: false, canManageEnrolments: false });
  assert.equal((await enrolments(req("/api/admin/sirah"))).status, 200);
  const response = await scholarships(req(`/api/admin/sirah/scholarships?q=${prefix}&courseSlug=unrelated-course&scholarshipBatch=other`));
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
  const result = await response.json(); assert.equal(result.rows.length, 1); assert.equal(result.rows[0].id, currentId); assert.equal(result.rows[0].scholarshipDetails.skillLearningPlan, "Learn design to support community classes");
  assert.equal((await scholarships(req("/api/admin/sirah/scholarships?status=INVALID"))).status, 400);
});
test("staff can read current scholarship evidence but cannot fetch unrelated evidence by guessing IDs", async () => {
  const good = await receipt(req("/api/admin/fee-waiver/receipt"), { params: Promise.resolve({ id: currentId }) });
  assert.equal(good.status, 200); assert.equal(await good.text(), "isolated-receipt-test");
  assert.equal((await receipt(req("/api/admin/fee-waiver/receipt"), { params: Promise.resolve({ id: unrelatedId }) })).status, 404);
});
test("server rejects staff mutations, wider admin data, notifications and historical exports", async () => {
  for (const handler of [mutateEnrolment, review, updateCohort]) assert.equal((await handler(req("/api/admin/action", token, {}))).status, 401);
  for (const handler of [generalApplications, notifications, legacy]) assert.equal((await handler(req("/api/admin/data"))).status, 401);
});
test("student, expired, suspended and forged sessions cannot gain Sīrah admin access", async () => {
  assert.equal((await enrolments(req("/api/admin/sirah", "forged"))).status, 401);
  await prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
  assert.equal(await getSirahWorkspaceAccess(req("/")), null); assert.equal(await authenticateSirahViewer(email, password), null);
  await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE", role: "STUDENT" } });
  assert.equal((await scholarships(req("/api/admin/sirah/scholarships"))).status, 401);
  await prisma.user.update({ where: { id: userId }, data: { role: "SIRAH_VIEWER" } });
  await prisma.session.updateMany({ where: { userId }, data: { expiresAt: new Date(0) } });
  assert.equal(await getSirahWorkspaceAccess(req("/")), null);
});
test("password rotation invalidates old sessions and never promotes an existing student", async () => {
  const active = await createSession(userId, 12);
  const rotated = await provisionSirahViewer(email, "Test Sīrah team");
  assert.notEqual(rotated.password, password); assert.equal(await getSessionIdentity(req("/", active)), null);
  await prisma.user.update({ where: { id: userId }, data: { role: "STUDENT" } });
  await assert.rejects(provisionSirahViewer(email, "Not allowed"), /existing non-team account/);
  await prisma.user.update({ where: { id: userId }, data: { role: "SIRAH_VIEWER" } });
});
