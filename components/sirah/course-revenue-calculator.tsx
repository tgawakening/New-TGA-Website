"use client";

import { useEffect, useState } from "react";
import type { MoneyGroup } from "@/lib/sirah/course-revenue";
import { estimateMoney, formatEstimate, validRate, type CalculatorRow, type Rates } from "./course-revenue-calculation";
import styles from "./course-revenue.module.css";

const STORAGE_KEY = "sirah-course-revenue-manual-rates-v1";
type SavedRates = Record<string, Rates>;

function Estimate({ values, target, rates }: { values: MoneyGroup[]; target: string; rates: Rates }) {
  const estimate = estimateMoney(values, target, rates);
  return <div className={styles.estimate}>
    <span className={styles.estimateValue}>{estimate.included ? `~ ${target} ${formatEstimate(estimate.total)}` : "—"}</span>
    {estimate.missing.length > 0 && <small>Missing rate: {estimate.missing.join(", ")}</small>}
  </div>;
}

export function CourseRevenueCalculator({ currencies, rows, totals }: { currencies: string[]; rows: CalculatorRow[]; totals: { received: MoneyGroup[]; outstanding: MoneyGroup[] } }) {
  const [target, setTarget] = useState(currencies.includes("GBP") ? "GBP" : currencies[0] ?? "");
  const [saved, setSaved] = useState<SavedRates>({});
  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const clean: SavedRates = {};
        for (const [to, sources] of Object.entries(parsed)) {
          if (!/^[A-Z]{3}$/.test(to) || !sources || typeof sources !== "object" || Array.isArray(sources)) continue;
          clean[to] = {};
          for (const [from, value] of Object.entries(sources)) if (/^[A-Z]{3}$/.test(from) && typeof value === "string") clean[to][from] = value;
        }
        // Restore only locally saved, user-entered rates after hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSaved(clean);
      }
    } catch { /* Storage can be unavailable in private browsing. */ }
  }, []);
  const rates = saved[target] ?? {};
  const otherCurrencies = currencies.filter(currency => currency !== target);
  const usedRates = otherCurrencies.filter(currency => validRate(rates[currency]) !== null);

  function changeRate(currency: string, value: string) {
    const next = { ...saved, [target]: { ...rates, [currency]: value } };
    setSaved(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Calculator still works without storage. */ }
  }

  return <section className={`ga-admin-workspace-card ${styles.calculator}`} aria-labelledby="currency-calculator-heading">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>A helpful estimate</p><h3 id="currency-calculator-heading">See everything in one currency</h3><p>Enter your own exchange rates to compare amounts. The original amounts above stay unchanged.</p></div></div>
    {!currencies.length ? <p className={styles.muted}>No currencies are available yet.</p> : <>
      <div className={styles.calculatorControls}>
        <label className={styles.field}>Show estimates in<select value={target} onChange={event => setTarget(event.target.value)}>{currencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></label>
        {otherCurrencies.map(currency => <label className={styles.field} key={currency}>1 {currency} = <span className={styles.rateInput}><input type="text" inputMode="decimal" placeholder="Enter rate" value={rates[currency] ?? ""} onChange={event => changeRate(currency, event.target.value)} aria-invalid={!!rates[currency] && validRate(rates[currency]) === null} /><span>{target}</span></span>{rates[currency] && validRate(rates[currency]) === null ? <small>Enter a number greater than zero.</small> : <small>Enter a manual rate</small>}</label>)}
      </div>
      <div className={styles.estimateIntro}><div><h4>Estimated in {target} from the rates you entered</h4><p>Manual rates make these figures approximate. Amounts without a valid rate are left out.</p></div><p className={styles.rateList}>{usedRates.length ? usedRates.map(currency => `1 ${currency} = ${rates[currency]} ${target}`).join(" · ") : "No exchange rates entered"}</p></div>
      <div className={styles.tableWrap}><table className={`${styles.table} ${styles.estimateTable}`}><thead><tr><th scope="col">Program</th><th scope="col">Received</th><th scope="col">Outstanding now</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.id}><th scope="row">{row.title}</th><td data-label="Received"><Estimate values={row.received} target={target} rates={rates} /></td><td data-label="Outstanding now"><Estimate values={row.outstanding} target={target} rates={rates} /></td></tr>)}
        <tr className={styles.estimateTotal}><th scope="row">Total across programs</th><td data-label="Received"><Estimate values={totals.received} target={target} rates={rates} /></td><td data-label="Outstanding now"><Estimate values={totals.outstanding} target={target} rates={rates} /></td></tr>
      </tbody></table></div>
    </>}
  </section>;
}
