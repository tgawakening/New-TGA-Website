import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { POST as applyScholarship } from "../app/api/free-warrior/apply/route";
import { GET as getScholarshipReceipt } from "../app/api/admin/fee-waiver/[id]/receipt/route";
import { listFreeWarriorApplicationsForAdmin } from "../services/free-warrior.service";
import { scholarshipSubmissionEmail } from "../lib/sirah/scholarship-email";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { freeWarriorApplicationSchema } from "../lib/validations/free-warrior";
import { SIRAH_SCHOLARSHIP_BATCH } from "../lib/sirah/scholarship";
import { SIRAH_SLUG, SIRAH_TITLE } from "../lib/sirah/catalog";
import { submitFreeWarriorApplication, reviewFreeWarriorApplication } from "../services/free-warrior.service";

const db = new URL(process.env.DATABASE_URL || "mysql://invalid");
assert.equal(db.hostname, "127.0.0.1", "Scholarship tests require isolated local MySQL.");
assert.equal(db.pathname, "/sirah_test");
const prefix = "scholarship-test-";
const originalFetch = global.fetch;
function payload() {
  return {
    fullName: "Scholarship Test Student", email: `${prefix}${randomUUID()}@example.test`, whatsapp: "+923001234567", age: 24,
    cityCountry: "Lahore, Pakistan", occupation: "Student", knowledgeLevel: "Intermediate",
    previousSeerahStudy: "Studied a Seerah text with a weekly community circle.", currentInvolvement: "Volunteer mentoring",
    whatDrawsYou: "Learning to put the lessons of the Seerah into practice.", howItBenefits: "I would support a local study group and share what I learn.",
    mostInterestingTopic: "Leadership", whyThisTopic: "I want to improve my practical community service.", canAttendRegularly: "I will reserve weekly class and study time.", attendedOrientation: false,
    contributionPreference: "FULL_SCHOLARSHIP" as const, reasonForWaiver: "I cannot currently afford the fees while studying.", adabCommitment: true as const, genuineFinancialNeed: true as const,
    scholarshipBatch: SIRAH_SCHOLARSHIP_BATCH,
    scholarshipDetails: {
      seerahReflection: "Consultation helps build trust; I would apply this in our study circle.",
      arabicLevel: "FOUNDATIONAL" as const, arabicExperience: "I have studied introductory Arabic grammar with a teacher.",
      deenUnderstanding: "I study the foundations of worship, belief and Islamic character.", communityContribution: "I help organise a weekly reading group for young adults.",
      missionSupport: "I can help organise local study sessions and community events.", skillsResources: "I have writing and event organisation experience to contribute.",
      skillsStatus: "CURRENT_SKILLS" as const, skillLearningPlan: "", skillsLearningCommitment: true as const,
      actionPlan: "I will establish a monthly circle and collect participant feedback.", weeklyHours: 5, missionCommitment: true as const, selectionAcknowledgement: true as const,
    },
  };
}
async function clean() {
  await prisma.freeWarriorApplication.deleteMany({ where: { email: { startsWith: prefix } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
}
beforeEach(async () => { global.fetch = originalFetch; delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM; delete process.env.ADMIN_NOTIFICATION_EMAIL; await clean(); });
after(async () => { global.fetch = originalFetch; await clean(); await prisma.$disconnect(); });
async function create() { return submitFreeWarriorApplication(freeWarriorApplicationSchema.parse(payload())); }

test("all Batch 4 eligibility responses and acknowledgements are required without automatically excluding starting Arabic learners", () => {
  const valid = payload();
  assert.equal(freeWarriorApplicationSchema.safeParse(valid).success, true);
  for (const key of Object.keys(valid.scholarshipDetails)) {
    const details = { ...valid.scholarshipDetails } as Record<string, unknown>;
    delete details[key];
    if (key !== "skillLearningPlan") assert.equal(freeWarriorApplicationSchema.safeParse({ ...valid, scholarshipDetails: details }).success, false, key);
  }
  assert.equal(freeWarriorApplicationSchema.safeParse({ ...valid, scholarshipDetails: { ...valid.scholarshipDetails, arabicLevel: "STARTING" } }).success, true);
  assert.equal(freeWarriorApplicationSchema.safeParse({ ...valid, scholarshipDetails: { ...valid.scholarshipDetails, missionCommitment: false } }).success, false);
  assert.equal(freeWarriorApplicationSchema.safeParse({ ...valid, scholarshipBatch: "other" }).success, false);
  assert.equal(freeWarriorApplicationSchema.safeParse({ ...valid, scholarshipDetails: { ...valid.scholarshipDetails, skillsStatus: "LEARNING_REQUIRED" } }).success, false);
  assert.equal(freeWarriorApplicationSchema.safeParse({ ...valid, scholarshipDetails: { ...valid.scholarshipDetails, skillsStatus: "LEARNING_REQUIRED", skillLearningPlan: "I will start a basic translation course and practise on community learning resources." } }).success, true);
  assert.equal(freeWarriorApplicationSchema.safeParse({ ...valid, contributionPreference: "PARTIAL_CONTRIBUTION", monthlyContributionPkr: "500" }).success, false);
});

test("submission persists structured answers, canonical course identity, and prevents duplicate Batch 4 applications", async () => {
  const input = freeWarriorApplicationSchema.parse({ ...payload(), courseSlug: "tampered", courseTitle: "tampered" });
  const result = await submitFreeWarriorApplication(input);
  const saved = await prisma.freeWarriorApplication.findUniqueOrThrow({ where: { id: result.applicationId } });
  assert.equal(saved.courseSlug, SIRAH_SLUG);
  assert.equal(saved.courseTitle, SIRAH_TITLE);
  assert.equal(saved.scholarshipBatch, SIRAH_SCHOLARSHIP_BATCH);
  assert.deepEqual(saved.scholarshipDetails, input.scholarshipDetails);
  assert.equal(saved.status, "PENDING");
  assert.equal(await prisma.user.count({ where: { email: input.email } }), 0);
  await assert.rejects(submitFreeWarriorApplication(input), /already pending or approved/);
});

test("concurrent approvals for the last place award exactly one scholarship and leave the other pending", async () => {
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: SIRAH_SLUG } });
  for (let i = 0; i < 9; i++) {
    const created = await create();
    await prisma.freeWarriorApplication.update({ where: { id: created.applicationId }, data: { status: "APPROVED" } });
  }
  const candidates = await Promise.all([create(), create()]);
  const results = await Promise.allSettled(candidates.map(c => reviewFreeWarriorApplication({ applicationId: c.applicationId, approve: true })));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.filter(r => r.status === "rejected").length, 1);
  assert.match(String((results.find(r => r.status === "rejected") as PromiseRejectedResult).reason), /All 10/);
  assert.equal(await prisma.freeWarriorApplication.count({ where: { scholarshipBatch: SIRAH_SCHOLARSHIP_BATCH, status: "APPROVED" } }), 10);
  assert.equal(await prisma.freeWarriorApplication.count({ where: { id: { in: candidates.map(c => c.applicationId) }, status: "PENDING" } }), 1);
  const winner = results.find(r => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string; email: string }>;
  const user = await prisma.user.findUniqueOrThrow({ where: { email: winner.value.email } });
  assert.equal((await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: user.id, courseId: course.id } } })).status, "ACTIVE");
  await assert.rejects(reviewFreeWarriorApplication({ applicationId: winner.value.id, approve: true }), /already been reviewed/);
});

