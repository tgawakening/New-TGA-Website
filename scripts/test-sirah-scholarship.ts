import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
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
beforeEach(async () => { delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM; delete process.env.ADMIN_NOTIFICATION_EMAIL; await clean(); });
after(async () => { await clean(); await prisma.$disconnect(); });
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
