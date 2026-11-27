"use client";
import { useState, type FormEvent } from "react";
import { formatSirahMoney, minorToDecimal } from "@/lib/sirah/catalog";
import styles from "./admin-ledger.module.css";

export type PaymentPlan = { billingDay: number; firstDueAt: string; monthlyMinor: number; arrearsPartMinor: number; openingArrearsMinor: number; remainingArrearsMinor: number; outstandingMinor: number; changeAt: string | null; nextMonthlyMinor: number | null; nextArrearsMinor: number | null; periods: { id: string | null; periodMonth: string; dueAt: string; amountMinor: number; arrearsPartMinor: number; paidMinor: number; status: string }[] };

export function AdminPaymentPlan({ id, currency, plan, unlinkedPayments, canEdit, reload, onSaved }: { id: string; currency: string; plan: PaymentPlan | null; unlinkedPayments: { id: string; amountMinor: number; currency: string; method: string; receivedAt: string }[]; canEdit: boolean; reload: () => Promise<unknown>; onSaved?: () => void }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const current = plan?.periods.at(-1);
  const value = (n: number | null | undefined) => n == null ? "" : minorToDecimal(n, currency);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/sirah/ledger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "plan", ...Object.fromEntries(form.entries()) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to save plan. Please try again.");
      await reload(); onSaved?.(); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save plan."); } finally { setBusy(false); }
  }
  return <div className={styles.plan}>
    <h5>Monthly payment plan</h5>
    {plan ? <>
      {current ? <div className={styles.summary}>
        <p>Current period: {current.periodMonth}<br />Due {current.dueAt.slice(0, 10)}</p>
        <p>Amount due: {formatSirahMoney(current.amountMinor, currency)}</p>
        <p>Paid this period: {formatSirahMoney(current.paidMinor, currency)}</p>
        <p>Status: {current.status === "PAID" ? "Paid" : current.status === "OVERDUE" ? "Overdue" : "Due"}</p>
        <p>Remaining opening arrears: {formatSirahMoney(plan.remainingArrearsMinor, currency)}</p>
        <p>Outstanding balance: {formatSirahMoney(plan.outstandingMinor, currency)}</p>
      </div> : <p>The plan begins on {plan.firstDueAt.slice(0, 10)}. Outstanding balance: {formatSirahMoney(plan.outstandingMinor, currency)}.</p>}
      <p>Existing payments remain in total received. Partial period payments cover the regular fee first, then arrears. Each part of the opening arrears is scheduled only once; once fully scheduled, later periods contain the regular fee only. Outstanding includes opening arrears and unpaid regular charges for elapsed/current periods.</p>
      {unlinkedPayments.length > 0 && <div role="alert"><p>{unlinkedPayments.length} {unlinkedPayments.length === 1 ? "payment needs" : "payments need"} manual reconciliation. These payments are included in total received but are not applied to any period.</p><ul>{unlinkedPayments.map(payment => <li key={payment.id}>{payment.receivedAt.slice(0, 10)} · {formatSirahMoney(payment.amountMinor, payment.currency)} · {payment.method}</li>)}</ul></div>}
      <ul>{plan.periods.map(period => <li key={period.periodMonth}>{period.periodMonth}: {formatSirahMoney(period.paidMinor, currency)} / {formatSirahMoney(period.amountMinor, currency)} — {period.status.toLowerCase()}</li>)}</ul>
    </> : <p>No monthly plan. This registration uses the one-off course fee.</p>}
    {canEdit && <button type="button" onClick={() => setOpen(!open)}>{open ? "Close plan form" : plan ? "Edit plan" : "Set monthly plan"}</button>}
    {open && <form className={styles.paymentForm} onSubmit={event => void save(event)}>
      <h5>{plan ? "Edit future plan terms" : "Set monthly plan"}</h5>
      <p className={styles.planHint}>Changes apply from the next period; existing period amounts stay unchanged. Arrears are the balance already owed at plan start.</p>
      <p className={styles.planHint}>Unassigned ledger payments are linked to the earliest current or past open periods in payment-date order when they fit. Payments that do not fit are left unlinked for manual reconciliation.</p>
      <label>Monthly amount ({currency})<input name="monthly" type="number" min="0" step="any" required defaultValue={value(plan?.monthlyMinor)} /></label>
      <label>Arrears portion per month<input name="arrearsPart" type="number" min="0" step="any" required defaultValue={value(plan?.arrearsPartMinor) || "0"} /></label>
      <label>Billing day (1–31)<input name="billingDay" type="number" min="1" max="31" required defaultValue={plan?.billingDay ?? 1} /></label>
      {!plan && <><label>First due date<input name="firstDue" type="date" required /></label><label>Opening arrears ({currency})<input name="openingArrears" type="number" min="0" step="any" required defaultValue="0" /></label></>}
      <label>Optional change date<input name="changeAt" type="date" defaultValue={plan?.changeAt?.slice(0, 10) ?? ""} /></label>
      <label>Second monthly amount<input name="nextMonthly" type="number" min="0" step="any" defaultValue={value(plan?.nextMonthlyMinor)} /></label>
      <label>Second arrears portion<input name="nextArrears" type="number" min="0" step="any" defaultValue={value(plan?.nextArrearsMinor) || "0"} /></label>
      {error && <p role="alert">Could not save the monthly plan: {error}</p>}<button disabled={busy}>Save plan</button>
    </form>}
  </div>;
}
