"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import styles from "./admin-ledger.module.css";
import { DirectUpload } from "./uploads/direct-upload";
import { formatSirahMoney, minorToDecimal } from "@/lib/sirah/catalog";
import { AdminPaymentPlan, type PaymentPlan } from "./admin-payment-plan";

type Ledger = { paymentPlan: PaymentPlan | null; settlements: { id: string; currency: string; amountMinor: number }[]; currency: string; ledgerFeeMinor: number | null; ledgerFeeCurrency: string | null; agreement: { filename: string } | null; ledgerPayments: { id: string; periodId: string | null; amountMinor: number; currency: string; method: string; receivedAt: string; note: string | null }[] };
export function AdminLedger({ id, canEdit, onFeeSaved, onPlanSaved }: { id: string; canEdit: boolean; onFeeSaved?: (fee: { ledgerFeeMinor: number | null; ledgerFeeCurrency: string | null }) => void; onPlanSaved?: () => void }) {
  const [data, setData] = useState<Ledger | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkAmount, setLinkAmount] = useState("");
  const [link, setLink] = useState<{ url: string; amountMinor: number; currency: string; expiresAt: string } | null>(null);
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/sirah/ledger?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to load balance.");
    setData(result);
    return result as Ledger;
  }, [id]);
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form);
    setBusy(true); setError("");
    try {
      const response = await fetch(action === "agreement" ? "/api/admin/sirah/agreement" : "/api/admin/sirah/ledger", action === "agreement" ? { method: "POST", body: values } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, amount: values.get("amount"), method: values.get("method"), date: values.get("date"), note: values.get("note"), periodMonth: values.get("periodMonth") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save.");
      form.reset(); const updated = await load();
      if (action === "fee") onFeeSaved?.({ ledgerFeeMinor: updated.ledgerFeeMinor, ledgerFeeCurrency: updated.ledgerFeeCurrency });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save."); } finally { setBusy(false); }
  }
  async function generateLink() {
    setBusy(true); setError(""); setLink(null);
    try {
      const response = await fetch("/api/admin/sirah/settlement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, amount: linkAmount }) });
      const result = await response.json();
      if (!response.ok) { await load(); throw new Error(result.error || "Unable to create link."); }
      setLink(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create link."); } finally { setBusy(false); }
  }
  const currencyMismatch = !!data && ((data.ledgerFeeMinor !== null && data.ledgerFeeCurrency !== data.currency) || data.ledgerPayments.some((payment) => payment.currency !== data.currency));
  const received = data?.ledgerPayments.filter((payment) => payment.currency === data.currency).reduce((sum, payment) => sum + payment.amountMinor, 0) ?? 0;
  return <section className={styles.ledger}>
    <h4>Payments &amp; balance</h4>
    {error && <p role="alert">{error}</p>}
    {!data ? <p>Loading balance?</p> : <>
      <div className={styles.summary}>{!data.paymentPlan && <p>Course fee: {data.ledgerFeeMinor === null ? "Not set" : data.ledgerFeeCurrency ? formatSirahMoney(data.ledgerFeeMinor, data.ledgerFeeCurrency) : "Currency not recorded; set the fee again"}</p>}
      <p>Total received (ledger, {data.currency}): {formatSirahMoney(received, data.currency)}</p>
      {currencyMismatch && <p role="alert">The course fee or ledger entries have a different or unknown currency. Reconcile them before relying on the balance or generating a new link.</p>}
      {!data.paymentPlan && <p>Outstanding: {data.ledgerFeeMinor === null ? "Set the course fee first" : currencyMismatch ? "Unavailable: currencies differ" : formatSirahMoney(Math.max(0, data.ledgerFeeMinor - received), data.currency)}</p>}
      </div><p className={styles.hint}>Existing payment records are separate; enter previously received payments here once.</p>
      <AdminPaymentPlan id={id} currency={data.currency} plan={data.paymentPlan} unlinkedPayments={data.ledgerPayments.filter(payment => !payment.periodId)} canEdit={canEdit} reload={load} onSaved={onPlanSaved} />
      {canEdit && <>
        {!data.paymentPlan && <>
        <div className={styles.linkSection}><label>Link amount ({data.currency}; leave blank for the full balance) <input type="number" min="0" step="any" value={linkAmount} onChange={event => setLinkAmount(event.target.value)} /></label>{" "}
        <button type="button" disabled={busy || (!data.settlements.length && (currencyMismatch || data.ledgerFeeMinor === null || data.ledgerFeeMinor <= received))} onClick={() => void generateLink()}>Generate balance payment link</button>
        </div>{link && <p>Card link for {formatSirahMoney(link.amountMinor, link.currency)} (expires {new Date(link.expiresAt).toLocaleString()}): <a href={link.url} target="_blank" rel="noreferrer">Open payment link</a> <button type="button" onClick={() => void navigator.clipboard.writeText(link.url)}>Copy link</button></p>}
        <p>While a balance link is open, fee and manual payment changes are locked. Generate the link again to retrieve or reconcile it. An existing link keeps its original amount.</p>
        <form className={styles.feeForm} onSubmit={(event) => void submit(event, "fee")}><label>Course fee ({data.currency}) <input name="amount" type="number" min="0" step="any" defaultValue={data.ledgerFeeMinor === null || data.ledgerFeeCurrency !== data.currency ? "" : minorToDecimal(data.ledgerFeeMinor, data.currency)} required /></label> <button disabled={busy}>Save fee</button></form>
        </>}
        <form className={styles.paymentForm} onSubmit={(event) => void submit(event, "payment")}>
          <h5>Record received payment</h5>
          {data.paymentPlan && <label>Payment period<select name="periodMonth" defaultValue={data.paymentPlan.periods.filter(period => period.status !== "PAID").at(-1)?.periodMonth ?? ""} required><option value="" disabled>Choose period</option>{data.paymentPlan.periods.filter(period => period.status !== "PAID").map(period => <option key={period.periodMonth} value={period.periodMonth}>{period.periodMonth} — {period.status.toLowerCase()}</option>)}</select></label>}
          <label>Amount ({data.currency}) <input name="amount" type="number" min="0" step="any" required /></label>{" "}
          <label>Method <select name="method" required><option value="JAZZCASH">JazzCash</option><option value="BANK">Bank</option><option value="CASH">Cash</option><option value="STRIPE">Stripe</option><option value="OTHER">Other</option></select></label>{" "}
          <label>Date <input name="date" type="date" required /></label>{" "}
          <label>Note <input name="note" maxLength={1000} /></label>{" "}<button disabled={busy || (!!data.paymentPlan && !data.paymentPlan.periods.some(period => period.status !== "PAID"))}>Record payment</button>
        </form>
        {!data.agreement && <form className={styles.agreementForm} onSubmit={(event) => void submit(event, "agreement")}><h5>Signed agreement</h5><input type="hidden" name="id" value={id} /><DirectUpload purpose="agreement" scope={id} required /> <button disabled={busy}>Upload PDF</button></form>}
      </>}
      {data.agreement && <p><a href={`/api/admin/sirah/agreement?id=${encodeURIComponent(id)}`}>Download agreement: {data.agreement.filename}</a></p>}
      {data.ledgerPayments.length > 0 && <ul>{data.ledgerPayments.map((payment) => <li key={payment.id}>{payment.receivedAt.slice(0, 10)} ? {formatSirahMoney(payment.amountMinor, payment.currency)} ? {payment.method}{payment.note && ` ? ${payment.note}`}</li>)}</ul>}
    </>}
  </section>;
}
