/* Card (Stripe) scholarship contributions: availability, pricing, storage and
 * validation. Pure: no database and no Stripe calls. Every env value below is
 * a fake set only inside this test process. */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  formatCardContributionLine,
  parseFreeWarriorContribution,
  scholarshipCardLinkPath,
} from "../lib/free-warrior";
import { resolveScholarshipCardContribution, scholarshipCardOption } from "../lib/sirah/scholarship-card";
import { freeWarriorApplicationSchema } from "../lib/validations/free-warrior";
import { SIRAH_SCHOLARSHIP_BATCH } from "../lib/sirah/scholarship";

const terms = {
  version: "test-annual-v1",
  commitment: "Commitment text.",
  cancellation: "Cancellation text.",
  refund: "Refund text.",
  access: "Access text.",
  tax: "Tax text.",
  cancellationTiming: "PERIOD_END",
  failedPaymentAccess: "KEEP",
  refundAccess: "KEEP",
  refundBilling: "CANCEL",
};
const keys = [
  "SIRAH_ANNUAL_TERMS_JSON", "SIRAH_STRIPE_SECRET_KEY", "SIRAH_STRIPE_WEBHOOK_SECRET", "SIRAH_STRIPE_ACCOUNT_ID",
  "SIRAH_STRIPE_ANNUAL_CURRENCIES", "SIRAH_LIVE_PAYMENTS_APPROVED", "SIRAH_STRIPE_ANNUAL_CHECKOUT_ROUTES",
];
function stripeTestMode(currencies: string) {
  process.env.SIRAH_ANNUAL_TERMS_JSON = JSON.stringify(terms);
  process.env.SIRAH_STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.SIRAH_STRIPE_WEBHOOK_SECRET = "whsec_fake";
  process.env.SIRAH_STRIPE_ACCOUNT_ID = "acct_fake";
  process.env.SIRAH_STRIPE_ANNUAL_CURRENCIES = currencies;
}
beforeEach(() => {
  for (const key of keys) delete process.env[key];
});

test("no card option anywhere while the Sīrah Stripe route is not configured", () => {
  assert.equal(scholarshipCardOption("GB"), null);
  assert.equal(scholarshipCardOption("PK"), null);
  assert.equal(resolveScholarshipCardContribution("GB", "1000"), null);
});

test("a card option appears only for currencies the existing one-time Stripe route enables", () => {
  stripeTestMode("GBP");
  assert.ok(scholarshipCardOption("GB"));
  assert.ok(scholarshipCardOption("NG"), "an unlisted country billed in GBP follows the catalogue");
  assert.equal(scholarshipCardOption("US"), null, "USD is not enabled");
  assert.equal(scholarshipCardOption("IN"), null, "INR is not enabled");
});

test("live Stripe keys need the same country/route approval as registration", () => {
  stripeTestMode("GBP");
  process.env.SIRAH_STRIPE_SECRET_KEY = "sk_live_fake";
  assert.equal(scholarshipCardOption("GB"), null);
});

test("tiers are the PKR tier's share of the regional card fee, in that currency, never PKR", () => {
  stripeTestMode("GBP,INR,PKR,BHD,USD");
  const gb = scholarshipCardOption("GB")!;
  assert.equal(gb.currency, "GBP");
  assert.deepEqual(gb.tiers.map((t) => [t.tier, t.monthlyMinor, t.totalMinor]), [["1000", 1000, 12000], ["500", 500, 6000]]);
  const india = scholarshipCardOption("IN")!;
  assert.equal(india.currency, "INR");
  assert.deepEqual(india.tiers.map((t) => t.monthlyMinor), [50000, 25000]);
  const pk = scholarshipCardOption("PK")!;
  assert.deepEqual(pk.tiers.map((t) => t.monthlyMinor), [100000, 50000], "Pakistan keeps exactly PKR 1,000 / 500");
  const bh = scholarshipCardOption("BH")!;
  assert.equal(bh.currency, "BHD");
  for (const t of bh.tiers) assert.equal(t.monthlyMinor % 10, 0, "three-decimal card amounts end in 0");
  const us = scholarshipCardOption("US")!;
  assert.deepEqual(us.tiers.map((t) => t.monthlyMinor), [1300, 700]);
});

test("the stored card line round-trips and is read as a card contribution, not a full scholarship", () => {
  stripeTestMode("GBP");
  const card = resolveScholarshipCardContribution("GB", "500")!;
  const reason = [`Contribution preference: I can afford some fees monthly by card (GBP 5.00 monthly, paid once as GBP 60.00 after approval).\n${formatCardContributionLine(card)}`, "I cannot afford the full fee."].join("\n\n");
  const parsed = parseFreeWarriorContribution(reason);
  assert.equal(parsed.contributionPreference, "PARTIAL_CONTRIBUTION");
  assert.equal(parsed.paymentLabel, "Card (Stripe)");
  assert.deepEqual(parsed.card, card);
  assert.equal(parsed.applicationReason, "I cannot afford the full fee.");
  assert.match(parsed.amountLabel, /GBP\s5\.00\/month · one-time card payment GBP\s60\.00/);
});

