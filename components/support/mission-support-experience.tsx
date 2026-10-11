"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/home/sections/header";
import { Footer } from "@/components/home/sections/footer";
import { companyRegisterUrl, missionContactEmail, missionPurposes, missionPurposeLabel, type GivingFrequency, type MissionPurpose } from "@/lib/mission-support";
import type { MissionSupportConfig } from "@/lib/mission-support-config";
import { donationCountry, manualDonationAccounts } from "@/lib/mission-payment-options";
import { fundingAreas, learningPrinciples, contributionStages } from "./mission-support-content";
import { MissionCountryPicker } from "./mission-country-picker";
import { MissionFundingGraphic } from "./mission-funding-graphic";
import "./mission-support.css";
import { missionAllocationNotice, missionContributionPolicyPath } from "@/lib/mission-contribution-policy";

const amounts = [10, 25, 50, 100, 200] as const;
const storageKey = "tga-mission-giving-selection";
type Receipt = { status: string; amountGbp: number; frequency: string; purpose: string; reference: string; managementToken?: string };

function Icon({ name }: { name: "arrow" | "lock" | "book" | "heart" | "people" | "plus" | "spark" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "arrow" && <path d="M4 12h15m-6-6 6 6-6 6" />}
    {name === "lock" && <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" /></>}
    {name === "book" && <><path d="M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2ZM12 6v15" /></>}
    {name === "heart" && <path d="M12 20 4 12a5 5 0 0 1 8-6 5 5 0 0 1 8 6Z" />}
    {name === "people" && <><circle cx="9" cy="7" r="3" /><path d="M3 20v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2" /></>}
    {name === "spark" && <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />}
    {name === "plus" && <path d="M12 4v16M4 12h16" />}
  </svg>;
}

export default function MissionSupportExperience({ config }: { config: MissionSupportConfig }) {
  const searchParams = useSearchParams();
  const mainRef = useRef<HTMLElement>(null);
  const journeyRef = useRef<HTMLOListElement>(null);
  const [activeStage, setActiveStage] = useState(0);
  const formRef = useRef<HTMLElement>(null);
  const purposeRef = useRef<HTMLSelectElement>(null);
  const requestRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const [frequency, setFrequency] = useState<GivingFrequency>("MONTHLY");
  const [amount, setAmount] = useState<number | "other">(25);
  const [customAmount, setCustomAmount] = useState("");
  const [purpose, setPurpose] = useState<MissionPurpose>("WHERE_NEEDED");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("GB");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"STRIPE" | "PAYPAL" | "BANK_TRANSFER" | "JAZZCASH">("STRIPE");
  const [manualAmountPkr, setManualAmountPkr] = useState("");
  const [senderName, setSenderName] = useState("");
  const [referenceKey, setReferenceKey] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualReference, setManualReference] = useState("");
  const country = donationCountry(countryCode)!;
  const isManual = paymentMethod === "BANK_TRANSFER" || paymentMethod === "JAZZCASH";
  const paymentAvailable = paymentMethod === "STRIPE" ? config.checkoutAvailable : paymentMethod === "PAYPAL" ? config.paypalAvailable : config.manualAvailable;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [stickyVisible, setStickyVisible] = useState(false);
  const [restored, setRestored] = useState(false);
  const [managementToken, setManagementToken] = useState("");
  const activeAmount = amount === "other" ? Number(customAmount) : amount;
  const formattedAmount = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number.isFinite(activeAmount) ? activeAmount : 0);
  const contributionTermsUrl = config.policyUrl || missionContributionPolicyPath;
  const allocationSummary = config.allocationNotice || missionAllocationNotice;

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (saved?.frequency === "MONTHLY" || saved?.frequency === "ONE_TIME") setFrequency(saved.frequency);
      if (saved?.amount === "other" || amounts.includes(saved?.amount)) setAmount(saved.amount);
      if (typeof saved?.customAmount === "string") setCustomAmount(saved.customAmount.slice(0, 12));
      if (missionPurposes.some(p => p.id === saved?.purpose)) setPurpose(saved.purpose);
    } catch { /* Browser storage is optional. */ }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ frequency, amount, customAmount, purpose })); } catch { /* Continue without storage. */ }
  }, [frequency, amount, customAmount, purpose, restored]);

  useEffect(() => {
    if (!formRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setStickyVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    observer.observe(formRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (searchParams.get("payment") === "cancelled") setConfirmationMessage("Checkout was cancelled. No payment has been confirmed. Your selections are saved below.");
    const token = searchParams.get("manage");
    if (token) setManagementToken(token);
    if (searchParams.get("payment") !== "success") return;
    if (searchParams.get("provider") === "paypal") {
      const orderId = searchParams.get("token"); const donationId = searchParams.get("donationId");
      if (!orderId || !donationId) { setConfirmationMessage("A return URL alone cannot confirm a contribution. Please contact TGA."); return; }
      let cancelled = false;
      setConfirmationMessage("We are checking your PayPal payment. Please keep this page open.");
      void fetch("/api/mission-support/paypal/capture-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, donationId }) }).then(async response => { const result = await response.json(); if (cancelled) return; if (!response.ok || result.status !== "confirmed") throw new Error(result.error || "PayPal has not confirmed this contribution."); setReceipt(result); setConfirmationMessage("JazakAllahu khair. Your PayPal contribution is confirmed. Thank you for supporting meaningful learning."); }).catch(cause => { if (!cancelled) setConfirmationMessage(cause instanceof Error ? cause.message : "Payment confirmation is unavailable."); });
      return () => { cancelled = true; };
    }
    const sessionId = searchParams.get("session_id");
    if (!sessionId) { setConfirmationMessage("A return URL alone cannot confirm a contribution. Please check your provider receipt or contact TGA."); return; }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    setConfirmationMessage("We're checking your payment confirmation. Please keep this page open.");
    const check = async () => {
      try {
        const response = await fetch(`/api/mission-support/confirmation?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || "We couldn't verify this contribution yet.");
        if (data.status === "confirmed") {
          setReceipt(data);
          setManagementToken(data.managementToken || "");
          setConfirmationMessage("JazakAllahu khair. Your contribution has been confirmed. Thank you for supporting meaningful learning.");
        } else if (data.status === "failed") setConfirmationMessage("This payment was not confirmed. You can retry below or contact our team.");
        else if (++attempts < 8) timer = setTimeout(check, 2500);
        else setConfirmationMessage("Your payment is awaiting confirmation. Keep your provider receipt; contact TGA if confirmation does not arrive.");
      } catch (cause) { if (!cancelled) setConfirmationMessage(cause instanceof Error ? cause.message : "Payment confirmation is not yet available."); }
    };
    void check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchParams]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    main.classList.add("ms-motion-ready");
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add("ms-visible"); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    main.querySelectorAll(".ms-reveal").forEach(element => observer.observe(element));
    const stages = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = Number((entry.target as HTMLElement).dataset.stage);
          const current = Number(journeyRef.current?.dataset.progress || 0);
          const progress = Math.max(current, index + 1);
          if (journeyRef.current) { journeyRef.current.dataset.progress = String(progress); journeyRef.current.style.setProperty("--journey-progress", String(progress / 4)); }
        }
      });
    }, { threshold: 0.65 });
    journeyRef.current?.querySelectorAll("li").forEach(element => stages.observe(element));
    return () => { observer.disconnect(); stages.disconnect(); main.classList.remove("ms-motion-ready"); };
  }, []);

  function scrollToGiving(nextPurpose?: MissionPurpose, monthly = false) {
    if (nextPurpose) setPurpose(nextPurpose);
    if (monthly) { setFrequency("MONTHLY"); if (paymentMethod === "PAYPAL") setPaymentMethod("STRIPE"); }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    formRef.current?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
    purposeRef.current?.focus({ preventScroll: true });
  }

  async function manageSupport() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/mission-support/billing-portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: managementToken }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "We couldn't open support management.");
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com") throw new Error("Invalid management destination.");
      window.location.assign(url.toString());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please contact TGA for help managing support."); }
    finally { setLoading(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!isManual && (!Number.isFinite(activeAmount) || activeAmount < 1 || activeAmount > 10000 || Math.abs(activeAmount * 100 - Math.round(activeAmount * 100)) > 0.000001)) { setError("Please enter an amount between £1 and £10,000, using no more than two decimal places."); return; }
    if (!paymentAvailable) { setError("This payment method is temporarily unavailable. Please choose another or contact TGA."); return; }
    if (loading) return;
    setLoading(true);
    const fingerprint = JSON.stringify({ name: name.trim(), email: email.trim(), frequency, purpose, activeAmount, countryCode, phoneNumber, paymentMethod, manualAmountPkr, senderName, referenceKey, manualNotes });
    if (requestRef.current?.fingerprint !== fingerprint) requestRef.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const response = await fetch("/api/mission-support/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: name.trim(), email: email.trim(), amountGbp: isManual ? undefined : activeAmount, frequency, purpose, requestId: requestRef.current!.id, countryCode, phoneCountryCode: country.dialCode, phoneNumber: phoneNumber.trim(), paymentMethod, ...(isManual ? { manualAmountPkr: Number(manualAmountPkr), senderName: senderName.trim(), referenceKey: referenceKey.trim(), notes: manualNotes.trim() } : {}) }) });
      const data = await response.json();
      if (response.ok && data.mode === "MANUAL") { setManualReference(data.paymentReference); setConfirmationMessage("Your transfer details have been submitted. TGA will confirm your contribution after reviewing the payment."); return; }
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "We couldn't open secure checkout. Please try again.");
      const url = new URL(data.checkoutUrl);
      if (url.protocol !== "https:" || !(paymentMethod === "STRIPE" ? url.hostname === "checkout.stripe.com" : ["www.paypal.com", "www.sandbox.paypal.com"].includes(url.hostname))) throw new Error("Invalid checkout destination.");
      window.location.assign(url.toString());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn't open secure checkout. Please try again."); }
    finally { setLoading(false); }
  }

  const givingPurposes = [
    { id: "WHERE_NEEDED", label: "Where most needed" },
    ...fundingAreas.map(area => ({ id: area.id, label: area.title })),
  ];
  const faqs = [
    ["What does my contribution support?", "Scholarships, worldwide learning access and related educational costs. Your preference guides allocation; if funds are redirected, TGA will notify you by email. Specific restrictions must be agreed in writing before payment."],
    ["Is my contribution one-time or monthly?", "You choose in the form. Monthly support renews through Stripe until cancelled; use the secure management link in your acknowledgment or contact TGA for help."],
    ["Is the payment process secure?", "Online payment details are entered securely on Stripe or PayPal. TGA does not store your card details. Manual transfers are confirmed only after admin verification."],
    ["How do I contact TGA about a donation?", "Email " + missionContactEmail + " with your payment reference. The team can help with funding questions, cancellation or refund requests under the applicable contribution terms."],
    ["Is Gift Aid available?", "Gift Aid is not offered. TGA operates as GLOBAL AWAKENING CIC, a Community Interest Company; this page does not claim registered-charity status."],
  ];

  return <>
    <Header />
    <main className="mission-support" id="mission-top" ref={mainRef}>
      <a href="#mission-giving" className="ms-skip">Skip to contribution form</a>
      {confirmationMessage || managementToken ? <section className="ms-return ms-container" aria-label="Your contribution">
        {confirmationMessage && <p role="status">{confirmationMessage}</p>}
        {receipt && <p><strong>{new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(receipt.amountGbp)}</strong> · {receipt.purpose} · {receipt.frequency === "MONTHLY" ? "Monthly" : "One-time"} · Reference {receipt.reference}</p>}
        {managementToken && <button className="ms-button ms-button-dark" onClick={() => void manageSupport()} disabled={loading}>Manage monthly support <Icon name="arrow" /></button>}
        {error && <p role="alert">{error}</p>}
      </section> : null}

      <section className="ms-hero-banner" aria-labelledby="mission-title">
        <div className="ms-hero-background"><Image src="/images/mission/islamic-learning-banner.webp" alt="" fill sizes="(max-width: 767px) 100vw, 70vw" priority /></div>
        <div className="ms-hero ms-container">
        <div className="ms-hero-copy">
          <div className="ms-hero-message">
          <p className="ms-eyebrow ms-hero-enter">Support Our Mission</p>
          <h1 className="ms-hero-enter" id="mission-title">Help shape the<br /><em>next generation.</em></h1>
          <p className="ms-lead ms-hero-enter">Help fund scholarships for students in need and make Islamic education accessible worldwide.</p>
          <button className="ms-button ms-button-light ms-hero-action" onClick={() => scrollToGiving()}>Support meaningful learning <Icon name="arrow" /></button>
          </div>
          <div className="ms-hero-foundation ms-hero-enter"><p>Rooted in knowledge.<br /><em>Guided by purpose.</em></p><span>Online Islamic education · Knowledge · Tarbiyah · Service</span><a href="#mission-programmes">Explore the learning behind the mission</a></div>
        </div>

        <aside id="mission-giving" className="ms-giving ms-hero-enter" ref={formRef} aria-labelledby="giving-title">
          <div className="ms-giving-heading"><span className="ms-giving-symbol"><Icon name="heart" /></span><span>Education. Character. Community.</span></div>
          <h2 id="giving-title">Make a meaningful contribution.</h2>
          <p>Choose how you would like to support the mission.</p>
          {((paymentMethod === "STRIPE" && config.testMode && config.checkoutAvailable) || (paymentMethod === "PAYPAL" && config.paypalTestMode && config.paypalAvailable)) && <p className="ms-test-notice">Test checkout · no real contribution will be collected.</p>}
          <form onSubmit={submit}>
            <fieldset className="ms-frequency"><legend className="ms-sr-only">Giving frequency</legend>
              <button type="button" aria-pressed={frequency === "MONTHLY"} onClick={() => { setFrequency("MONTHLY"); if (paymentMethod === "PAYPAL") setPaymentMethod("STRIPE"); }}>Monthly</button>
              <button type="button" aria-pressed={frequency === "ONE_TIME"} onClick={() => setFrequency("ONE_TIME")}>One-time</button>
            </fieldset>
            {!isManual && <fieldset className="ms-amounts"><legend>Choose your amount <span>GBP</span></legend>
              <div>{amounts.map(value => <button key={value} type="button" aria-pressed={amount === value} onClick={() => setAmount(value)}>£{value}</button>)}<button type="button" aria-pressed={amount === "other"} onClick={() => setAmount("other")}>Other</button></div>
            </fieldset>}
            {!isManual && amount === "other" && <label className="ms-field" htmlFor="mission-custom">Your amount in GBP<input id="mission-custom" name="amount" inputMode="decimal" type="number" min="1" max="10000" step="0.01" placeholder="e.g. 35.00" value={customAmount} onChange={event => setCustomAmount(event.target.value)} required aria-describedby="mission-amount-help" /><small id="mission-amount-help">£1–£10,000. Up to two decimal places.</small></label>}
            <label className="ms-field" htmlFor="mission-purpose">Funding preference<select ref={purposeRef} id="mission-purpose" value={purpose} onChange={event => setPurpose(event.target.value as MissionPurpose)}>{givingPurposes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}{!givingPurposes.some(item => item.id === purpose) && <option value={purpose}>{missionPurposeLabel(purpose)}</option>}</select></label>
            <p className="ms-preference-note">Your preference guides allocation. Funds may also support related TGA costs or be redirected with an email notice. Agree specific restrictions in writing before giving.</p>
            <div className="ms-donor-fields"><label className="ms-field" htmlFor="mission-name">Your name<input id="mission-name" name="name" autoComplete="name" minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} required /></label><label className="ms-field" htmlFor="mission-email">Email address<input id="mission-email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required /></label></div>

            <div className="ms-donor-fields"><div className="ms-field"><label htmlFor="mission-country-trigger">Country & phone code</label><MissionCountryPicker value={countryCode} onChange={code => { setCountryCode(code); if (code !== "PK" && isManual) setPaymentMethod("STRIPE"); }} /></div><label className="ms-field" htmlFor="mission-phone">Phone number<input id="mission-phone" type="tel" autoComplete="tel-national" inputMode="tel" pattern="[0-9 ()-]{6,20}" minLength={6} maxLength={20} value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} required placeholder="Without country code" /></label></div>
            <fieldset className="ms-methods"><legend>Choose your payment method</legend><div><label><input type="radio" name="mission-method" value="STRIPE" checked={paymentMethod === "STRIPE"} onChange={() => setPaymentMethod("STRIPE")} /><span><strong>Stripe / Card</strong><small>One-time / monthly</small></span></label><label><input type="radio" name="mission-method" value="PAYPAL" checked={paymentMethod === "PAYPAL"} onChange={() => { setPaymentMethod("PAYPAL"); setFrequency("ONE_TIME"); }} /><span><strong>PayPal</strong><small>One-time giving</small></span></label>{countryCode === "PK" && <label><input type="radio" name="mission-method" value="BANK_TRANSFER" checked={isManual} onChange={() => setPaymentMethod("BANK_TRANSFER")} /><span><strong>Bank / JazzCash</strong><small>PK only; admin review</small></span></label>}</div></fieldset>
            {isManual && <div className="ms-manual-panel"><h3>Transfer, then submit your details.</h3><p>For a local transfer, enter the actual amount sent in PKR below. TGA verifies the transfer before recording it as confirmed.</p><label className="ms-field" htmlFor="mission-transfer-method">Transfer destination<select id="mission-transfer-method" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as "BANK_TRANSFER" | "JAZZCASH")}><option value="BANK_TRANSFER">Meezan Bank</option><option value="JAZZCASH">JazzCash</option></select></label>{paymentMethod === "BANK_TRANSFER" ? <div className="ms-bank-details"><strong>{manualDonationAccounts.bank.name}</strong><p>Account title: {manualDonationAccounts.bank.title}</p><p>Account number: {manualDonationAccounts.bank.number}</p><p>IBAN: {manualDonationAccounts.bank.iban}</p></div> : <div className="ms-bank-details"><strong>{manualDonationAccounts.jazzcash.name}</strong><p>Account title: {manualDonationAccounts.jazzcash.title}</p><p>Account number: {manualDonationAccounts.jazzcash.number}</p></div>}<label className="ms-field" htmlFor="mission-pkr">Amount transferred (PKR)<input id="mission-pkr" type="number" inputMode="decimal" min="1" max="10000000" step="0.01" value={manualAmountPkr} onChange={event => setManualAmountPkr(event.target.value)} required /></label><label className="ms-field" htmlFor="mission-sender">Sender account name<input id="mission-sender" minLength={2} maxLength={120} value={senderName} onChange={event => setSenderName(event.target.value)} required /></label><label className="ms-field" htmlFor="mission-transfer-reference">Transaction reference / ID<input id="mission-transfer-reference" maxLength={120} value={referenceKey} onChange={event => setReferenceKey(event.target.value)} required /></label><label className="ms-field" htmlFor="mission-transfer-notes">Transfer notes (optional)<textarea id="mission-transfer-notes" maxLength={500} value={manualNotes} onChange={event => setManualNotes(event.target.value)} /></label>{frequency === "MONTHLY" && <p>This is a monthly giving pledge, not an automatic subscription. Submit each future transfer for verification.</p>}</div>}
            <p className="ms-selection" aria-live="polite"><strong>{isManual ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "PKR" }).format(Number(manualAmountPkr) || 0) : formattedAmount}</strong> {frequency === "MONTHLY" ? (isManual ? "monthly pledge" : "each month") : "one-time"}<span>{missionPurposeLabel(purpose)}</span></p>
            {error && !managementToken && <p className="ms-error" role="alert">{error}</p>}
            <button className="ms-button ms-button-dark ms-submit" type="submit" disabled={loading || !paymentAvailable}>{loading ? (isManual ? "Submitting transfer details…" : "Opening secure checkout…") : isManual ? "Submit transfer for verification" : paymentMethod === "PAYPAL" ? "Continue to PayPal" : "Continue to secure donation"}<Icon name="arrow" /></button>
            {paymentAvailable ? <p className="ms-payment-note"><Icon name="lock" />{isManual ? "Your transfer will be reviewed by TGA before confirmation." : "Payment details are entered securely on " + (paymentMethod === "PAYPAL" ? "PayPal." : "Stripe.")}</p> : <p className="ms-payment-note ms-unavailable">Online contributions are temporarily unavailable. <a href={`mailto:${missionContactEmail}?subject=Supporting%20TGA`}>Contact our team</a> to discuss supporting the mission.</p>}
            {frequency === "MONTHLY" && !isManual && <p className="ms-small-note">Monthly giving renews until cancelled. Manage future payments using the link in your acknowledgment.</p>}
            <p className="ms-small-note">By continuing, you agree to the <a href={contributionTermsUrl} target="_blank" rel="noopener noreferrer">Contribution & Donation Policy</a>.</p>
            {manualReference && <p className="ms-manual-confirmation" role="status">Transfer submitted for admin review. Reference: <strong>{manualReference}</strong>. It is not yet confirmed as received.</p>}
          </form>
        </aside>

        </div>
      </section>

      <section className="ms-purpose ms-section" aria-labelledby="purpose-title">
        <div className="ms-container ms-purpose-layout">
          <figure className="ms-purpose-art ms-reveal"><Image src="/images/mission/islamic-remote-teacher.webp" alt="A male Islamic educator teaching remotely with a laptop, study books and lesson notes" width={1536} height={1024} sizes="(max-width: 767px) 100vw, 50vw" /></figure>
          <div className="ms-reveal"><p className="ms-eyebrow">Knowledge. Tarbiyah. Responsibility.</p><h2 id="purpose-title">More than a course.<br />An investment in generations.</h2><p>Qur’an and Seerah learning that builds knowledge, character and responsibility.</p><div className="ms-principles">{learningPrinciples.map((item, index) => <div key={item.title}><span className="ms-principle-number">0{index + 1}</span><div><h3>{item.title}</h3><p>{item.copy}</p></div></div>)}</div></div>
        </div>
      </section>

      <section id="mission-purposes" className="ms-section ms-container" aria-labelledby="purposes-title">
        <div className="ms-section-heading ms-reveal"><p className="ms-eyebrow">Three ways to support purposeful education</p><h2 id="purposes-title">Choose where your support matters.</h2></div>
        <div className="ms-causes">{fundingAreas.map((item, index) => <article className={"ms-cause ms-reveal " + (purpose === item.id ? "ms-cause-selected" : "")} key={item.id} style={{ transitionDelay: `${index * 70}ms` }}><MissionFundingGraphic kind={item.graphic} /><div className="ms-cause-copy"><span className="ms-number">0{index + 1}</span><h3>{item.title}</h3><p>{item.copy}</p><button className="ms-text-link" aria-pressed={purpose === item.id} onClick={() => scrollToGiving(item.id)}>{purpose === item.id ? "Preference selected" : "Support this area"}<Icon name="arrow" /></button></div></article>)}</div>

      </section>

      <section className="ms-impact ms-section" aria-labelledby="impact-title"><Image className="ms-impact-background" src="/images/mission/islamic-digital-resources.webp" alt="" fill sizes="100vw" /><div className="ms-container">
        <div className="ms-section-heading ms-reveal"><p className="ms-eyebrow">Your contribution in action</p><h2 id="impact-title">What your support helps make possible.</h2><p>From your contribution to learning opportunities for students in need.</p></div>
        <ol className="ms-impact-path" ref={journeyRef} aria-label="How contributions support learning">{contributionStages.map((stage, index) => <li key={stage.title} data-stage={index}><button type="button" className="ms-path-stage" aria-pressed={activeStage === index} onClick={() => setActiveStage(index)}><span className="ms-path-symbol"><Icon name={stage.icon} /><span>0{index + 1}</span></span><h3>{stage.title}</h3><p>{stage.copy}</p></button></li>)}</ol>
        <p className="ms-impact-caption">Illustrative funding journey. Contact TGA for specific allocation arrangements.</p>
      </div></section>

      <section id="mission-programmes" className="ms-programmes ms-section ms-container" aria-labelledby="programmes-title">
        <div className="ms-section-heading ms-reveal"><p className="ms-eyebrow">Guidance that reaches beyond a lesson</p><h2 id="programmes-title">Online education.<br />Purpose beyond the screen.</h2><p>Guided online learning that connects Islamic knowledge with everyday character and service.</p></div>
        <div className="ms-programme-story"><figure className="ms-reveal"><Image src="/images/mission/islamic-girl-online-learning-niqab.webp" alt="A young learner in hijab taking notes at home during an online lesson with a female teacher wearing a niqab" width={1536} height={1024} sizes="(max-width: 767px) 100vw, 45vw" /></figure><div className="ms-programme-copy ms-reveal"><p className="ms-eyebrow">Gen-Mu’min</p><h3>Knowledge, character and community.</h3><p>Arabic-Tajweed, Seerah, life skills and leadership sit alongside community building and parental sessions. The programme brings purposeful learning into family life.</p><a className="ms-text-link" href="/projects/gen-mumin">Explore Gen-Mu’min <Icon name="arrow" /></a><div className="ms-programme-secondary"><p className="ms-eyebrow">Seerah & Prophetic leadership</p><h3>Guidance for thoughtful action.</h3><p>Study the Prophetic example and reflect on responsibility, relationships and leadership through TGA’s online educational work.</p><a className="ms-text-link" href="/seerah">Explore Seerah <Icon name="arrow" /></a></div><p className="ms-small-note">Future initiatives will build on TGA’s educational mission. Contact the team about current plans and funding needs.</p></div></div>
      </section>

      <section className="ms-accountability ms-section" aria-labelledby="accountability-title"><div className="ms-container ms-accountability-layout">
        <div className="ms-reveal"><p className="ms-eyebrow">Trust & transparency</p><h2 id="accountability-title">Know where your contribution goes.</h2><p>{allocationSummary}</p><div className="ms-accountability-links"><a href={contributionTermsUrl} target="_blank" rel="noopener noreferrer">Contribution & Donation Policy <Icon name="arrow" /></a><a href={companyRegisterUrl + "/filing-history"} target="_blank" rel="noopener noreferrer">Public company filings <Icon name="arrow" /></a>{config.impactReportUrl && <a href={config.impactReportUrl} target="_blank" rel="noopener noreferrer">Verified impact report <Icon name="arrow" /></a>}<a href={"mailto:" + missionContactEmail}>Ask about funding <Icon name="arrow" /></a></div></div>
        <aside className="ms-company ms-reveal" aria-label="Organisation details"><div className="ms-company-mark"><Icon name="book" /><span>Organisation record</span></div><h3>GLOBAL AWAKENING CIC</h3><p>Community Interest Company<br />Registered in England and Wales<br />Company number <strong>15523255</strong></p><p>Registered office<br />128 City Road, London, EC1V 2NX</p><a href={companyRegisterUrl} target="_blank" rel="noopener noreferrer">View company record <Icon name="arrow" /></a><small>Gift Aid is not offered on this page.</small></aside>
      </div></section>

      <section className="ms-monthly ms-section" aria-labelledby="monthly-title"><div className="ms-container ms-monthly-layout ms-reveal"><div><p className="ms-eyebrow">Steady support for ongoing learning</p><h2 id="monthly-title">Help good work continue.</h2><p>Give monthly to help sustain scholarships and online learning. Cancel future automatic payments at any time.</p></div><button className="ms-button ms-button-dark" onClick={() => scrollToGiving(undefined, true)}>Choose monthly support <Icon name="arrow" /></button></div></section>

      <section className="ms-closing" aria-labelledby="closing-title"><div className="ms-closing-visual"><Image className="ms-closing-photo" src="/images/mission/islamic-digital-resources.webp" alt="" fill sizes="(max-width: 767px) 100vw, 55vw" /></div><div className="ms-container ms-final ms-reveal"><div><p className="ms-eyebrow">Knowledge shared. Character nurtured. Community served.</p><h2 id="closing-title">Be part of what comes next.</h2><p>Help a student in need access Islamic education, wherever they live.</p></div><div className="ms-final-actions"><button className="ms-button ms-button-light" onClick={() => scrollToGiving()}>Support the Mission <Icon name="arrow" /></button><a className="ms-text-link" href="#mission-programmes">Explore Our Work <Icon name="arrow" /></a></div></div></section>

      <section className="ms-faq-section ms-section" aria-labelledby="faq-title"><div className="ms-container ms-faq"><div><p className="ms-eyebrow">A clear path to giving</p><h3 id="faq-title">Before you contribute</h3></div><div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<Icon name="plus" /></summary><div className="ms-faq-answer"><p>{answer}</p></div></details>)}</div></div></section>

    </main>
    <div className="ms-mission-footer"><Footer legalName="GLOBAL AWAKENING CIC" /></div>
    {stickyVisible && <div className="ms-mobile-action"><span>{formattedAmount}<small>{frequency === "MONTHLY" ? "Monthly support" : "One-time support"}</small></span><button className="ms-button ms-button-dark" onClick={() => scrollToGiving()}>Make a contribution <Icon name="arrow" /></button></div>}
  </>;
}
