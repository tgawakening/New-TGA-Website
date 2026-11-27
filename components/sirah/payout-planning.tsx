"use client";

import { useEffect, useState, type FormEvent } from "react";
import { currencyScale, decimalToMinor } from "@/lib/sirah/catalog";
import { addMoney, moneyGroups, type MoneyGroup } from "@/lib/sirah/course-revenue";
import { estimateMoney, formatEstimate, validRate, type CalculatorRow, type Rates } from "./course-revenue-calculation";
import { planningBalances, splitShare } from "./payout-planning-calculations";
import styles from "./payout-planning.module.css";

type Payout = { id: string; label: string; amountMinor: number; currency: string; note: string };
type Planning = { payouts: Payout[]; shares: Record<string, string> };
const KEY = "sirah-payout-planning-v1";
const empty: Planning = { payouts: [], shares: {} };
const validCurrency = (currency: string) => /^[A-Z]{3}$/.test(currency);
const money = (amount: number, currency: string) => `${currency} ${new Intl.NumberFormat("en-GB", { minimumFractionDigits: currencyScale(currency), maximumFractionDigits: currencyScale(currency) }).format(amount / 10 ** currencyScale(currency))}`;

function readPlanning(): Planning {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return empty;
    const data = saved as { payouts?: unknown; shares?: unknown };
    const payouts = Array.isArray(data.payouts) ? data.payouts.filter((p): p is Payout => p && typeof p === "object" && typeof p.id === "string" && typeof p.label === "string" && typeof p.currency === "string" && validCurrency(p.currency) && Number.isSafeInteger(p.amountMinor) && p.amountMinor > 0 && typeof p.note === "string") : [];
    const shares: Record<string, string> = {};
    if (data.shares && typeof data.shares === "object" && !Array.isArray(data.shares)) for (const [id, value] of Object.entries(data.shares)) if (typeof value === "string") shares[id] = value;
    return { payouts, shares };
  } catch { return empty; }
}

