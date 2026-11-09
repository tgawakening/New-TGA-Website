import type { SirahTerms } from "./config";
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
