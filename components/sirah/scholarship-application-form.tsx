"use client";
import { useState, type FormEvent } from "react";
import { countries } from "countries-list";
import { scholarshipCurrencies } from "@/lib/sirah/scholarship-application";

export function ScholarshipApplicationForm({ admin = false, onSaved }: { admin?: boolean; onSaved?: () => void }) {
  const [type, setType] = useState("FULL");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(admin ? "/api/admin/sirah/scholarship-applications" : "/api/sirah/scholarship-applications", { method: "POST", body: new FormData(form) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Unable to submit the application.");
      setMessage(admin ? `Application added. Confirmation email: ${result.emailState}.` : "Your application was received. Our team will review it and contact you.");
      form.reset(); setType("FULL"); onSaved?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit."); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="scholarship-form">
    <label>Full name<input name="fullName" required maxLength={120} /></label>
    <label>Email<input name="email" type="email" required maxLength={254} /></label>
    <label>Phone, including international code<input name="phone" type="tel" placeholder="+44..." required maxLength={32} /></label>
    <label>Country<select name="countryCode" required defaultValue=""><option value="" disabled>Select country</option>{Object.entries(countries).sort((a,b) => a[1].name.localeCompare(b[1].name)).map(([code, item]) => <option key={code} value={code}>{item.name}</option>)}</select></label>
    <p>Course / cohort: Sirah | Beyond Chronology, current cohort</p>
    <label>Requested arrangement<select name="arrangementType" value={type} onChange={event => setType(event.target.value)}><option value="FULL">Full scholarship</option><option value="PARTIAL">Partial amount I can pay</option><option value="PLAN">Payment plan request</option></select></label>
    <label>Currency<select name="currency" defaultValue="GBP">{scholarshipCurrencies.map(currency => <option key={currency}>{currency}</option>)}</select></label>
    {type !== "FULL" && <label>{type === "PARTIAL" ? "Total amount you can pay" : "Monthly amount you can pay (optional)"}<input name="requestedAmount" type="number" min="0" step="any" required={type === "PARTIAL"} /></label>}
    <label>Brief reason<textarea name="reason" minLength={10} maxLength={3000} required /></label>
    <label>Supporting document (optional PDF, up to 4 MB)<input name="document" type="file" accept="application/pdf,.pdf" /></label>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <button disabled={busy}>{busy ? "Submitting..." : admin ? "Add application" : "Submit application"}</button>
  </form>;
}
