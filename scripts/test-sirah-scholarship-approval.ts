import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { createSession, getSessionIdentity } from "../lib/auth/session";
import { getSirahWorkspaceAccess } from "../lib/auth/sirah-workspace";
import { provisionSirahViewer, grantSirahScholarshipApproval, authenticateSirahViewer } from "../services/sirah-team.service";
import { POST as approve } from "../app/api/admin/sirah/scholarships/route";
import { POST as payments } from "../app/api/admin/sirah/route";
import { POST as generalReview } from "../app/api/admin/free-warrior/review/route";
import { SIRAH_SLUG } from "../lib/sirah/catalog";
import { SIRAH_SCHOLARSHIP_BATCH } from "../lib/sirah/scholarship";
const db = new URL(process.env.DATABASE_URL || "mysql://invalid"); assert.equal(db.hostname, "127.0.0.1"); assert.equal(db.pathname, "/sirah_test");
const prefix = `approval-test-${randomUUID()}`; const email = `${prefix}@example.test`; const base = "http://localhost:3100";
let userId: string, token: string, password: string;
function req(body: object, origin = base) { return new Request(base + "/api/admin/sirah/scholarships", { method: "POST", headers: { cookie: `ga_session=${token}`, origin, "content-type": "application/json" }, body: JSON.stringify(body) }); }
async function application(overrides: object = {}) {
  return prisma.freeWarriorApplication.create({ data: { fullName: "Approval test applicant", email: `${prefix}-${randomUUID()}@example.test`, whatsapp: "+923001234567", cityCountry: "Lahore, Pakistan", occupation: "Student", knowledgeLevel: "Foundational", whatDrawsYou: "Community learning", howItBenefits: "Practical service", mostInterestingTopic: "Leadership", whyThisTopic: "Community work", canAttendRegularly: "Weekly", attendedOrientation: true, reasonForWaiver: "Financial need", adabCommitment: true, genuineFinancialNeed: true, courseSlug: SIRAH_SLUG, courseTitle: "Sīrah", listedPrice: "PKR 32400", scholarshipBatch: SIRAH_SCHOLARSHIP_BATCH, ...overrides } });
}
before(async () => {
  delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM; delete process.env.ADMIN_NOTIFICATION_EMAIL;
  process.env.ADMIN_DASHBOARD_EMAIL = "owner@example.test"; process.env.ADMIN_DASHBOARD_PASSWORD = "owner-test-password"; process.env.ADMIN_DASHBOARD_SECRET = "test-secret"; process.env.ADMIN_API_TOKEN = "test-token"; process.env.NEXT_PUBLIC_APP_URL = base;
  ({ password } = await provisionSirahViewer(email, "Approval team test")); userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id; token = await createSession(userId, 12);
});
after(async () => { await prisma.freeWarriorApplication.deleteMany({ where: { email: { startsWith: prefix } } }); await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } }); await prisma.$disconnect(); });
test("a viewer cannot approve, and an explicit grant preserves the shared password and existing session", async () => {
  const row = await application(); assert.equal((await approve(req({ applicationId: row.id, approve: true }))).status, 403);
  const previous = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  assert.deepEqual(await grantSirahScholarshipApproval(email), { granted: true, changed: true });
  assert.deepEqual(await getSirahWorkspaceAccess(new Request(base, { headers: { cookie: `ga_session=${token}` } })), { readOnly: true, canApproveScholarships: true, canCreateDiscountCodes: true, canManageEnrolments: true });
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).passwordHash, previous.passwordHash); assert.ok(await authenticateSirahViewer(email, password));
  assert.deepEqual(await grantSirahScholarshipApproval(email), { granted: true, changed: false });
});
test("reviewers cannot approve other courses or historical applications, reject requests, or access general/payment writes", async () => {
  for (const overrides of [{ courseSlug: "other-course" }, { scholarshipBatch: null }]) { const row = await application(overrides); assert.equal((await approve(req({ applicationId: row.id, approve: true }))).status, 404); }
  const row = await application(); assert.equal((await approve(req({ applicationId: row.id, approve: false }))).status, 400);
  // Reviewers may now run enrolment actions, so an empty action passes the role gate and fails validation (400, not 401)...
  assert.equal((await payments(req({}))).status, 400);
  // ...but refunds remain the main administrator's alone.
  const refund = await payments(req({ orderId: "any-order", revision: 0, action: "REFUND", note: "Reviewer refund attempt" }));
  assert.equal(refund.status, 403); assert.match((await refund.json()).error, /Refunds require the main administrator/);
  assert.equal((await generalReview(req({ applicationId: row.id, approve: true }))).status, 401);
  assert.equal((await approve(req({ applicationId: row.id, approve: true }, "https://untrusted.example"))).status, 403);
});
test("a scoped full scholarship activates access once, records its approver, and duplicate approval is a conflict", async () => {
  const row = await application(); const response = await approve(req({ applicationId: row.id, approve: true, note: "Reviewed the learning and community commitments." })); assert.equal(response.status, 200);
  const saved = await prisma.freeWarriorApplication.findUniqueOrThrow({ where: { id: row.id } }); assert.equal(saved.status, "APPROVED"); assert.equal(saved.reviewedBy, email); assert.ok(saved.reviewedAt);
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: SIRAH_SLUG } }); const user = await prisma.user.findUniqueOrThrow({ where: { email: row.email } });
  assert.equal((await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: user.id, courseId: course.id } } })).status, "ACTIVE");
  const count = await prisma.registration.count({ where: { userId: user.id } }); const emails = await prisma.emailLog.count({ where: { userId: user.id } });
  assert.equal((await approve(req({ applicationId: row.id, approve: true }))).status, 409); assert.equal(await prisma.registration.count({ where: { userId: user.id } }), count); assert.equal(await prisma.emailLog.count({ where: { userId: user.id } }), emails);
});
test("partial scholarship approval leaves receipt/payment confirmation pending", async () => {
  const row = await application({ reasonForWaiver: "Contribution preference: I can contribute a little (500 PKR monthly)\n\nApplication reason: Financial need", receipt: { create: { method: "JAZZCASH", filename: "receipt.png", mime: "image/png", sha256: "0".repeat(64), data: Buffer.from("local-test") } } });
  assert.equal((await approve(req({ applicationId: row.id, approve: true }))).status, 200);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: row.email } }); const registration = await prisma.registration.findFirstOrThrow({ where: { userId: user.id }, include: { payment: true, enrollment: true } });
  assert.equal(registration.status, "MANUAL_REVIEW"); assert.equal(registration.payment?.status, "UNDER_REVIEW"); assert.equal(registration.enrollment?.status, "PENDING");
});
test("the scoped API returns a conflict at the ten-place limit and leaves the next student pending", async () => {
  const count = await prisma.freeWarriorApplication.count({ where: { scholarshipBatch: SIRAH_SCHOLARSHIP_BATCH, status: "APPROVED" } });
  for (let n = count; n < 10; n++) await application({ status: "APPROVED" });
  const row = await application();
  assert.equal((await approve(req({ applicationId: row.id, approve: true }))).status, 409);
  assert.equal((await prisma.freeWarriorApplication.findUniqueOrThrow({ where: { id: row.id } })).status, "PENDING");
});
test("rotating a reviewer's password preserves scoped approval permission and revokes previous sessions", async () => {
  const rotated = await provisionSirahViewer(email, "Approval team test");
  assert.equal(rotated.role, "SIRAH_REVIEWER");
  assert.equal(await getSessionIdentity(new Request(base, { headers: { cookie: `ga_session=${token}` } })), null);
  assert.ok(await authenticateSirahViewer(email, rotated.password));
});
test("the grant cannot promote students or suspended accounts", async () => {
  await prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } }); await assert.rejects(grantSirahScholarshipApproval(email), /active Sīrah team/);
  await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE", role: "STUDENT" } }); await assert.rejects(grantSirahScholarshipApproval(email), /active Sīrah team/);
});
