"use client";

import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { MissionSupportConfig } from "@/lib/mission-support-config";
import type { MissionPurpose } from "@/lib/mission-support";
import { missionContributionPolicyPath } from "@/lib/mission-contribution-policy";
import { amounts, fundingAreas, missionContactEmail, missionPurposeLabel, missionPurposes } from "./content";
import { useGiving, type Method } from "./giving-state";
import s from "./support.module.css";

export type Country = { code: string; name: string; dialCode: string };
export type ManualAccounts = {
  bank: { name: string; title: string; number: string; iban: string };
  jazzcash: { name: string; title: string; number: string };
};

/* Same option order as live. */
const givingPurposes = [
  { id: "WHERE_NEEDED", label: "Where most needed" },
  ...missionPurposes.filter(item => ["GEN_MUMIN", "SIRAH_BEYOND_CHRONOLOGY"].includes(item.id)),
  ...fundingAreas.map(area => ({ id: area.id, label: area.title })),
  ...missionPurposes.filter(item => ["EXISTING_PROGRAMMES", "NEW_INITIATIVES"].includes(item.id)),
];

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" className={s.icon} aria-hidden="true">
      <path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Lock() {
  return (
    <svg viewBox="0 0 24 24" className={s.icon} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" /></g>
    </svg>
  );
}

/* Signature moment two: the giving seal. Twelve marks round the amount, one
 * for each month of a year. One-time support lights a single mark; monthly
 * support lights all twelve, one after another, because that is what it is:
 * the same gift, returning. No totals are invented; the words beside it are
 * the live form's own summary. Opacity only. */
function GivingSeal({ monthly }: { monthly: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className={s.seal} aria-hidden="true">
      <circle cx="60" cy="60" r="40" className={s.sealRing} />
      <g className={s.sealStar}>
        <rect x="38" y="38" width="44" height="44" />
        <rect x="38" y="38" width="44" height="44" transform="rotate(45 60 60)" />
      </g>
      {Array.from({ length: 12 }, (_, m) => (
        <path
          key={m}
          d="M60 4 L64 11 L60 18 L56 11 Z"
          transform={`rotate(${m * 30} 60 60)`}
          className={s.sealMark}
          data-lit={m === 0 || monthly ? "" : undefined}
          style={{ "--m": m } as CSSProperties}
        />
      ))}
    </svg>
  );
}

