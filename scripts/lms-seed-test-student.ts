/**
 * Seed a TEST STUDENT for LMS testing: a normal login account with an ACTIVE,
 * PAID Sīrah enrolment in one cohort, flagged as a test record so it never
 * counts in payment totals or student counts.
 *
 *   npm run lms:test-student              # dry run: reads and prints the plan, writes nothing
 *   npm run lms:test-student -- --apply   # creates the account and enrolment
 *
 * --apply writes to whichever database DATABASE_URL points at: check that
 * first. Nothing here reads, prints or changes any secret.
 *
 * ADDITIVE ONLY. It only INSERTs new rows, never updates or deletes:
 * - The email is free: it creates the user (+ student profile), and the same
 *   rows a real verified payment produces (services/sirah-confirmation.service.ts):
 *   a SirahOrder already in its paid state (PAID, ACTIVE, paidCount 1, a
 *   12-month programme), its Registration (ACTIVE), Payment (CONFIRMED),
 *   Enrollment (ACTIVE) and one FIRST payment event.
 * - The email belongs to an account this script seeded before: it reports
 *   that account's access and writes nothing (the password is unchanged).
 * - The email belongs to any other account: it stops. It never adds access
 *   to, or changes, an account it did not create.
 *
 * Test flag: excludedAt / excludedBy plus an EXCLUDED_FROM_ANALYTICS audit,
 * exactly what the admin "Mark as test / exclude from analytics" action
 * writes (services/sirah-records.service.ts). Excluded orders are left out of
 * the Students and Payments lists, the CSV export, payment totals and the
 * Overview counts.
 *
 * Quiet by design: annual plan (no renewal reminders), invitationState SENT
 * (so the course-group invitation job never emails a test account), and no
 * notification rows are queued. A TEST_ACCOUNT_SEEDED audit records all of
 * this on the order. Classroom announcement emails do still reach it, as they
 * reach every enrolled student.
 */
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { countries } from "countries-list";
import { prisma } from "../lib/prisma";
import { priceFor, SIRAH_MONTHS, SIRAH_SLUG, SIRAH_TITLE } from "../lib/sirah/catalog";
import { sirahStudentCohortAccess } from "../lib/lms/access";
import { addMonthsClamped, canAccessSirah } from "../services/sirah-confirmation.service";

// ── Configure ──────────────────────────────────────────────────────────────

/** Login email (stored lower-case, as the login form does). */
const TEST_STUDENT_EMAIL = "test.student@tga-awakening.com";
/**
 * Login password, 8 to 72 characters. Leave empty to have --apply generate a
 * strong random one and print it once. Prefer empty: anything typed here is
 * committed to git, and this account can open the paid classroom.
 */
const TEST_STUDENT_PASSWORD: string = "";
const TEST_STUDENT_NAME = "TGA Test Student";
/** The cohort (SirahCohort.batchCode) the enrolment is in. */
const COHORT_BATCH_CODE = "beyond-chronology-2026";
/** A Pakistan annual bank-transfer enrolment, priced from the live catalogue. */
const COUNTRY_CODE = "PK";
const PHONE = { countryCode: "+92", number: "3000000000", e164: "+923000000000" };

const ACTOR = "script:lms-seed-test-student";
const SEED_MARKER = "TEST_ACCOUNT_SEEDED";
const PLAN = "ANNUAL" as const;
const METHOD = "BANK_TRANSFER" as const;

// ── Helpers ────────────────────────────────────────────────────────────────

const apply = process.argv.includes("--apply");
const email = TEST_STUDENT_EMAIL.trim().toLowerCase();
const line = (label: string, value: unknown) => console.log(`  ${label.padEnd(22)} ${value}`);

class Stop extends Error {}

function checkConfig() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Stop(`TEST_STUDENT_EMAIL "${email}" is not a valid email.`);
  if (TEST_STUDENT_PASSWORD && (TEST_STUDENT_PASSWORD.length < 8 || TEST_STUDENT_PASSWORD.length > 72))
    throw new Stop("TEST_STUDENT_PASSWORD must be 8 to 72 characters (or empty to generate one).");
  if (!(COUNTRY_CODE in countries)) throw new Stop(`COUNTRY_CODE ${COUNTRY_CODE} is not a country code.`);
}

