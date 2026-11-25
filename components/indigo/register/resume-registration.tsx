"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { getPendingRegistrationForResume } from "@/services/payment.service";
import { paymentPlanTypeLabels } from "@/lib/course-payment";
import { formatSirahMoney } from "@/lib/sirah/catalog";
import { OrderSummary } from "./order-summary";
import styles from "./register-form.module.css";

type SavedRegistration = Awaited<ReturnType<typeof getPendingRegistrationForResume>>;
const labels = ["Your details", "Plan & payment", "Review & pay"];
const methods: Record<SavedRegistration["paymentMethod"], string> = {
  STRIPE: "Debit or credit card", PAYPAL: "PayPal", BANK_TRANSFER: "Bank transfer",
  JAZZCASH: "JazzCash", EASYPAISA: "Easypaisa", NAYAPAY: "Nayapay",
};

export function ResumeRegistration({ registrationId }: { registrationId: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState<SavedRegistration | null>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [sender, setSender] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/payments/resume?registrationId=${encodeURIComponent(registrationId)}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.registration) throw new Error(result.error || "Could not load your saved registration.");
        if (!controller.signal.aborted) setSaved(result.registration);
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load your saved registration."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [registrationId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saved || lock.current) return;
    if (step < 3) { setStep(step + 1); return; }
    const method = saved.paymentMethod;
    if (!["STRIPE", "PAYPAL", "BANK_TRANSFER", "JAZZCASH"].includes(method)) {
      setError("Please contact support for help completing this saved payment method.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const manual = method === "BANK_TRANSFER" || method === "JAZZCASH";
      const endpoint = manual ? "/api/payments/manual/submit" : method === "STRIPE" ? "/api/payments/stripe/create-checkout" : "/api/payments/paypal/create-order";
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manual ? {
          registrationId: saved.registrationId, method, senderName: sender.trim(), referenceKey: reference.trim(),
          notes: notes.trim() ? `${notes.trim()}\nPlatformRef:${saved.paymentReference}` : `PlatformRef:${saved.paymentReference}`,
        } : { registrationId: saved.registrationId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not continue payment.");
      if (manual) { router.push("/dashboard?payment=manual-under-review"); return; }
      const url = method === "STRIPE" ? result.checkoutUrl : result.approveUrl;
      if (!url) throw new Error("Could not start payment checkout.");
      window.location.href = url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not continue payment.");
      lock.current = false;
      setBusy(false);
    }
  }

  const manual = saved?.paymentMethod === "BANK_TRANSFER" || saved?.paymentMethod === "JAZZCASH";
  const amount = saved ? formatSirahMoney(saved.charge.amount, saved.charge.currency) : "";
  const plan = saved ? paymentPlanTypeLabels[saved.paymentPlanType] : "";
  const rows = saved ? [["Name", saved.fullName], ["Email", saved.email], ["Phone", `${saved.phoneCountryCode} ${saved.phoneNumber}`], ["Country of residence", saved.countryName], ["Programme", saved.courseTitle], ["Plan", plan], ["Payment method", methods[saved.paymentMethod]], ["Amount", amount], ...(saved.paymentReference ? [["Reference", saved.paymentReference]] : [])] : [];
  return <div className={styles.checkoutShell}>
    {saved && <OrderSummary summary={{ courseTitle: saved.courseTitle, planLabel: plan, priceText: amount, priceNote: saved.paymentPlanType === "SUBSCRIPTION" ? "Per month" : "Full course payment", priceState: "confirmed", originalPriceText: null, discountLabel: null, firstClass: null, refundThrough: null, manualPayment: Boolean(manual) }} />}
    <div className={styles.experience}>
      <p className={styles.eyebrow}>The Global Awakening · Course registration</p>
      <h2>{saved?.courseTitle || "Registration"}</h2>
      <p className={styles.introduction}>Review your saved registration and continue payment.</p>
      {loading && <p role="status">Loading your saved registration…</p>}
      {error && <p role="alert">{error}</p>}
      {saved && <form className={`${styles.form} ${styles.compactForm}`} onSubmit={submit} aria-busy={busy}>
        <ol className={styles.formProgress} aria-label="Registration steps">{labels.map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={step > index + 1 ? styles.formProgressDone : undefined}><button type="button" disabled={busy || index + 1 > step} onClick={() => setStep(index + 1)}><span aria-hidden="true">{step > index + 1 ? "✓" : index + 1}</span>{label}</button></li>)}</ol>
        <div className={styles.stepHead}><h3 className={styles.formStep}>{labels[step - 1]}</h3>{step > 1 && <button className={styles.stepBack} type="button" disabled={busy} onClick={() => setStep(step - 1)}>← Back</button>}</div>
        {step === 1 && <><p className={styles.stepHint}>Your saved details</p>{[["Full name", saved.fullName], ["Email", saved.email], ["Phone", `${saved.phoneCountryCode} ${saved.phoneNumber}`], ["Country of residence", saved.countryName]].map(([label, value]) => <label key={label}>{label}<input value={value} readOnly /></label>)}</>}
        {step === 2 && <><p className={styles.notice}>Your saved programme, fee and payment method will be used for this payment.</p><label>Programme<input value={saved.courseTitle} readOnly /></label><label>Plan<input value={plan} readOnly /></label><label>Payment method<input value={methods[saved.paymentMethod]} readOnly /></label><label>Amount<input value={amount} readOnly /></label></>}
        {step === 3 && <><dl className={styles.reviewList}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {manual && <><div className={styles.notice}><p>Use your platform reference in the payment note. After payment, send your screenshot to <a href="https://wa.me/923262055614" target="_blank" rel="noreferrer">WhatsApp support</a>.</p>{saved.paymentMethod === "BANK_TRANSFER" ? <p>Meezan Bank · AREEJ FATIMA<br />Account: 98900114432111<br />IBAN: PK96MEZN0098900114432111</p> : <p>JazzCash · Areej Fatima<br />03244517741</p>}</div><label>Sender name<input value={sender} onChange={e => setSender(e.target.value)} minLength={2} required /></label><label>Transfer reference ID<input value={reference} onChange={e => setReference(e.target.value)} minLength={4} required /></label><label>Notes (optional)<textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={450} /></label></>}
          {saved.paymentMethod === "PAYPAL" && saved.paymentPlanType === "SUBSCRIPTION" && <p className={styles.notice}>Please check the payment amount shown by PayPal before confirming your subscription.</p>}
        </>}
        <div className={styles.stickyAction}><button className={styles.primary} disabled={busy} type="submit">{busy ? "Processing…" : step < 3 ? "Continue" : manual ? "Submit transfer details" : `Continue to payment · ${amount}`}</button></div>
      </form>}
    </div>
  </div>;
}
