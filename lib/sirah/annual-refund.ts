import { addMonthsClamped } from "@/services/sirah-confirmation.service";
export type AnnualRefundInput = {
  collectedMinor: number;
  refundedMinor: number;
  unusedEligibleMonths: number;
  currency: string;
};

/** Calculation only: staff determines eligible months; this never issues a refund. */
export function calculateSirahAnnualRefund(input: AnnualRefundInput) {
  for (const amount of [input.collectedMinor, input.refundedMinor])
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new Error("Refund amounts must be non-negative safe minor units.");
  if (input.refundedMinor > input.collectedMinor)
    throw new Error("Previous refunds exceed the verified amount collected.");
  if (
    !Number.isInteger(input.unusedEligibleMonths) ||
    input.unusedEligibleMonths < 0 ||
    input.unusedEligibleMonths > 12
  )
    throw new Error(
      "Staff must specify zero to twelve whole eligible unused months.",
    );
  if (!/^[A-Z]{3}$/.test(input.currency))
    throw new Error("Invalid refund currency.");
  // Round down once in the charge currency's minor units; never use monthly list prices.
  const cap = Number(
    (BigInt(input.collectedMinor) * BigInt(input.unusedEligibleMonths)) /
      BigInt(12),
  );
  return {
    ...input,
    calculationVersion: "sirah-unused-months-v1",
    cumulativeCapMinor: cap,
    additionalRefundMinor: Math.max(0, cap - input.refundedMinor),
    remainingCollectedMinor: input.collectedMinor - input.refundedMinor,
    priorRefundExceedsPolicyCap: input.refundedMinor > cap,
    policyApprovalRequired: true,
  };
}

/** Proposed standard: a started month is used; statutory overrides need staff review. */
export function calculateSirahAnnualUnusedMonths(start: Date, asOf: Date) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(asOf.getTime()))
    throw new Error("Valid programme and cancellation dates are required.");
  let usedMonths = 0;
  while (usedMonths < 12 && asOf > addMonthsClamped(start, usedMonths))
    usedMonths++;
  return {
    usedMonths,
    unusedEligibleMonths: 12 - usedMonths,
    paidThrough: addMonthsClamped(start, usedMonths),
  };
}
