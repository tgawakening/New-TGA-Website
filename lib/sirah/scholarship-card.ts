import "server-only";
import { SIRAH_MONTHS, currencyScale, priceFor } from "./catalog";
import { methodAvailable } from "./config";
import type { ScholarshipCardContribution } from "@/lib/free-warrior";

/** Card contributions are one-time charges: the Sīrah route for a one-time
 * card checkout is the full-programme ("ANNUAL") plan. A recurring card
 * mandate is not used, so cards that cannot hold one (India's RBI e-mandate
 * rules, some others) still work. */
export const SCHOLARSHIP_CARD_PLAN = "ANNUAL" as const;

/** The scholarship tiers as published, in PKR a month. */
export const SCHOLARSHIP_TIERS = ["1000", "500"] as const;
export type ScholarshipTier = (typeof SCHOLARSHIP_TIERS)[number];

/** Each tier is the same share of the regional monthly card fee as it is of
 * Pakistan's: PKR 1,000 of PKR 3,000 is one third, PKR 500 one sixth. The
 * share is applied to the destination's own catalogue fee, so no PKR amount
 * is ever charged to another country's card. */
function shareMinor(tier: ScholarshipTier, country: string) {
  const reference = priceFor("PK", "MONTHLY", "STRIPE"); // PKR 3,000.00
  const regional = priceFor(country, "MONTHLY", "STRIPE");
  const tierMinor = Number(tier) * 10 ** currencyScale("PKR");
  const raw = (regional.amountMinor * tierMinor) / reference.amountMinor;
  // 100 minor units: a whole unit in two-decimal currencies (and whole HUF,
  // which Stripe requires); 0.100 in BHD/KWD, which meets Stripe's
  // multiple-of-10 rule for three-decimal currencies.
  const step = 100;
  return { currency: regional.currency, monthlyMinor: Math.max(step, Math.round(raw / step) * step) };
}

export type ScholarshipCardOption = {
  countryCode: string;
  currency: string;
  months: number;
  tiers: Array<{ tier: ScholarshipTier; monthlyMinor: number; totalMinor: number }>;
};

/** The card option for a country, or null where the existing Sīrah Stripe
 * configuration does not allow a one-time card checkout in that country's
 * currency: the same `methodAvailable` gate registration uses. */
export function scholarshipCardOption(countryCode: string): ScholarshipCardOption | null {
  const country = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return null;
  const { currency } = priceFor(country, SCHOLARSHIP_CARD_PLAN, "STRIPE");
  if (!methodAvailable("STRIPE", country, currency, SCHOLARSHIP_CARD_PLAN)) return null;
  return {
    countryCode: country,
    currency,
    months: SIRAH_MONTHS,
    tiers: SCHOLARSHIP_TIERS.map((tier) => {
      const { monthlyMinor } = shareMinor(tier, country);
      return { tier, monthlyMinor, totalMinor: monthlyMinor * SIRAH_MONTHS };
    }),
  };
}

/** Server-side resolution of what the applicant chose. Never trusts a
 * client amount: the amount is recomputed here from country and tier. */
export function resolveScholarshipCardContribution(
  countryCode: string,
  tier: string,
): ScholarshipCardContribution | null {
  const option = scholarshipCardOption(countryCode);
  const picked = option?.tiers.find((row) => row.tier === tier);
  if (!option || !picked) return null;
  return {
    countryCode: option.countryCode,
    currency: option.currency,
    monthlyMinor: picked.monthlyMinor,
    totalMinor: picked.totalMinor,
    months: option.months,
    tier: picked.tier,
  };
}
