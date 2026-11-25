"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatSirahMoney, minorToDecimal } from "@/lib/sirah/catalog";

type Ledger = { currency: string; ledgerFeeMinor: number | null; agreement: { filename: string } | null; ledgerPayments: { id: string; amountMinor: number; currency: string; method: string; receivedAt: string; note: string | null }[] };
export function AdminLedger({ id, canEdit }: { id: string; canEdit: boolean }) {
  const [data, setData] = useState<Ledger | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/sirah/ledger?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to load balance.");
    setData(result);
  }, [id]);
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form);
    setBusy(true); setError("");
    try {
      const response = await fetch(action === "agreement" ? "/api/admin/sirah/agreement" : "/api/admin/sirah/ledger", action === "agreement" ? { method: "POST", body: values } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, amount: values.get("amount"), method: values.get("method"), date: values.get("date"), note: values.get("note") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save.");
      form.reset(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save."); } finally { setBusy(false); }
  }
  const received = data?.ledgerPayments.reduce((sum, payment) => sum + payment.amountMinor, 0) ?? 0;
  return <section style={{ marginTop: "1.5rem" }}>
    <h4>Payments &amp; balance</h4>
    {error && <p role="alert">{error}</p>}
    {!data ? <p>Loading balance?</p> : <>
      <p>Course fee: {data.ledgerFeeMinor === null ? "Not set" : formatSirahMoney(data.ledgerFeeMinor, data.currency)}</p>
      <p>Total received (manual ledger): {formatSirahMoney(received, data.currency)}</p>
      <p>Outstanding: {data.ledgerFeeMinor === null ? "Set the course fee first" : formatSirahMoney(Math.max(0, data.ledgerFeeMinor - received), data.currency)}</p>
      <p>Existing payment records are separate; enter previously received payments here once.</p>
      {canEdit && <>
        <form onSubmit={(event) => void submit(event, "fee")}><label>Course fee ({data.currency}) <input name="amount" type="number" min="0" step="any" defaultValue={data.ledgerFeeMinor === null ? "" : minorToDecimal(data.ledgerFeeMinor, data.currency)} required /></label> <button disabled={busy}>Save fee</button></form>
        <form onSubmit={(event) => void submit(event, "payment")}>
          <h5>Record received payment</h5>
          <label>Amount ({data.currency}) <input name="amount" type="number" min="0" step="any" required /></label>{" "}
          <label>Method <select name="method" required><option value="JAZZCASH">JazzCash</option><option value="BANK">Bank</option><option value="CASH">Cash</option><option value="STRIPE">Stripe</option><option value="OTHER">Other</option></select></label>{" "}
          <label>Date <input name="date" type="date" required /></label>{" "}
          <label>Note <input name="note" maxLength={1000} /></label>{" "}<button disabled={busy}>Record payment</button>
        </form>
        {!data.agreement && <form onSubmit={(event) => void submit(event, "agreement")}><h5>Signed agreement</h5><input type="hidden" name="id" value={id} /><input type="file" name="file" accept="application/pdf,.pdf" required /> <button disabled={busy}>Upload PDF</button></form>}
      </>}
      {data.agreement && <p><a href={`/api/admin/sirah/agreement?id=${encodeURIComponent(id)}`}>Download agreement: {data.agreement.filename}</a></p>}
      {data.ledgerPayments.length > 0 && <ul>{data.ledgerPayments.map((payment) => <li key={payment.id}>{payment.receivedAt.slice(0, 10)} ? {formatSirahMoney(payment.amountMinor, payment.currency)} ? {payment.method}{payment.note && ` ? ${payment.note}`}</li>)}</ul>}
    </>}
  </section>;
}
