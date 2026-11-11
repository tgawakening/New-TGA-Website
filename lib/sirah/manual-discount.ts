import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { priceFor, SIRAH_BATCH, type SirahMethod, type SirahPlan } from "./catalog";
export class SirahDiscountError extends Error {}
export const discountCodeHash = (code: string) => createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
export type ManualDiscountSnapshot = { grantId: string; originalAmountMinor: number; amountMinor: number; label: string };
export async function manualDiscountEligible(email: string) {
  try {
    return !!await prisma.sirahManualDiscount.findFirst({ where: { email: email.trim().toLowerCase(), batchCode: SIRAH_BATCH, countryCode: "PK", plan: "MONTHLY", currency: "PKR", isActive: true }, select: { id: true } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2021") return false;
    throw error;
  }
}
export async function personalSirahPrice(country: string, plan: SirahPlan, method: SirahMethod | null, email: string, code?: string, savedDiscount?: unknown) {
  const base = priceFor(country, plan, method);
  const codeProvided = !!code?.trim();
  const snapshot = savedDiscount as Partial<ManualDiscountSnapshot> | null;
  const applicable = country === "PK" && plan === "MONTHLY" && (method === "BANK_TRANSFER" || method === "JAZZCASH") && base.currency === "PKR";
  const unchanged = { ...base, discount: null as ManualDiscountSnapshot | null };
  if (!codeProvided && (!snapshot?.grantId || !applicable)) return unchanged;
  // Look up by code (or saved grant) + context. Email is NOT part of the lookup:
  // a code may be unbound (email === "") and redeemable by any registration.
  const grant = applicable ? await prisma.sirahManualDiscount.findFirst({ where: {
    ...(codeProvided ? { codeHash: discountCodeHash(code!) } : { id: snapshot!.grantId }),
    batchCode: SIRAH_BATCH, countryCode: country, plan, currency: base.currency, isActive: true,
  } }) : null;
  // A rejection throws (with the exact reason) when the student typed a code,
  // but silently returns base price when only re-pricing a saved snapshot.
  const fail = (message: string) => {
    if (codeProvided) throw new SirahDiscountError(message);
    return unchanged;
  };
  if (!grant || grant.amountMinor <= 0 || grant.amountMinor >= base.amountMinor)
    return fail("This discount code is not valid for this email, plan or payment method.");
  // Email-bound rows keep their binding (back-compat); unbound rows accept any email.
  if (grant.email && grant.email.trim().toLowerCase() !== email.trim().toLowerCase())
    return fail("This discount code is linked to a different email address.");
  // Single-use / capped: once the redemption limit is reached it cannot be shared.
  if (grant.redeemedCount >= grant.maxRedemptions)
    return fail("This discount code has already been used.");
  return { ...base, amountMinor: grant.amountMinor, totalMinor: grant.amountMinor * base.months,
    pricingVersion: `${base.pricingVersion}:personal-manual-v1`,
    discount: { grantId: grant.id, originalAmountMinor: base.amountMinor, amountMinor: grant.amountMinor, label: "Personal manual-payment discount" },
  };
}

/** 4-char uppercase alphanumeric suffix (no ambiguous characters). */
function randomSuffix() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(4);
  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}
/** Matches existing codes, e.g. SIRAH-PK-3000-AZ7Q (amount is whole PKR). */
export function generateDiscountCode(amountMinor: number) {
  return `SIRAH-PK-${Math.round(amountMinor / 100)}-${randomSuffix()}`;
}

/**
 * Admin-only: create one SirahManualDiscount row. Stores the code's hash (never
 * the plaintext), returns the plaintext once so the team can share it. An empty
 * email makes the code unbound (redeemable by any student up to maxRedemptions);
 * a provided email locks it to that person.
 */
export async function createManualDiscountCode(input: {
  code?: string;
  amountMinor: number;
  email?: string | null;
  maxRedemptions?: number;
  batchCode?: string;
}) {
  const base = priceFor("PK", "MONTHLY", "BANK_TRANSFER");
  if (
    !Number.isInteger(input.amountMinor) ||
    input.amountMinor <= 0 ||
    input.amountMinor >= base.amountMinor
  )
    throw new SirahDiscountError(
      `Discounted amount must be a positive value below the standard manual fee (${base.amountMinor} minor units).`,
    );
  let code: string;
  if (input.code?.trim()) {
    code = input.code.trim().toUpperCase();
  } else {
    // Auto-generate SIRAH-PK-<amount>-<RANDOM4>; regenerate on hash collision.
    code = "";
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = generateDiscountCode(input.amountMinor);
      const clash = await prisma.sirahManualDiscount.findUnique({
        where: { codeHash: discountCodeHash(candidate) },
        select: { id: true },
      });
      if (!clash) {
        code = candidate;
        break;
      }
    }
    if (!code)
      throw new SirahDiscountError("Could not generate a unique code. Please try again.");
  }
  const row = await prisma.sirahManualDiscount.create({
    data: {
      codeHash: discountCodeHash(code),
      // These codes are shared with students, not secret: keep the plaintext so
      // the admin list can show it. Validation still matches on codeHash only.
      codePlain: code,
      email: input.email?.trim().toLowerCase() || "",
      batchCode: input.batchCode?.trim() || SIRAH_BATCH,
      countryCode: "PK",
      plan: "MONTHLY",
      currency: "PKR",
      amountMinor: input.amountMinor,
      maxRedemptions:
        input.maxRedemptions && input.maxRedemptions > 0
          ? Math.floor(input.maxRedemptions)
          : 1,
      isActive: true,
    },
  });
  return { code, id: row.id, maxRedemptions: row.maxRedemptions, email: row.email };
}

export type ManualDiscountListRow = {
  id: string;
  code: string | null;
  amountMinor: number;
  currency: string;
  binding: string;
  redeemedCount: number;
  maxRedemptions: number;
  status: "Active" | "Used up" | "Deactivated";
  createdAt: string;
};

/** Admin list of discount codes for the current batch, newest first. */
export async function listManualDiscountCodes(): Promise<ManualDiscountListRow[]> {
  const rows = await prisma.sirahManualDiscount.findMany({
    where: { batchCode: SIRAH_BATCH, countryCode: "PK", plan: "MONTHLY" },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.codePlain || null,
    amountMinor: row.amountMinor,
    currency: row.currency,
    binding: row.email ? row.email : "Any student",
    redeemedCount: row.redeemedCount,
    maxRedemptions: row.maxRedemptions,
    status: !row.isActive
      ? "Deactivated"
      : row.redeemedCount >= row.maxRedemptions
        ? "Used up"
        : "Active",
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Admin: deactivate a code so it can no longer be redeemed. Idempotent. */
export async function deactivateManualDiscountCode(id: string) {
  const row = await prisma.sirahManualDiscount.findUnique({ where: { id }, select: { id: true } });
  if (!row) throw new SirahDiscountError("That discount code could not be found.");
  await prisma.sirahManualDiscount.update({ where: { id }, data: { isActive: false } });
}
