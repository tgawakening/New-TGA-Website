import { formatSirahMoney, minorToDecimal } from "./sirah/catalog";

const APPROX_PKR_PER_GBP = 375;

/** A partial contribution paid by card (Stripe) instead of a manual transfer.
 * Nothing is charged at submission. After approval the team issues a one-time
 * Sīrah card link (the existing admin custom link, full-programme plan) for
 * `totalMinor`; paying it enrols the student through the existing webhook. */
export type ScholarshipCardContribution = {
  countryCode: string;
  currency: string;
  /** The monthly share, in the currency's minor unit. */
  monthlyMinor: number;
  /** The one-time charge: the monthly share for every programme month. */
  totalMinor: number;
  months: number;
  /** The PKR tier the share is scaled from. */
  tier: "500" | "1000";
};

const CARD_LINE = /^Card contribution:\s*(.+)$/im;

/** The stored line that the parser below reads back. Machine-readable on purpose. */
export function formatCardContributionLine(card: ScholarshipCardContribution) {
  return `Card contribution: country=${card.countryCode}; currency=${card.currency}; monthlyMinor=${card.monthlyMinor}; totalMinor=${card.totalMinor}; months=${card.months}; tier=${card.tier}`;
}

/** The admin custom-link page, filled in for this applicant's one-time card
 * payment. Staff still check and confirm it there; nothing is charged here. */
export function scholarshipCardLinkPath(application: { id: string; fullName: string; email: string }, card: ScholarshipCardContribution) {
  const query = new URLSearchParams({
    fullName: application.fullName,
    email: application.email,
    country: card.countryCode,
    currency: card.currency,
    amount: minorToDecimal(card.totalMinor, card.currency),
    plan: "ANNUAL",
    sponsorLabel: "Batch 4 scholarship contribution",
    note: `Scholarship application ${application.id}`,
  });
  return `/admin/sirah/custom-link?${query.toString()}`;
}

export function parseCardContributionLine(reasonForWaiver: string): ScholarshipCardContribution | null {
  const line = reasonForWaiver.match(CARD_LINE)?.[1];
  if (!line) return null;
  const fields: Record<string, string> = {};
  for (const part of line.split(";")) {
    const [key, value] = part.split("=").map((v) => v.trim());
    if (key && value) fields[key] = value;
  }
  const int = (value: string | undefined) => (value && /^\d{1,12}$/.test(value) ? Number(value) : NaN);
  const card = {
    countryCode: fields.country || "",
    currency: fields.currency || "",
    monthlyMinor: int(fields.monthlyMinor),
    totalMinor: int(fields.totalMinor),
    months: int(fields.months),
    tier: fields.tier,
  };
  return /^[A-Z]{2}$/.test(card.countryCode) &&
    /^[A-Z]{3}$/.test(card.currency) &&
    card.monthlyMinor > 0 &&
    card.totalMinor > 0 &&
    card.months > 0 &&
    (card.tier === "500" || card.tier === "1000")
    ? (card as ScholarshipCardContribution)
    : null;
}

export type FreeWarriorContributionDetails = {
  contributionPreference: "FULL_SCHOLARSHIP" | "PARTIAL_CONTRIBUTION";
  monthlyContributionPkr: number | null;
  monthlyContributionGbp: number | null;
  contributionLabel: string;
  paymentLabel: string;
  amountLabel: string;
  senderName: string | null;
  senderNumber: string | null;
  referenceKey: string | null;
  manualNotes: string | null;
  applicationReason: string;
  /** Set only for a card (Stripe) contribution. */
  card: ScholarshipCardContribution | null;
};

function matchFirst(pattern: RegExp, value: string) {
  const match = value.match(pattern);
  return match?.[1]?.trim() || null;
}

export function convertPkrToApproxGbp(amountPkr: number) {
  return Number((amountPkr / APPROX_PKR_PER_GBP).toFixed(2));
}

export function formatApproxScholarshipAmount(amountPkr: number) {
  const approxGbp = convertPkrToApproxGbp(amountPkr);
  return `PKR ${amountPkr}/month (approx. GBP ${approxGbp.toFixed(2)}/month)`;
}