test("historical applications remain readable and do not consume Batch 4 places", async () => {
  const old = await create();
  await prisma.freeWarriorApplication.update({ where: { id: old.applicationId }, data: { scholarshipBatch: null, scholarshipDetails: undefined, status: "APPROVED" } });
  const current = await create();
  await reviewFreeWarriorApplication({ applicationId: current.applicationId, approve: true });
  assert.equal(await prisma.freeWarriorApplication.count({ where: { scholarshipBatch: SIRAH_SCHOLARSHIP_BATCH, status: "APPROVED" } }), 1);
  assert.equal((await prisma.freeWarriorApplication.findUniqueOrThrow({ where: { id: old.applicationId } })).status, "APPROVED");
});

test("scholarship approval never replaces an existing paid registration", async () => {
  const c = await create();
  const application = await prisma.freeWarriorApplication.findUniqueOrThrow({ where: { id: c.applicationId } });
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: SIRAH_SLUG } });
  const user = await prisma.user.create({ data: { fullName: application.fullName, email: application.email, passwordHash: "synthetic", phoneCountryCode: "+92", phoneNumber: "3001234567" } });
  const registration = await prisma.registration.create({ data: { userId: user.id, courseId: course.id, selectedCountryCode: "PK", selectedCountryName: "Pakistan", selectedCurrency: "PKR", baseAmount: 3240000, finalAmount: 3240000, paymentMethod: "STRIPE", status: "ACTIVE", pricingSnapshot: {}, payment: { create: { provider: "STRIPE", amount: 3240000, currency: "PKR", status: "CONFIRMED" } } } });
  await assert.rejects(reviewFreeWarriorApplication({ applicationId: application.id, approve: true }), /already has a paid registration/);
  assert.equal((await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).finalAmount, 3240000);
  assert.equal((await prisma.freeWarriorApplication.findUniqueOrThrow({ where: { id: application.id } })).status, "PENDING");
});