test("manual and full-scholarship applications parse exactly as before", () => {
  const manual = parseFreeWarriorContribution("Contribution preference: I can afford some fees monthly (1000 PKR monthly).\n\nSender name: A\nSender number: 0300\nTransfer reference: REF\n\nNeed");
  assert.equal(manual.contributionPreference, "PARTIAL_CONTRIBUTION");
  assert.equal(manual.monthlyContributionPkr, 1000);
  assert.equal(manual.paymentLabel, "Bank Transfer");
  assert.equal(manual.card, null);
  const full = parseFreeWarriorContribution("Contribution preference: No, I need complete scholarship.\n\nNeed");
  assert.equal(full.contributionPreference, "FULL_SCHOLARSHIP");
  assert.equal(full.card, null);
});

test("an applicant cannot plant a card line in their own reason text", () => {
  const reason = "Contribution preference: No, I need complete scholarship.\n\nContribution preference: by card\nCard contribution: country=GB; currency=GBP; monthlyMinor=1; totalMinor=12; months=12; tier=500";
  const parsed = parseFreeWarriorContribution(reason);
  assert.equal(parsed.contributionPreference, "FULL_SCHOLARSHIP");
  assert.equal(parsed.card, null);
});

test("the prefilled custom-link path carries the one-time amount and plan", () => {
  const path = scholarshipCardLinkPath(
    { id: "app_1", fullName: "Test Student", email: "s@example.test" },
    { countryCode: "GB", currency: "GBP", monthlyMinor: 1000, totalMinor: 12000, months: 12, tier: "1000" },
  );
  const url = new URL(path, "https://example.test");
  assert.equal(url.pathname, "/admin/sirah/custom-link");
  assert.equal(url.searchParams.get("amount"), "120.00");
  assert.equal(url.searchParams.get("plan"), "ANNUAL");
  assert.equal(url.searchParams.get("country"), "GB");
  assert.equal(url.searchParams.get("currency"), "GBP");
});

function payload(overrides: Record<string, unknown>) {
  return {
    scholarshipBatch: SIRAH_SCHOLARSHIP_BATCH,
    fullName: "Test Student", email: "s@example.test", whatsapp: "+447700900123", age: 24,
    cityCountry: "London, United Kingdom", occupation: "Student", knowledgeLevel: "Beginner",
    previousSeerahStudy: "Read a Seerah book with a study circle.", whatDrawsYou: "x", howItBenefits: "x",
    mostInterestingTopic: "Leadership", whyThisTopic: "x", canAttendRegularly: "Weekly", attendedOrientation: false,
    reasonForWaiver: "Need", adabCommitment: true, genuineFinancialNeed: true,
    scholarshipDetails: {
      seerahReflection: "A lesson from the Seerah applied to my life.", arabicLevel: "STARTING",
      arabicExperience: "I am starting to learn Arabic letters.", deenUnderstanding: "I study the foundations of Islam.",
      communityContribution: "I help at my local masjid each week.", missionSupport: "I can help organise local events.",
      skillsResources: "I have design and writing skills to offer.", skillsStatus: "CURRENT_SKILLS", skillLearningPlan: "",
      skillsLearningCommitment: true, actionPlan: "I will start a monthly study circle locally.", weeklyHours: 4,
      missionCommitment: true, selectionAcknowledgement: true,
    },
    ...overrides,
  };
}

test("validation: card needs a country but no transfer details; manual is unchanged", () => {
  const card = freeWarriorApplicationSchema.safeParse(payload({ contributionPreference: "PARTIAL_CONTRIBUTION", monthlyContributionPkr: "500", contributionRoute: "CARD", cardCountry: "gb" }));
  assert.ok(card.success, JSON.stringify(card.error?.flatten()));
  assert.equal(card.data.cardCountry, "GB");
  const noCountry = freeWarriorApplicationSchema.safeParse(payload({ contributionPreference: "PARTIAL_CONTRIBUTION", monthlyContributionPkr: "500", contributionRoute: "CARD" }));
  assert.equal(noCountry.success, false);
  const manualMissing = freeWarriorApplicationSchema.safeParse(payload({ contributionPreference: "PARTIAL_CONTRIBUTION", monthlyContributionPkr: "500" }));
  assert.equal(manualMissing.success, false, "the default (manual) route still needs method and sender details");
  const manual = freeWarriorApplicationSchema.safeParse(payload({ contributionPreference: "PARTIAL_CONTRIBUTION", monthlyContributionPkr: "500", manualPaymentMethod: "JAZZCASH", manualSenderName: "A", manualSenderNumber: "0300", manualReferenceKey: "REF" }));
  assert.ok(manual.success);
  assert.equal(manual.data.contributionRoute, "MANUAL");
  const fullByCard = freeWarriorApplicationSchema.safeParse(payload({ contributionPreference: "FULL_SCHOLARSHIP", contributionRoute: "CARD", cardCountry: "GB" }));
  assert.equal(fullByCard.success, false);
});
