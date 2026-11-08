import { annualSirahSavings, formatSirahMoney } from "@/lib/sirah/catalog";
import styles from "./annual-price-summary.module.css";

/** Shared presentation only; checkout always charges the exact saved upfront amount. */
export function AnnualPriceSummary({
  country,
  currency,
  amountMinor,
}: {
  country: string;
  currency: string;
  amountMinor: number;
}) {
  const price = annualSirahSavings(country, amountMinor);
  const comparable = price.currency === currency;
  return (
    <div className={styles.summary} data-sirah-annual-price>
      <div className={styles.rate}>
        {comparable && price.savingMinor > 0 && (
          <s aria-label="Standard online monthly price">
            {formatSirahMoney(price.originalMonthlyMinor, currency)}
          </s>
        )}
        <strong className={styles.equivalent} data-monthly-equivalent>
          {formatSirahMoney(price.monthlyEquivalentMinor, currency)}
        </strong>
      </div>
      <span className={styles.label}>per month equivalent · paid annually</span>
      {comparable && price.savingMinor > 0 && (
        <div className={styles.savings}>
          <span className={styles.badge}>Save approximately {price.approximatePercent}%</span>
          <span className={styles.label}>Save {formatSirahMoney(price.savingMinor, currency)} total</span>
        </div>
      )}
      <div className={styles.totals}>
        {comparable && price.savingMinor > 0 && (
          <span className={styles.label}>
            12 online monthly payments: <s>{formatSirahMoney(price.standardMinor, currency)}</s>
          </span>
        )}
        <div className={styles.upfront}>
          <strong>{formatSirahMoney(amountMinor, currency)}</strong> upfront
        </div>
        <span className={styles.label}>One payment for all 12 months.</span>
      </div>
    </div>
  );
}