function partialPayload(method: "BANK_TRANSFER" | "JAZZCASH") {
  return freeWarriorApplicationSchema.parse({ ...payload(), contributionPreference: "PARTIAL_CONTRIBUTION", monthlyContributionPkr: "500", manualPaymentMethod: method, manualSenderName: "Scholarship Sender", manualSenderNumber: "03001234567", manualReferenceKey: "SYNTHETIC-TRANSFER", manualNotes: "Synthetic proof only" });
}
for (const method of ["BANK_TRANSFER", "JAZZCASH"] as const) test(`${method} scholarship contributions require valid private receipt evidence and remain unverified`, async () => {
  const input = partialPayload(method);
  await assert.rejects(submitFreeWarriorApplication(input), /upload your payment receipt/);
  await assert.rejects(submitFreeWarriorApplication(input, { name: "fake.png", data: Buffer.from("not an image") }), /file contents/);
  assert.equal(await prisma.freeWarriorApplication.count({ where: { email: input.email } }), 0);
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).png().toBuffer();
  const result = await submitFreeWarriorApplication(input, { name: "transfer.png", data: image });
  const saved = await prisma.freeWarriorReceipt.findUniqueOrThrow({ where: { applicationId: result.applicationId } });
  assert.equal(saved.method, method);
  assert.equal(saved.mime, "image/png");
  assert.deepEqual(Buffer.from(saved.data), image);
  assert.equal(await prisma.user.count({ where: { email: input.email } }), 0);
  process.env.ADMIN_API_TOKEN = "synthetic-staff-token";
  const params = { params: Promise.resolve({ id: result.applicationId }) };
  const anonymous = await getScholarshipReceipt(new Request("http://localhost/api/admin/fee-waiver/test/receipt"), params);
  assert.equal(anonymous.status, 401);
  const staff = await getScholarshipReceipt(new Request("http://localhost/api/admin/fee-waiver/test/receipt", { headers: { "x-admin-token": "synthetic-staff-token" } }), params);
  assert.equal(staff.status, 200);
  assert.equal(staff.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await staff.arrayBuffer()), image);
  const overview = (await listFreeWarriorApplicationsForAdmin()).find(row => row.id === result.applicationId)!;
  assert.deepEqual(Object.keys(overview.receipt!).sort(), ["filename", "method", "mime"]);
  await reviewFreeWarriorApplication({ applicationId: result.applicationId, approve: true });
  const registration = await prisma.registration.findFirstOrThrow({ where: { user: { email: input.email } }, include: { payment: true, enrollment: true } });
  assert.equal(registration.payment!.provider, method);
  assert.equal(registration.payment!.status, "UNDER_REVIEW");
  assert.equal(registration.enrollment!.status, "PENDING");
});