export function PayoutPlanning({ rows, received, currencies, target, rates, changeRate, periodLabel }: { rows: CalculatorRow[]; received: MoneyGroup[]; currencies: string[]; target: string; rates: Rates; changeRate: (currency: string, value: string) => void; periodLabel: string }) {
  const [data, setData] = useState<Planning>(empty);
  const [course, setCourse] = useState(rows[0]?.id || "");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(currencies[0] || "GBP");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [scratchAmount, setScratchAmount] = useState("");
  const [scratchPercent, setScratchPercent] = useState("");
  useEffect(() => {
    // Browser storage is available after hydration only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(readPlanning());
  }, []);
  function save(next: Planning) {
    setData(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); setStorageError(false); }
    catch { setStorageError(true); }
  }
  function addPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const code = currency.trim().toUpperCase();
    if (!label.trim() || !validCurrency(code)) { setError("Enter a label and a three-letter currency code."); return; }
    let minor: number;
    try { minor = decimalToMinor(amount.trim(), code); } catch { setError("Enter a valid amount for this currency."); return; }
    if (!minor) { setError("Enter an amount greater than zero."); return; }
    const next = [...data.payouts, { id: crypto.randomUUID(), label: label.trim(), amountMinor: minor, currency: code, note: note.trim() }];
    const total = next.filter(p => p.currency === code).reduce((sum, p) => sum + p.amountMinor, 0);
    if (!Number.isSafeInteger(total)) { setError("The total is too large."); return; }
    save({ ...data, payouts: next }); setLabel(""); setAmount(""); setNote("");
  }
  const selected = rows.find(row => row.id === course);
  const shareText = data.shares[course] ?? "";
  const share = shareText.trim() && Number.isFinite(Number(shareText)) && Number(shareText) >= 0 && Number(shareText) <= 100 ? Number(shareText) : null;
  const payoutMap = new Map<string, number>();
  for (const payout of data.payouts) addMoney(payoutMap, payout.currency, payout.amountMinor);
  const payoutTotals = moneyGroups(payoutMap);
  const balanceRows = planningBalances(received, payoutTotals);
  const balance = new Map(balanceRows.map(item => [item.currency, item.amountMinor]));
  const allCurrencies = [...new Set([...received.map(item => item.currency), ...payoutTotals.map(item => item.currency)])].sort();
  const combined = target ? estimateMoney(balanceRows, target, rates) : null;
  const missing = combined?.missing ?? [];
  const extraRateCurrencies = payoutTotals.map(item => item.currency).filter(code => code !== target && !currencies.includes(code));
  const rateCurrencies = [...new Set([...missing, ...extraRateCurrencies])];
  const scratchNumber = Number(scratchAmount), scratchRate = Number(scratchPercent);
  const scratchValid = scratchAmount.trim() !== "" && scratchPercent.trim() !== "" && Number.isFinite(scratchNumber) && Number.isFinite(scratchRate) && scratchRate >= 0 && scratchRate <= 100;
  return <section className={`ga-admin-workspace-card ${styles.planner}`} aria-labelledby="planning-title">
    <div className={styles.heading}><p className={styles.eyebrow}>Your planning space</p><h3 id="planning-title">Payouts &amp; planning</h3><p>Entries are for calculation only, saved in this browser. They are not saved to the real records or shared with other admins.</p><p>Using received amounts for <strong>{periodLabel}</strong>. Payouts below are all the entries saved in this browser.</p></div>
    {storageError && <p role="alert" className={styles.error}>Could not save in this browser. Your changes may be lost when you leave.</p>}
    <div className={styles.cards}>
      <div className={styles.card}><h4>Teacher or partner share</h4><p>Choose a course and the agreed share.</p><div className={styles.fields}>
        <label>Course<select value={course} onChange={event => setCourse(event.target.value)}>{rows.map(row => <option value={row.id} key={row.id}>{row.title}</option>)}</select></label>
        <label>Share %<input type="number" min="0" max="100" step="any" value={shareText} onChange={event => save({ ...data, shares: { ...data.shares, [course]: event.target.value } })} /></label>
      </div>{shareText && share === null && <p role="alert" className={styles.error}>Enter a share between 0 and 100.</p>}
      {selected && share !== null && <div className={styles.shareResults}>{selected.received.length ? selected.received.map(item => { const { share: teacher, remaining } = splitShare(item.amountMinor, share); return <p key={item.currency}><strong>{item.currency}</strong><span>Teacher / partner: {money(teacher, item.currency)}</span><span>TGA: {money(remaining, item.currency)}</span></p>; }) : <p>No received amount for this course in this period.</p>}</div>}</div>
      <div className={styles.card}><h4>Quick calculator</h4><p>Try any amount and percentage.</p><div className={styles.fields}><label>Amount<input type="number" step="any" value={scratchAmount} onChange={event => setScratchAmount(event.target.value)} /></label><label>Percentage<input type="number" min="0" max="100" step="any" value={scratchPercent} onChange={event => setScratchPercent(event.target.value)} /></label></div>{scratchValid && <p className={styles.result}>{formatEstimate(scratchNumber * scratchRate / 100)} share; {formatEstimate(scratchNumber * (100 - scratchRate) / 100)} remaining</p>}</div>
    </div>
    <div className={styles.card}><h4>Payouts and expenses</h4><p>Add what you have paid or plan to pay.</p><form className={styles.payoutForm} onSubmit={addPayout}>
      <label>Label<input value={label} maxLength={100} onChange={event => setLabel(event.target.value)} placeholder="Paid teacher" required /></label><label>Amount<input value={amount} onChange={event => setAmount(event.target.value)} type="number" min="0" step="any" required /></label><label>Currency<input value={currency} maxLength={3} onChange={event => setCurrency(event.target.value.toUpperCase())} placeholder="GBP" required /></label><label>Note (optional)<input value={note} maxLength={200} onChange={event => setNote(event.target.value)} /></label><button type="submit">Add entry</button>
    </form>{error && <p role="alert" className={styles.error}>{error}</p>}
    {data.payouts.length ? <ul className={styles.entries}>{data.payouts.map(payout => <li key={payout.id}><div><strong>{payout.label}</strong> - {money(payout.amountMinor, payout.currency)}{payout.note && <small>{payout.note}</small>}</div><button type="button" onClick={() => save({ ...data, payouts: data.payouts.filter(item => item.id !== payout.id) })} aria-label={`Remove ${payout.label}`}>Remove</button></li>)}</ul> : <p>No entries yet.</p>}
    <div className={styles.balances}>{allCurrencies.length ? allCurrencies.map(code => <div key={code}><strong>{code}</strong><span>Received: {money(received.find(item => item.currency === code)?.amountMinor ?? 0, code)}</span><span>Payouts: {money(payoutMap.get(code) ?? 0, code)}</span><span>Remaining: {money(balance.get(code) ?? 0, code)}</span></div>) : <p>No amounts to show yet.</p>}</div>
    {target && <div className={styles.combined}><h4>Optional estimate in {target}</h4><p>Uses the currency and exchange rates from the currency calculator above.</p>{combined?.included && <strong>Remaining: ~ {target} {formatEstimate(combined.total)}</strong>}{missing.length > 0 && <p>Enter rates for {missing.join(", ")} to include them in the estimate.</p>}{rateCurrencies.length > 0 && <div className={styles.fields}>{rateCurrencies.map(code => <label key={code}>1 {code} in {target}<input type="text" inputMode="decimal" value={rates[code] ?? ""} onChange={event => changeRate(code, event.target.value)} aria-invalid={!!rates[code] && validRate(rates[code]) === null} /></label>)}</div>}</div>}
    </div>
  </section>;
}