/** The app's access answer for this user: the classroom rule, scoped to the cohort as the join route does. */
async function reportAccess(userId: string) {
  const order = await prisma.sirahOrder.findFirst({
    where: { userId, course: { slug: SIRAH_SLUG }, batchCode: COHORT_BATCH_CODE },
  });
  const cohortAccess = await sirahStudentCohortAccess(userId);
  const enrollment = await prisma.enrollment.findFirst({ where: { userId, course: { slug: SIRAH_SLUG } }, select: { status: true } });
  console.log("\nAccess check (the app's own rules):");
  line("Order", order ? `${order.reference} · ${order.paymentState} / ${order.enrolmentState}` : "none");
  line("canAccessSirah", order ? canAccessSirah(order) : false);
  line("Enrollment", enrollment?.status ?? "none");
  line("Classroom cohort", cohortAccess.cohortId ?? "none");
  line("Test flag", order?.excludedAt ? `excluded from analytics (${order.excludedBy})` : "NOT set");
  const ok = Boolean(order && canAccessSirah(order) && cohortAccess.allowed && cohortAccess.cohortId === COHORT_BATCH_CODE);
  console.log(ok ? `\nOK: the enrolment is ACTIVE and admits this account to ${COHORT_BATCH_CODE}.` : `\nWARNING: this account is NOT admitted to ${COHORT_BATCH_CODE}.`);
  return ok;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  checkConfig();
  console.log(`LMS test student · ${apply ? "APPLY" : "DRY RUN (nothing is written; add -- --apply to create)"}\n`);

  const [course, cohort, existing] = await Promise.all([
    prisma.course.findUnique({ where: { slug: SIRAH_SLUG }, select: { id: true, title: true } }),
    prisma.sirahCohort.findUnique({ where: { batchCode: COHORT_BATCH_CODE }, select: { batchCode: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
  ]);
  if (!course) throw new Stop(`The Sīrah course (${SIRAH_SLUG}) is not in this database. Nothing was written.`);
  if (!cohort) throw new Stop(`Cohort ${COHORT_BATCH_CODE} is not in this database. Nothing was written.`);

  if (existing) {
    // Ours only if one of its orders in this cohort carries this script's seed audit.
    const orders = await prisma.sirahOrder.findMany({
      where: { userId: existing.id, courseId: course.id, batchCode: COHORT_BATCH_CODE },
      select: { id: true },
    });
    const seeded = orders.length
      ? await prisma.sirahAudit.findFirst({
          where: { orderId: { in: orders.map((order) => order.id) }, action: SEED_MARKER, actor: ACTOR },
          select: { id: true },
        })
      : null;
    if (!seeded)
      throw new Stop(
        `An account with ${email} already exists and was not created by this script. ` +
          "It was left untouched. Set TEST_STUDENT_EMAIL to an unused address.",
      );
    console.log(`${email} is a test account this script already seeded. Nothing was written; the password is unchanged.`);
    await reportAccess(existing.id);
    return;
  }

  const price = priceFor(COUNTRY_CODE, PLAN, METHOD);
  const countryName = countries[COUNTRY_CODE as keyof typeof countries].name;
  const now = new Date();
  const programmeEnd = addMonthsClamped(now, SIRAH_MONTHS);
  const reference = `SIRAH-${randomUUID().toUpperCase()}`;

  console.log("Would create (new rows only):");
  line("User", `${email} · "${TEST_STUDENT_NAME}" · STUDENT · ACTIVE`);
  line("Student profile", `${COUNTRY_CODE} ${countryName}`);
  line("Sīrah order", `${reference}`);
  line("  cohort", COHORT_BATCH_CODE);
  line("  plan / method", `${PLAN} / ${METHOD}`);
  line("  amount", `${price.amountMinor} ${price.currency} (minor units, catalogue ${price.pricingVersion})`);
  line("  state", "PAID / ACTIVE, paidCount 1");
  line("  programme", `${now.toISOString().slice(0, 10)} to ${programmeEnd.toISOString().slice(0, 10)}`);
  line("  test flag", `excludedAt now, excludedBy ${ACTOR}`);
  line("  invitationState", "SENT (no group invitation email)");
  line("Registration", "ACTIVE");
  line("Payment", "CONFIRMED");
  line("Enrollment", "ACTIVE");
  line("Payment event", "FIRST");
  line("Audit", `${SEED_MARKER}, EXCLUDED_FROM_ANALYTICS`);

  if (!apply) {
    console.log("\nDry run: nothing written. Re-run with -- --apply to create it.");
    return;
  }

  const password = TEST_STUDENT_PASSWORD || randomBytes(18).toString("base64url");
  // The app's own password hashing (bcrypt, cost 12), so the normal login works.
  const passwordHash = await bcrypt.hash(password, 12);

  const userId = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName: TEST_STUDENT_NAME,
        email,
        passwordHash,
        phoneCountryCode: PHONE.countryCode,
        phoneNumber: PHONE.number,
        role: "STUDENT",
        status: "ACTIVE",
        emailVerifiedAt: now,
        studentProfile: { create: { countryCode: COUNTRY_CODE, countryName } },
      },
    });
    const registration = await tx.registration.create({
      data: {
        userId: user.id,
        courseId: course.id,
        selectedCountryCode: COUNTRY_CODE,
        selectedCountryName: countryName,
        selectedCurrency: price.currency,
        baseAmount: price.amountMinor,
        couponDiscountAmount: 0,
        finalAmount: price.amountMinor,
        paymentMethod: METHOD,
        paymentReference: reference,
        status: "ACTIVE",
        pricingSnapshot: {
          courseTitle: SIRAH_TITLE,
          batchCode: COHORT_BATCH_CODE,
          pricingVersion: price.pricingVersion,
          discount: null,
          currency: price.currency,
          chargeCurrency: price.currency,
          chargeAmount: price.amountMinor,
          months: SIRAH_MONTHS,
          selectedPaymentPlanType: "FULL_COURSE",
          terms: null,
          testAccount: true,
        },
      },
    });
    const eventId = `test-seed-${randomUUID()}`;
    await tx.payment.create({
      data: {
        registrationId: registration.id,
        provider: METHOD,
        providerPaymentId: eventId,
        amount: price.amountMinor,
        currency: price.currency,
        status: "CONFIRMED",
        paidAt: now,
        manualNotes: "Test account seeded by scripts/lms-seed-test-student.ts. No money was received.",
      },
    });
    await tx.enrollment.create({
      data: { userId: user.id, courseId: course.id, registrationId: registration.id, status: "ACTIVE", activatedAt: now },
    });
    const order = await tx.sirahOrder.create({
      data: {
        userId: user.id,
        courseId: course.id,
        batchCode: COHORT_BATCH_CODE,
        reference,
        requestKey: `test-seed-${randomUUID()}`,
        registrationId: registration.id,
        phoneCountry: COUNTRY_CODE,
        phoneE164: PHONE.e164,
        countryCode: COUNTRY_CODE,
        countryName,
        marketCode: price.market,
        plan: PLAN,
        method: METHOD,
        pricingVersion: price.pricingVersion,
        currency: price.currency,
        amountMinor: price.amountMinor,
        totalMinor: price.totalMinor,
        terms: Prisma.DbNull,
        discount: Prisma.DbNull,
        paymentState: "PAID",
        enrolmentState: "ACTIVE",
        paidMinor: price.amountMinor,
        paidCount: 1,
        programmeStart: now,
        programmeEnd,
        nextBillingAt: null,
        accessEndsAt: null,
        invitationState: "SENT",
        revision: 1,
        excludedAt: now,
        excludedBy: ACTOR,
      },
    });
    await tx.sirahPaymentEvent.create({
      data: { id: eventId, orderId: order.id, provider: METHOD, amountMinor: price.amountMinor, currency: price.currency, kind: "FIRST" },
    });
    await tx.sirahAudit.createMany({
      data: [
        {
          orderId: order.id,
          actor: ACTOR,
          action: SEED_MARKER,
          detail: {
            note: "LMS test account. No money was received. invitationState SENT so no group invitation is emailed.",
            cohort: COHORT_BATCH_CODE,
          },
        },
        { orderId: order.id, actor: ACTOR, action: "EXCLUDED_FROM_ANALYTICS", detail: { note: "LMS test account" } },
      ],
    });
    return user.id;
  });

  console.log("\nCreated.");
  const ok = await reportAccess(userId);
  console.log("\nLog in at /login with:");
  line("Email", email);
  line("Password", password);
  if (!TEST_STUDENT_PASSWORD) console.log("  (generated now and shown only once: save it. Use Forgot password to reset it later.)");
  if (!ok) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Stop ? `Stopped: ${error.message}` : error instanceof Error ? `${error.name}: ${error.message}` : "Failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
