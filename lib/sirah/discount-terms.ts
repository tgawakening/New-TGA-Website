import type { SirahTerms } from "./config";
import { currencyScale } from "./catalog";
import type { ManualDiscountSnapshot } from "./manual-discount";

/** Owner-approved personal price variation; other contractual protections stay intact. */
export function withManualDiscountTerms(terms: SirahTerms | null, discount: ManualDiscountSnapshot | null) {
  if (!terms || !discount) return terms;
  const formatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  const previous = formatter.format(discount.originalAmountMinor / 100).replace(/\./g, "\\.").replace(/,/g, ",?");
  const pattern = new RegExp(`PKR\\s*${previous}(?:\\.00)?`, "gi");
  const selectedFee = `PKR ${formatter.format(discount.amountMinor / 100)}`;
  return { ...terms,
    version: `${terms.version}:manual-${discount.amountMinor}-v1`,
    commitment: `${terms.commitment.replace(pattern, selectedFee)} Your personal discount applies to this registration’s monthly manual payments.`,
    tax: terms.tax.replace(pattern, selectedFee),
  };
}

/**
 * Terms for any personal-discount order. Manual snapshots go through
 * withManualDiscountTerms unchanged (same wording and version suffix as before);
 * card snapshots rewrite "<CURRENCY> <standard amount>" in the order's own
 * currency and precision, and get a distinct ":card-<amount>-v1" version.
 */
export function withDiscountTerms(terms: SirahTerms | null, discount: unknown, currency: string) {
  const snapshot = discount as ManualDiscountSnapshot | null;
  if (!terms || !snapshot?.grantId) return terms;
  if (snapshot.scope !== "CARD") return withManualDiscountTerms(terms, snapshot);
  const code = currency.toUpperCase();
  const scale = currencyScale(code);
  const formatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: scale });
  const units = (minor: number) => minor / 10 ** scale;
  const previous = formatter.format(units(snapshot.originalAmountMinor)).replace(/\./g, "\\.").replace(/,/g, ",?");
  const pattern = new RegExp(`${code}\\s*${previous}(?:\\.0+)?(?![0-9])`, "gi");
  const selectedFee = `${code} ${formatter.format(units(snapshot.amountMinor))}`;
  return { ...terms,
    version: `${terms.version}:card-${snapshot.amountMinor}-v1`,
    commitment: `${terms.commitment.replace(pattern, selectedFee)} Your personal discount applies to this registration’s card payments.`,
    tax: terms.tax.replace(pattern, selectedFee),
  };
}
