"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { countries } from "countries-list";
import { priceFor } from "@/lib/sirah/catalog";
import { pakistanCalendarDate } from "@/lib/sirah/cohort-dates";
import { DirectUpload } from "./uploads/direct-upload";
import styles from "./admin-add-registration.module.css";

type Existing = { id: string; reference: string; archived: boolean; excluded: boolean };
const countryOptions = Object.entries(countries).sort((a, b) => a[1].name.localeCompare(b[1].name));
export function AdminAddRegistration({ onClose, onCreated, onExisting }: { onClose: () => void; onCreated: (result: { id: string; reference: string; newAccount: boolean }) => void; onExisting: (record: Existing) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [scope] = useState(() => crypto.randomUUID());
  const [cohorts, setCohorts] = useState<string[]>([]);
  const [country, setCountry] = useState("PK");
  const [plan, setPlan] = useState<"MONTHLY" | "ANNUAL">("ANNUAL");
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<Existing | null>(null);
  const [busy, setBusy] = useState(false);
  const currency = priceFor(country, plan, null).currency;
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    fetch("/api/admin/sirah/paid-registration", { signal: controller.signal, cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load cohorts.");
      setCohorts(result.cohorts);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load cohorts."); });
    return () => controller.abort();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setExisting(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/sirah/paid-registration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: form.get("fullName"), email: form.get("email"), phone: form.get("phone"), country, cohort: form.get("cohort"), plan, amount: form.get("amount"), method: form.get("method"), paymentDate: form.get("paymentDate"), note: form.get("note"), scope, ...(form.get("uploadToken") ? { receiptToken: form.get("uploadToken") } : {}) }) });
      const result = await response.json();
      if (!response.ok) { if (result.existing) setExisting(result.existing); throw new Error(result.error || "Could not add this registration."); }
      onCreated(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add this registration."); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="ga-admin-donation-dialog" aria-labelledby="add-registration-title" onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }}>
    <section className={`ga-admin-modal ${styles.modal}`}>
      <div className="ga-admin-modal-head"><div><p className="ga-admin-kicker">Students</p><h3 id="add-registration-title">Add a paid registration</h3></div><button type="button" className="ga-admin-notification-close" disabled={busy} onClick={() => dialog.current?.close()}>Close</button></div>
      <p>Record a payment already received. The course fee and received payment will both use the amount entered below.</p>
      <p>For a new account, the student can use Forgot password to set a password.</p>
      <form className={styles.form} onSubmit={event => void submit(event)}>
        <div className={styles.grid}>
          <label>Full name<input name="fullName" required minLength={2} maxLength={120} autoComplete="name" /></label>
          <label>Email<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
          <label>Country<select name="country" value={country} onChange={event => setCountry(event.target.value)}>{countryOptions.map(([code, value]) => <option key={code} value={code}>{value.name}</option>)}</select></label>
          <label>Phone<input name="phone" required minLength={5} maxLength={40} type="tel" autoComplete="tel" placeholder="Include country code if applicable" /></label>
          <label>Course<input value="Sirah | Beyond Chronology" readOnly /></label>
          <label>Cohort<select name="cohort" required defaultValue=""><option value="" disabled>Select cohort</option>{cohorts.map(cohort => <option key={cohort} value={cohort}>{cohort}</option>)}</select></label>
          <label>Payment plan<select name="plan" value={plan} onChange={event => setPlan(event.target.value as "MONTHLY" | "ANNUAL")}><option value="MONTHLY">Monthly</option><option value="ANNUAL">Full course</option></select></label>
          <label>Course fee / amount received ({currency})<input name="amount" type="number" min="0.001" step="any" required /></label>
          <label>Payment method<select name="method" required defaultValue=""><option value="" disabled>Select method</option><option value="BANK_TRANSFER">Bank transfer</option><option value="JAZZCASH">JazzCash</option><option value="EASYPAISA">easypaisa</option><option value="STRIPE">Stripe</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select></label>
          <label>Payment date<input name="paymentDate" type="date" required max={pakistanCalendarDate(new Date())} /></label>
        </div>
        <label>Note (optional)<textarea name="note" maxLength={1000} rows={3} /></label>
        <div><strong>Receipt (optional)</strong><DirectUpload purpose="admin-registration" scope={scope} /></div>
        {error && <p className="ga-admin-error-banner" role="alert">{error}</p>}
        {existing && <button type="button" className="ga-admin-outline-btn" onClick={() => onExisting(existing)}>Open existing registration</button>}
        <div className={styles.actions}><button type="button" className="ga-admin-outline-btn" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button><button className="ga-admin-primary-btn" disabled={busy || !cohorts.length}>{busy ? "Adding..." : "Add paid registration"}</button></div>
      </form>
    </section>
  </dialog>;
}