export function parseFreeWarriorContribution(reasonForWaiver: string): FreeWarriorContributionDetails {
  const normalizedReason = reasonForWaiver.trim();
  const contributionLine = matchFirst(/^Contribution preference:\s*(.+)$/im, normalizedReason);
  const monthlyContribution = matchFirst(/\((\d+)\s*PKR monthly\)/i, normalizedReason);
  const monthlyContributionPkr = monthlyContribution ? Number(monthlyContribution) : null;
  const monthlyContributionGbp = monthlyContributionPkr ? convertPkrToApproxGbp(monthlyContributionPkr) : null;
  const senderName = matchFirst(/^Sender name:\s*(.+)$/im, normalizedReason);
  const senderNumber = matchFirst(/^Sender number:\s*(.+)$/im, normalizedReason);
  const referenceKey = matchFirst(/^Transfer reference:\s*(.+)$/im, normalizedReason);
  const manualNotes = matchFirst(/^Manual notes:\s*(.+)$/im, normalizedReason);

  const applicationReason = normalizedReason
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter(
      (part) =>
        !/^Contribution preference:/i.test(part) &&
        !/^Sender name:/i.test(part) &&
        !/^Sender number:/i.test(part) &&
        !/^Transfer reference:/i.test(part) &&
        !/^Manual notes:/i.test(part),
    )
    .join("\n\n");

  // A card contribution has no PKR amount: without this branch, checked
  // first, the fallback below would read it as a full scholarship. Only the
  // first block is read (the one the server writes), never the applicant's
  // own reason text further down.
  const firstBlock = normalizedReason.split(/\n\s*\n/)[0] || "";
  if (/^Contribution preference:.*\bby card\b/im.test(firstBlock)) {
    const card = parseCardContributionLine(firstBlock);
    const amountLabel = card
      ? `${formatSirahMoney(card.monthlyMinor, card.currency)}/month · one-time card payment ${formatSirahMoney(card.totalMinor, card.currency)}`
      : "Card contribution (amount unreadable: check the application)";
    return {
      contributionPreference: "PARTIAL_CONTRIBUTION",
      monthlyContributionPkr: null,
      monthlyContributionGbp: card?.currency === "GBP" ? card.monthlyMinor / 100 : null,
      contributionLabel: `Can pay by card: ${amountLabel}`,
      paymentLabel: "Card (Stripe)",
      amountLabel,
      senderName: null,
      senderNumber: null,
      referenceKey: null,
      manualNotes,
      applicationReason,
      card,
    };
  }

  if (contributionLine?.toLowerCase().includes("complete scholarship")) {
    return {
      contributionPreference: "FULL_SCHOLARSHIP",
      monthlyContributionPkr: null,
      monthlyContributionGbp: null,
      contributionLabel: "Needs full scholarship",
      paymentLabel: "On Full Scholarship",
      amountLabel: "GBP 0.00/month",
      senderName,
      senderNumber,
      referenceKey,
      manualNotes,
      applicationReason,
      card: null,
    };
  }

  if (monthlyContributionPkr) {
    return {
      contributionPreference: "PARTIAL_CONTRIBUTION",
      monthlyContributionPkr,
      monthlyContributionGbp,
      contributionLabel: `Can pay ${formatApproxScholarshipAmount(monthlyContributionPkr)}`,
      paymentLabel: "Bank Transfer",
      amountLabel: formatApproxScholarshipAmount(monthlyContributionPkr),
      senderName,
      senderNumber,
      referenceKey,
      manualNotes,
      applicationReason,
      card: null,
    };
  }

  return {
    contributionPreference: "FULL_SCHOLARSHIP",
    monthlyContributionPkr: null,
    monthlyContributionGbp: null,
    contributionLabel: "Needs full scholarship",
    paymentLabel: "On Full Scholarship",
    amountLabel: "GBP 0.00/month",
    senderName,
    senderNumber,
    referenceKey,
    manualNotes,
    applicationReason,
    card: null,
  };
}
