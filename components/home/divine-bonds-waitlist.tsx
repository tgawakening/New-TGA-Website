"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MissionCountryPicker } from "@/components/support/mission-country-picker";
import "@/components/support/mission-support.css";
import "./divine-bonds-waitlist.css";

export function DivineBondsWaitlist({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [countryCode, setCountryCode] = useState("GB");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    dialog.current?.querySelector<HTMLInputElement>('[name="name"]')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const data = new FormData(event.currentTarget);
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/divine-bonds/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), email: data.get("email"), phone: data.get("phone"), countryCode, interest: data.get("interest"), reason: data.get("reason"), consent: data.get("consent") === "on", website: data.get("website") }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Please try again.");
      setReference(result.reference || "Recorded");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again shortly."); }
    finally { setLoading(false); }
  }

  return <dialog ref={dialog} className="ga-waitlist" aria-labelledby="divine-waitlist-title" onClose={onClose}>
    <button type="button" className="ga-waitlist-close" aria-label="Close waitlist" onClick={() => dialog.current?.close()}>×</button>
    <p className="ga-waitlist-eyebrow">Coming Soon · Marriage & Nikah</p>
    <h2 id="divine-waitlist-title">Join the Divine Bonds waitlist</h2>
    {reference ? <div role="status"><p>JazakAllahu khair. Your interest has been recorded. TGA will contact you about Divine Bonds.</p><p className="ga-waitlist-note">Reference: {reference}</p><button className="ga-waitlist-submit" type="button" onClick={() => dialog.current?.close()}>Done</button></div> : <>
      <p>Tell us what you’re interested in. This is an expression of interest, not a programme registration.</p>
      <form onSubmit={submit}>
        <div className="ga-waitlist-row"><label>Your name<input autoFocus name="name" autoComplete="name" minLength={2} maxLength={120} required /></label><label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label></div>
        <div className="ga-waitlist-row"><div className="ga-waitlist-country"><label htmlFor="mission-country-trigger">Country & phone code</label><MissionCountryPicker value={countryCode} onChange={setCountryCode} /></div><label>Phone / WhatsApp<input name="phone" type="tel" autoComplete="tel-national" inputMode="tel" pattern="[0-9 ()-]{6,20}" minLength={6} maxLength={20} placeholder="Without country code" required /></label></div>
        <label>What interests you most?<select name="interest" required defaultValue=""><option value="" disabled>Choose your interest</option>{["Finding a life partner", "Marriage preparation", "Family support", "Learning more"].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>What would you like Divine Bonds to help you with?<textarea name="reason" minLength={10} maxLength={1500} rows={3} required placeholder="Share your interest or what you hope to learn. Please avoid sensitive personal information." /></label>
        <label className="ga-waitlist-consent"><input name="consent" type="checkbox" required />I agree that TGA may contact me about this enquiry and Divine Bonds updates.</label>
        <div className="ms-sr-only" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
        {error && <p className="ga-waitlist-error" role="alert">{error}</p>}
        <button type="submit" className="ga-waitlist-submit" disabled={loading}>{loading ? "Submitting…" : "Join waitlist"}</button>
      </form>
    </>}
  </dialog>;
}
