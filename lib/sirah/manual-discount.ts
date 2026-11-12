import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { catalogue, currencyScale, formatSirahMoney, priceFor, SIRAH_BATCH, type SirahMethod, type SirahPlan } from "./catalog";
export class SirahDiscountError extends Error {}
export const discountCodeHash = (code: string) => createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
export type DiscountPaymentScope = "MANUAL" | "CARD";
/** `scope` is present only on card snapshots, so manual snapshots stay byte-identical. */
export type ManualDiscountSnapshot = { grantId: string; originalAmountMinor: number; amountMinor: number; label: string; scope?: "CARD" };
export const CARD_DISCOUNT_LABEL = "Personal discount";
/**
 * Which kind of code may price this checkout. MANUAL is the original rule
 * (Pakistan monthly bank transfer / JazzCash in PKR), unchanged. CARD is a
 * Stripe checkout in any catalogue market. PayPal and "no method yet" take none.
 */
export function discountScopeFor(country: string, plan: SirahPlan, method: SirahMethod | null, currency: string): DiscountPaymentScope | null {
  if (country === "PK" && plan === "MONTHLY" && (method === "BANK_TRANSFER" || method === "JAZZCASH") && currency === "PKR") return "MANUAL";
  if (method === "STRIPE") return "CARD";
  return null;
}
export function isCardDiscount(discount: unknown): discount is ManualDiscountSnapshot & { scope: "CARD" } {
  const value = discount as Partial<ManualDiscountSnapshot> | null;
  return !!value?.grantId && value.scope === "CARD";
}
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
  const scope = discountScopeFor(country, plan, method, base.currency);
  const applicable = scope !== null;
  const unchanged = { ...base, discount: null as ManualDiscountSnapshot | null };
  if (!codeProvided && (!snapshot?.grantId || !applicable)) return unchanged;
  // Look up by code (or saved grant) + context. Email is NOT part of the lookup:
  // a code may be unbound (email === "") and redeemable by any registration.
  // A code prices only its own scope: a manual code never prices a card
  // checkout and a card code never prices a manual one. Manual codes are scoped
  // by the student's country (always PK); card codes by catalogue market
  // (e.g. IN, EURO, OTHER), which for a listed country is the country itself.
  const grant = applicable ? await prisma.sirahManualDiscount.findFirst({ where: {
    ...(codeProvided ? { codeHash: discountCodeHash(code!) } : { id: snapshot!.grantId }),
    batchCode: SIRAH_BATCH, countryCode: scope === "CARD" ? base.market : country, plan, currency: base.currency, isActive: true,
    paymentScope: scope,
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
  if (scope === "CARD")
    // Annual is one charge; monthly is that reduced amount on every invoice.
    return { ...base, amountMinor: grant.amountMinor, totalMinor: plan === "ANNUAL" ? grant.amountMinor : grant.amountMinor * base.months,
      pricingVersion: `${base.pricingVersion}:personal-card-v1`,
      discount: { grantId: grant.id, originalAmountMinor: base.amountMinor, amountMinor: grant.amountMinor, label: CARD_DISCOUNT_LABEL, scope: "CARD" as const },
    };
  return { ...base, amountMinor: grant.amountMinor, totalMinor: grant.amountMinor * base.months,
    pricingVersion: `${base.pricingVersion}:personal-manual-v1`,
    discount: { grantId: grant.id, originalAmountMinor: base.amountMinor, amountMinor: grant.amountMinor, label: "Personal manual-payment discount" },
  };
}

/**
 * Card checkout-start re-check. Payment by card completes without staff review,
 * so before opening a Stripe session confirm the saved code is still active and
 * under its redemption limit. This narrows (cannot fully close) the window in
 * which two students holding one single-use code both reach checkout; the
 * redemption itself is still counted once, on first verified payment.
 */
export async function assertCardDiscountRedeemable(discount: unknown) {
  if (!isCardDiscount(discount)) return;
  const grant = await prisma.sirahManualDiscount.findUnique({
    where: { id: discount.grantId },
    select: { isActive: true, redeemedCount: true, maxRedemptions: true, paymentScope: true },
  });
  if (!grant || !grant.isActive || grant.paymentScope !== "CARD" || grant.redeemedCount >= grant.maxRedemptions)
    throw new SirahDiscountError(
      "This discount code is no longer available. Select your payment method again to continue at the standard price.",
    );
}

/** 4-char uppercase alphanumeric suffix (no ambiguous characters). */
function randomSuffix() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(4);
  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}
/** Matches existing codes, e.g. SIRAH-PK-3000-AZ7Q (amount is whole PKR).
 * Card codes name their market and whole currency units, e.g. SIRAH-IN-1000-AZ7Q. */
export function generateDiscountCode(amountMinor: number, market = "PK", currency = "PKR") {
  if (market === "PK" && currency === "PKR") return `SIRAH-PK-${Math.round(amountMinor / 100)}-${randomSuffix()}`;
  return `SIRAH-${market}-${Math.round(amountMinor / 10 ** currencyScale(currency))}-${randomSuffix()}`;
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
  /** Defaults keep the original behaviour: a PK monthly manual (bank/JazzCash) code. */
  paymentScope?: DiscountPaymentScope;
  market?: string;
  plan?: SirahPlan;
}) {
  const scope = input.paymentScope ?? "MANUAL";
  const market = (input.market ?? "PK").toUpperCase();
  const plan = input.plan ?? "MONTHLY";
  if (scope === "MANUAL" && (market !== "PK" || plan !== "MONTHLY"))
    throw new SirahDiscountError("Bank transfer / JazzCash codes are available only for Pakistan monthly payments.");
  if (!catalogue.some(([code]) => code === market))
    throw new SirahDiscountError("Choose a market from the price list.");
  // Checked against that market's own catalogue price for the chosen route.
  const base = priceFor(market, plan, scope === "MANUAL" ? "BANK_TRANSFER" : "STRIPE");
  if (
    !Number.isInteger(input.amountMinor) ||
    input.amountMinor <= 0 ||
    input.amountMinor >= base.amountMinor
  )
    throw new SirahDiscountError(
      scope === "MANUAL"
        ? `Discounted amount must be a positive value below the standard manual fee (${base.amountMinor} minor units).`
        : `Discounted amount must be a positive value below the standard card price (${formatSirahMoney(base.amountMinor, base.currency)}).`,
    );
  let code: string;
  if (input.code?.trim()) {
    code = input.code.trim().toUpperCase();
  } else {
    // Auto-generate SIRAH-PK-<amount>-<RANDOM4>; regenerate on hash collision.
    code = "";
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = generateDiscountCode(input.amountMinor, base.market, base.currency);
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
      countryCode: base.market,
      plan,
      currency: base.currency,
      paymentScope: scope,
      amountMinor: input.amountMinor,
      maxRedemptions:
        input.maxRedemptions && input.maxRedemptions > 0
          ? Math.floor(input.maxRedemptions)
          : 1,
      isActive: true,
    },
  });
  return { code, id: row.id, maxRedemptions: row.maxRedemptions, email: row.email,
    market: row.countryCode, plan: row.plan, currency: row.currency, paymentScope: scope, amountMinor: row.amountMinor };
}

export type ManualDiscountListRow = {
  id: string;
  code: string | null;
  amountMinor: number;
  currency: string;
  market: string;
  plan: string;
  paymentScope: DiscountPaymentScope;
  binding: string;
  redeemedCount: number;
  maxRedemptions: number;
  status: "Active" | "Used up" | "Deactivated";
  createdAt: string;
};

/** Admin list of discount codes for the current batch, newest first. */
export async function listManualDiscountCodes(): Promise<ManualDiscountListRow[]> {
  const rows = await prisma.sirahManualDiscount.findMany({
    where: { batchCode: SIRAH_BATCH },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.codePlain || null,
    amountMinor: row.amountMinor,
    currency: row.currency,
    market: row.countryCode,
    plan: row.plan,
    paymentScope: row.paymentScope === "CARD" ? "CARD" as const : "MANUAL" as const,
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