test("public scholarship API rejects missing evidence and accepts bounded multipart evidence", async () => {
  const input = partialPayload("JAZZCASH");
  const missing = await applyScholarship(new Request("http://localhost/api/fee-waiver/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  assert.equal(missing.status, 400);
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).png().toBuffer();
  const form = new FormData(); form.set("details", JSON.stringify(input)); form.set("receipt", new File([new Uint8Array(image)], "receipt.png", { type: "image/png" }));
  const result = await applyScholarship(new Request("http://localhost/api/fee-waiver/apply", { method: "POST", body: form }));
  assert.equal(result.status, 200);
  const id = (await result.json()).applicationId;
  assert.equal((await prisma.freeWarriorApplication.findUniqueOrThrow({ where: { id } })).status, "PENDING");
});

test("scholarship emails include every submitted answer, escape HTML and link receipts only for staff", async () => {
  const input = partialPayload("JAZZCASH");
  input.fullName = "Applicant <script>unsafe</script>";
  input.scholarshipDetails.skillLearningPlan = "Start a weekly design course and practise on community materials.";
  const application = { id: "synthetic-reference", createdAt: new Date("2026-11-09T00:00:00Z") };
  const receipt = { filename: "transfer.png", mime: "image/png" };
  const admin = scholarshipSubmissionEmail(input, application, receipt, true);
  const student = scholarshipSubmissionEmail(input, application, receipt, false);
  for (const value of [input.fullName, input.email, input.whatsapp, input.cityCountry, input.occupation, input.knowledgeLevel, input.previousSeerahStudy, input.currentInvolvement, input.whatDrawsYou, input.howItBenefits, input.mostInterestingTopic, input.whyThisTopic, input.canAttendRegularly, input.manualSenderName, input.manualSenderNumber, input.manualReferenceKey, input.manualNotes, input.reasonForWaiver, ...Object.values(input.scholarshipDetails).filter(v => typeof v === "string" && !["CURRENT_SKILLS", "FOUNDATIONAL"].includes(v))]) {
    if (value) { assert.ok(admin.text.includes(String(value)), String(value)); assert.ok(student.text.includes(String(value))); }
  }
  assert.ok(!admin.html.includes("<script>"));
  assert.ok(admin.html.includes("&lt;script&gt;"));
  assert.ok(admin.text.includes("/api/admin/fee-waiver/synthetic-reference/receipt"));
  assert.ok(!student.text.includes("/api/admin/"));
  for (const field of ["Age: 24", "Weekly hours: 5", "Attended orientation: No", "JazzCash", "PKR 500", "Skills-learning commitment: Yes", "Genuine financial need: Yes", "Ten-place selection acknowledged: Yes", "awaiting staff verification"]) assert.ok(admin.text.includes(field), field);
});

test("submission sends one complete acknowledgement and one named staff overview without duplicate recipients", async () => {
  process.env.RESEND_API_KEY = "synthetic"; process.env.EMAIL_FROM = "sender@example.test"; process.env.ADMIN_NOTIFICATION_EMAIL = "Admin@Example.test,admin@example.test";
  const captured: Array<{ body: { to: string[]; html: string; subject: string }; key: string | null }> = [];
  global.fetch = async (_url, init) => { captured.push({ body: JSON.parse(String(init?.body)), key: new Headers(init?.headers).get("Idempotency-Key") }); return Response.json({ id: "synthetic-mail" }); };
  const input = freeWarriorApplicationSchema.parse(payload());
  await submitFreeWarriorApplication(input);
  assert.equal(captured.length, 2);
  assert.ok(captured.every(mail => mail.key && mail.body.html.includes(input.scholarshipDetails.communityContribution)));
  assert.equal(captured.filter(mail => mail.body.to.includes("admin@example.test")).length, 1);
  assert.ok(captured.find(mail => mail.body.to.includes("admin@example.test"))!.body.subject.includes(`submitted by ${input.fullName}`));
  const staffApplicant = freeWarriorApplicationSchema.parse(payload());
  process.env.ADMIN_NOTIFICATION_EMAIL = staffApplicant.email;
  captured.length = 0;
  await submitFreeWarriorApplication(staffApplicant);
  assert.equal(captured.length, 1);
  assert.ok(captured[0].body.subject.includes("submitted by"));
});
