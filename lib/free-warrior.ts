const APPROX_PKR_PER_GBP = 375;

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
  };
}