export function GivingForm({ config, countries, accounts }: { config: MissionSupportConfig; countries: Country[]; accounts: ManualAccounts }) {
  const g = useGiving();
  const { frequency, setFrequency, amount, setAmount, customAmount, setCustomAmount, purpose, setPurpose, paymentMethod, setPaymentMethod, loading, setLoading, error, setError, managementToken, activeAmount, formattedAmount, setConfirmationMessage } = g;
  const requestRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("GB");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [manualAmountPkr, setManualAmountPkr] = useState("");
  const [senderName, setSenderName] = useState("");
  const [referenceKey, setReferenceKey] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualReference, setManualReference] = useState("");
  const country = countries.find(c => c.code === countryCode) ?? countries[0];
  const isManual = paymentMethod === "BANK_TRANSFER" || paymentMethod === "JAZZCASH";
  const paymentAvailable = paymentMethod === "STRIPE" ? config.checkoutAvailable : paymentMethod === "PAYPAL" ? config.paypalAvailable : config.manualAvailable;
  const contributionTermsUrl = config.policyUrl || missionContributionPolicyPath;
  const monthly = frequency === "MONTHLY";

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

  const shownAmount = isManual ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "PKR" }).format(Number(manualAmountPkr) || 0) : formattedAmount;

  return (
    <aside id="mission-giving" className={s.giving} ref={g.formRef} aria-labelledby="giving-title" data-rise="" style={{ "--i": 2 } as CSSProperties}>
      <p className={s.givingKicker}>Education. Character. Community.</p>
      <h2 id="giving-title" className={s.givingTitle}>Make a meaningful contribution.</h2>
      <p className={s.givingLede}>Choose how you would like to support the mission.</p>
      {((paymentMethod === "STRIPE" && config.testMode && config.checkoutAvailable) || (paymentMethod === "PAYPAL" && config.paypalTestMode && config.paypalAvailable)) && <p className={s.testNotice}>Test checkout · no real contribution will be collected.</p>}

      <form onSubmit={submit} className={s.form}>
        <fieldset className={s.frequency}>
          <legend className={s.srOnly}>Giving frequency</legend>
          <button type="button" aria-pressed={monthly} onClick={() => { setFrequency("MONTHLY"); if (paymentMethod === "PAYPAL") setPaymentMethod("STRIPE"); }}>Monthly</button>
          <button type="button" aria-pressed={!monthly} onClick={() => setFrequency("ONE_TIME")}>One-time</button>
          <span className={s.frequencyThumb} data-side={monthly ? "a" : "b"} aria-hidden="true" />
        </fieldset>

        {!isManual && (
          <fieldset className={s.amounts}>
            <legend>Choose your amount <span>GBP</span></legend>
            <div>
              {amounts.map(value => <button key={value} type="button" aria-pressed={amount === value} onClick={() => setAmount(value)}>£{value}</button>)}
              <button type="button" aria-pressed={amount === "other"} onClick={() => setAmount("other")}>Other</button>
            </div>
          </fieldset>
        )}
        {!isManual && amount === "other" && (
          <label className={s.field} htmlFor="mission-custom">
            <span>Your amount in GBP</span>
            <input id="mission-custom" name="amount" inputMode="decimal" type="number" min="1" max="10000" step="0.01" placeholder="e.g. 35.00" value={customAmount} onChange={event => setCustomAmount(event.target.value)} required aria-describedby="mission-amount-help" />
            <small id="mission-amount-help">£1–£10,000. Up to two decimal places.</small>
          </label>
        )}

        <label className={s.field} htmlFor="mission-purpose">
          <span>Funding preference</span>
          <select ref={g.purposeRef} id="mission-purpose" value={purpose} onChange={event => setPurpose(event.target.value as MissionPurpose)}>
            {givingPurposes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            {!givingPurposes.some(item => item.id === purpose) && <option value={purpose}>{missionPurposeLabel(purpose)}</option>}
          </select>
        </label>
        <p className={s.note}>Your preference guides allocation. Funds may also support related TGA costs or be redirected with an email notice. Agree specific restrictions in writing before giving.</p>

        <div className={s.pair}>
          <label className={s.field} htmlFor="mission-name"><span>Your name</span><input id="mission-name" name="name" autoComplete="name" minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} required /></label>
          <label className={s.field} htmlFor="mission-email"><span>Email address</span><input id="mission-email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required /></label>
        </div>
        <div className={s.pair}>
          <label className={s.field} htmlFor="mission-country">
            <span>Country &amp; phone code</span>
            <select id="mission-country" autoComplete="country" value={countryCode} onChange={event => { const code = event.target.value; setCountryCode(code); if (code !== "PK" && isManual) setPaymentMethod("STRIPE"); }}>
              {countries.map(c => <option key={c.code} value={c.code}>{c.name} ({c.dialCode})</option>)}
            </select>
          </label>
          <label className={s.field} htmlFor="mission-phone"><span>Phone number</span><input id="mission-phone" type="tel" autoComplete="tel-national" inputMode="tel" pattern="[0-9 ()-]{6,20}" minLength={6} maxLength={20} value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} required placeholder="Without country code" /></label>
        </div>

        <fieldset className={s.methods}>
          <legend>Choose your payment method</legend>
          <div>
            <label><input type="radio" name="mission-method" value="STRIPE" checked={paymentMethod === "STRIPE"} onChange={() => setPaymentMethod("STRIPE")} /><span><strong>Stripe / Card</strong><small>One-time / monthly</small></span></label>
            <label><input type="radio" name="mission-method" value="PAYPAL" checked={paymentMethod === "PAYPAL"} onChange={() => { setPaymentMethod("PAYPAL"); setFrequency("ONE_TIME"); }} /><span><strong>PayPal</strong><small>One-time giving</small></span></label>
            {countryCode === "PK" && <label><input type="radio" name="mission-method" value="BANK_TRANSFER" checked={isManual} onChange={() => setPaymentMethod("BANK_TRANSFER")} /><span><strong>Bank / JazzCash</strong><small>PK only; admin review</small></span></label>}
          </div>
        </fieldset>

        {isManual && (
          <div className={s.manual}>
            <h3>Transfer, then submit your details.</h3>
            <p>For a local transfer, enter the actual amount sent in PKR below. TGA verifies the transfer before recording it as confirmed.</p>
            <label className={s.field} htmlFor="mission-transfer-method">
              <span>Transfer destination</span>
              <select id="mission-transfer-method" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as Method)}><option value="BANK_TRANSFER">Meezan Bank</option><option value="JAZZCASH">JazzCash</option></select>
            </label>
            {paymentMethod === "BANK_TRANSFER" ? (
              <dl className={s.account}><dt>{accounts.bank.name}</dt><dd>Account title: {accounts.bank.title}</dd><dd>Account number: {accounts.bank.number}</dd><dd>IBAN: {accounts.bank.iban}</dd></dl>
            ) : (
              <dl className={s.account}><dt>{accounts.jazzcash.name}</dt><dd>Account title: {accounts.jazzcash.title}</dd><dd>Account number: {accounts.jazzcash.number}</dd></dl>
            )}
            <label className={s.field} htmlFor="mission-pkr"><span>Amount transferred (PKR)</span><input id="mission-pkr" type="number" inputMode="decimal" min="1" max="10000000" step="0.01" value={manualAmountPkr} onChange={event => setManualAmountPkr(event.target.value)} required /></label>
            <label className={s.field} htmlFor="mission-sender"><span>Sender account name</span><input id="mission-sender" minLength={2} maxLength={120} value={senderName} onChange={event => setSenderName(event.target.value)} required /></label>
            <label className={s.field} htmlFor="mission-transfer-reference"><span>Transaction reference / ID</span><input id="mission-transfer-reference" maxLength={120} value={referenceKey} onChange={event => setReferenceKey(event.target.value)} required /></label>
            <label className={s.field} htmlFor="mission-transfer-notes"><span>Transfer notes (optional)</span><textarea id="mission-transfer-notes" maxLength={500} value={manualNotes} onChange={event => setManualNotes(event.target.value)} /></label>
            {monthly && <p>This is a monthly giving pledge, not an automatic subscription. Submit each future transfer for verification.</p>}
          </div>
        )}

        <div className={s.summary} data-monthly={monthly ? "" : undefined}>
          <GivingSeal monthly={monthly} />
          <p aria-live="polite" className={s.summaryText}>
            <strong key={shownAmount} className={s.summaryAmount}>{shownAmount}</strong>{" "}
            <span className={s.summaryFreq}>{monthly ? (isManual ? "monthly pledge" : "each month") : "one-time"}</span>
            <span className={s.summaryPurpose}>{missionPurposeLabel(purpose)}</span>
          </p>
        </div>

        {error && !managementToken && <p className={s.error} role="alert">{error}</p>}
        <button className={`${s.btnTeal} ${s.submit}`} type="submit" disabled={loading || !paymentAvailable}>
          <span>{loading ? (isManual ? "Submitting transfer details…" : "Opening secure checkout…") : isManual ? "Submit transfer for verification" : paymentMethod === "PAYPAL" ? "Continue to PayPal" : "Continue to secure donation"}</span>
          <Arrow />
        </button>
        {paymentAvailable ? (
          <p className={s.payNote}><Lock />{isManual ? "Your transfer will be reviewed by TGA before confirmation." : "Payment details are entered securely on " + (paymentMethod === "PAYPAL" ? "PayPal." : "Stripe.")}</p>
        ) : (
          <p className={`${s.payNote} ${s.unavailable}`}>Online contributions are temporarily unavailable. <a href={`mailto:${missionContactEmail}?subject=Supporting%20TGA`}>Contact our team</a> to discuss supporting the mission.</p>
        )}
        {monthly && !isManual && <p className={s.small}>Monthly giving renews until cancelled. Manage future payments using the link in your acknowledgment.</p>}
        <p className={s.small}>By continuing, you agree to the <a href={contributionTermsUrl} target="_blank" rel="noopener noreferrer">Contribution &amp; Donation Policy</a>.</p>
        {manualReference && <p className={s.confirmed} role="status">Transfer submitted for admin review. Reference: <strong>{manualReference}</strong>. It is not yet confirmed as received.</p>}
      </form>
    </aside>
  );
}
