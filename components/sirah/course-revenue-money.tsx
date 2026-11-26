import { currencyScale } from "@/lib/sirah/catalog";
import type { MoneyGroup } from "@/lib/sirah/course-revenue";
import styles from "./course-revenue.module.css";

export function MoneyRows({ values }: { values: MoneyGroup[] }) {
  const nonzero = values.filter(value => value.amountMinor !== 0);
  if (!nonzero.length) return <span className={styles.empty}>—</span>;
  return <div className={styles.amounts}>{nonzero.map(value => <div className={styles.moneyRow} key={value.currency}>
    <span className={styles.currency}>{value.currency}</span>
    <span className={styles.moneyValue}>{new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: Math.max(2, currencyScale(value.currency)) }).format(value.amountMinor / 10 ** currencyScale(value.currency))}</span>
  </div>)}</div>;
}
