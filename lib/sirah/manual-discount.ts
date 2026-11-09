import "server-only";
import { createHash } from "node:crypto";
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
  const grant = applicable ? await prisma.sirahManualDiscount.findFirst({ where: {
    ...(codeProvided ? { codeHash: discountCodeHash(code!) } : { id: snapshot!.grantId }),
    email: email.trim().toLowerCase(), batchCode: SIRAH_BATCH, countryCode: country, plan, currency: base.currency, isActive: true,
  } }) : null;
  if (!grant || grant.amountMinor <= 0 || grant.amountMinor >= base.amountMinor) {
    if (codeProvided) throw new SirahDiscountError("This discount code is not valid for this email, plan or payment method.");
    return unchanged;
  }
  return { ...base, amountMinor: grant.amountMinor, totalMinor: grant.amountMinor * base.months,
    pricingVersion: `${base.pricingVersion}:personal-manual-v1`,
    discount: { grantId: grant.id, originalAmountMinor: base.amountMinor, amountMinor: grant.amountMinor, label: "Personal manual-payment discount" },
  };
}
