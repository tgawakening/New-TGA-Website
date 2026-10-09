"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/home/sections/header";
import { Footer } from "@/components/home/sections/footer";
import { companyRegisterUrl, missionContactEmail, missionPurposes, missionPurposeLabel, type GivingFrequency, type MissionPurpose } from "@/lib/mission-support";
import type { MissionSupportConfig } from "@/lib/mission-support-config";
import "./mission-support.css";

const amounts = [10, 25, 50, 100, 200] as const;
const storageKey = "tga-mission-giving-selection";
type Receipt = { status: string; amountGbp: number; frequency: string; purpose: string; reference: string; managementToken?: string };

function Icon({ name }: { name: "arrow" | "lock" | "book" | "heart" | "people" | "plus" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "arrow" && <path d="M4 12h15m-6-6 6 6-6 6" />}
    {name === "lock" && <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" /></>}
    {name === "book" && <><path d="M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2ZM12 6v15" /></>}
    {name === "heart" && <path d="M12 20 4 12a5 5 0 0 1 8-6 5 5 0 0 1 8 6Z" />}
    {name === "people" && <><circle cx="9" cy="7" r="3" /><path d="M3 20v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2" /></>}
    {name === "plus" && <path d="M12 4v16M4 12h16" />}
  </svg>;
}

export default function MissionSupportExperience({ config }: { config: MissionSupportConfig }) {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLElement>(null);
  const purposeRef = useRef<HTMLSelectElement>(null);
  const requestRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const [frequency, setFrequency] = useState<GivingFrequency>("MONTHLY");
  const [amount, setAmount] = useState<number | "other">(25);
  const [customAmount, setCustomAmount] = useState("");
  const [purpose, setPurpose] = useState<MissionPurpose>("WHERE_NEEDED");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [stickyVisible, setStickyVisible] = useState(false);
  const [restored, setRestored] = useState(false);
  const [managementToken, setManagementToken] = useState("");
  const activeAmount = amount === "other" ? Number(customAmount) : amount;
  const formattedAmount = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number.isFinite(activeAmount) ? activeAmount : 0);

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

  function scrollToGiving(nextPurpose?: MissionPurpose, monthly = false) {
    if (nextPurpose) setPurpose(nextPurpose);
    if (monthly) setFrequency("MONTHLY");
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
    if (!Number.isFinite(activeAmount) || activeAmount < 1 || activeAmount > 10000 || Math.abs(activeAmount * 100 - Math.round(activeAmount * 100)) > 0.000001) { setError("Please enter an amount between £1 and £10,000, using no more than two decimal places."); return; }
    if (!config.checkoutAvailable) { setError("Online contributions are temporarily unavailable. Please contact our team."); return; }
    if (loading) return;
    setLoading(true);
    const fingerprint = JSON.stringify({ name: name.trim(), email: email.trim(), frequency, purpose, activeAmount });
    if (requestRef.current?.fingerprint !== fingerprint) requestRef.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const response = await fetch("/api/mission-support/stripe-checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: name.trim(), email: email.trim(), amountGbp: activeAmount, frequency, purpose, requestId: requestRef.current!.id }) });
      const data = await response.json();
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "We couldn't open secure checkout. Please try again.");
      const url = new URL(data.checkoutUrl);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error("Invalid checkout destination.");
      window.location.assign(url.toString());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn't open secure checkout. Please try again."); }
    finally { setLoading(false); }
  }

  const faqs = [
    ["Where does my contribution go?", config.allocationNotice || "Choose an area of work in the form. Our team can explain current funding needs and allocation arrangements before you contribute. Contact us if your contribution requires a specific restriction."],
    ["Can I select a specific programme?", "You can select learning access, existing programmes, future initiatives, or where most needed. For a contribution restricted to one specific programme, please discuss the arrangements with TGA before giving."],
    ["How do monthly contributions work?", "Monthly support uses a recurring GBP payment through Stripe. The amount and frequency are shown at checkout. Your selected funding purpose is kept with your contribution record."],
    ["How do I cancel a recurring contribution?", "Use the secure management link in your payment acknowledgment to manage or cancel future monthly payments. If the link is unavailable, contact TGA for assistance. The portal shows the applicable cancellation date; cancelling future payments does not refund previous payments."],
    ["Will I receive a payment confirmation?", "A payment acknowledgment is sent after the payment provider confirms a successful contribution. Returning to this page alone does not confirm payment. Please retain the provider's receipt and contact us if you need help."],
    ["How does TGA report the use of funds?", "You can view the company's public filings through Companies House. Contact TGA for programme-specific funding information. We publish programme impact reports here when verified reports are available."],
    ["Is my payment information secure?", "When online giving is available, payment details are entered on Stripe's hosted checkout, not stored on TGA's website. Card and available wallet options are shown by Stripe according to your device and account settings."],
    ["Is Gift Aid available?", "Gift Aid is not offered on this page. The Global Awakening operates as GLOBAL AWAKENING CIC. Contributions are not presented as tax-deductible charitable donations."],
    ["What if I need a refund?", "Contact TGA with your payment reference so the team can review your request under the applicable contribution terms. Course refund terms do not automatically apply to mission contributions."],
  ];

  return <>
    <Header />
    <main className="mission-support" id="mission-top">
      <a href="#mission-giving" className="ms-skip">Skip to contribution form</a>
      {confirmationMessage || managementToken ? <section className="ms-return ms-container" aria-label="Your contribution">
        {confirmationMessage && <p role="status">{confirmationMessage}</p>}
        {receipt && <p><strong>{new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(receipt.amountGbp)}</strong> · {receipt.purpose} · {receipt.frequency === "MONTHLY" ? "Monthly" : "One-time"} · Reference {receipt.reference}</p>}
        {managementToken && <button className="ms-button ms-button-dark" onClick={() => void manageSupport()} disabled={loading}>Manage monthly support <Icon name="arrow" /></button>}
        {error && <p role="alert">{error}</p>}
      </section> : null}

      <section className="ms-hero ms-container" aria-labelledby="mission-title">
        <div className="ms-hero-copy">
          <p className="ms-eyebrow">Support The Global Awakening</p>
          <h1 id="mission-title">Help shape the<br /><em>next generation.</em></h1>
          <p className="ms-lead">Support meaningful education, empower future leaders, and help build initiatives serving the Ummah.</p>
          <p className="ms-hero-detail">Your contribution helps expand access to learning, sustain educational programmes, and develop new opportunities for individuals and families.</p>
          <a href="#mission-purposes" className="ms-text-link">See where your support goes <Icon name="arrow" /></a>
        </div>

        <aside id="mission-giving" className="ms-giving" ref={formRef} aria-labelledby="giving-title">
          <div className="ms-giving-heading"><span className="ms-giving-symbol"><Icon name="heart" /></span><span>Education. Character. Community.</span></div>
          <h2 id="giving-title">Make a meaningful contribution.</h2>
          <p>Choose how you would like to support the mission.</p>
          {config.testMode && config.checkoutAvailable && <p className="ms-test-notice">Test checkout · no real contribution will be collected.</p>}
          <form onSubmit={submit}>
            <fieldset className="ms-frequency"><legend className="ms-sr-only">Giving frequency</legend>
              <button type="button" aria-pressed={frequency === "MONTHLY"} onClick={() => setFrequency("MONTHLY")}>Monthly <span>Keep good work going</span></button>
              <button type="button" aria-pressed={frequency === "ONE_TIME"} onClick={() => setFrequency("ONE_TIME")}>One-time <span>Give when you can</span></button>
            </fieldset>
            <fieldset className="ms-amounts"><legend>Choose your amount <span>GBP</span></legend>
              <div>{amounts.map(value => <button key={value} type="button" aria-pressed={amount === value} onClick={() => setAmount(value)}>£{value}</button>)}<button type="button" aria-pressed={amount === "other"} onClick={() => setAmount("other")}>Other</button></div>
            </fieldset>
            {amount === "other" && <label className="ms-field" htmlFor="mission-custom">Your amount in GBP<input id="mission-custom" name="amount" inputMode="decimal" type="number" min="1" max="10000" step="0.01" placeholder="e.g. 35.00" value={customAmount} onChange={event => setCustomAmount(event.target.value)} required aria-describedby="mission-amount-help" /><small id="mission-amount-help">£1–£10,000. Up to two decimal places.</small></label>}
            <label className="ms-field" htmlFor="mission-purpose">Where would you like your contribution to go?<select ref={purposeRef} id="mission-purpose" value={purpose} onChange={event => setPurpose(event.target.value as MissionPurpose)}>{missionPurposes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <div className="ms-donor-fields"><label className="ms-field" htmlFor="mission-name">Your name<input id="mission-name" name="name" autoComplete="name" minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} required /></label><label className="ms-field" htmlFor="mission-email">Email for your acknowledgment<input id="mission-email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required /></label></div>
            <p className="ms-selection" aria-live="polite"><strong>{formattedAmount}</strong> {frequency === "MONTHLY" ? "each month" : "one-time"}<span>{missionPurposeLabel(purpose)}</span></p>
            {error && !managementToken && <p className="ms-error" role="alert">{error}</p>}
            <button className="ms-button ms-button-dark ms-submit" type="submit" disabled={loading || !config.checkoutAvailable}>{loading ? "Opening secure checkout…" : "Continue to Donate"}<Icon name="arrow" /></button>
            {config.checkoutAvailable ? <p className="ms-payment-note"><Icon name="lock" /> Payment details are entered securely on Stripe.</p> : <p className="ms-payment-note ms-unavailable">Online contributions are temporarily unavailable. <a href={`mailto:${missionContactEmail}?subject=Supporting%20TGA`}>Contact our team</a> to discuss supporting the mission.</p>}
            {frequency === "MONTHLY" && <p className="ms-small-note">Monthly giving renews until cancelled. Manage future payments using the link in your acknowledgment.</p>}
            {config.policyUrl && <p className="ms-small-note">By continuing, you agree to the <a href={config.policyUrl} target="_blank" rel="noopener noreferrer">contribution terms</a>.</p>}
          </form>
        </aside>

        <figure className="ms-hero-art"><div><Image src={config.heroImage} alt="The Global Awakening educational programme" fill sizes="(max-width: 767px) 100vw, 50vw" priority /></div><figcaption>{config.heroImageCaption}</figcaption></figure>
      </section>

      <section className="ms-purpose ms-section" aria-labelledby="purpose-title">
        <div className="ms-container ms-purpose-layout"><div><p className="ms-eyebrow">The purpose behind your contribution</p><h2 id="purpose-title">More than a course.<br /><em>A vision for generations.</em></h2><p>The Global Awakening connects Islamic knowledge with practical learning, character development, and meaningful service. Your support helps make that journey accessible to more people.</p><div className="ms-principles"><p><span>01 / Learn</span>Access meaningful Islamic education.</p><p><span>02 / Grow</span>Develop knowledge, character, and practical skills.</p><p><span>03 / Serve</span>Apply learning to benefit families and communities.</p></div></div><div className="ms-collage"><figure><Image src="/gen-mumin-hero-poster.jpeg" alt="Gen-Mumin orientation programme artwork" width={1122} height={1402} sizes="(max-width: 767px) 70vw, 27vw" /><figcaption>Gen-Mumin · programme artwork</figcaption></figure><figure><Image src="/images/upcoming-courses/ethics-of-debate.png" alt="TGA's planned Ethics of Debate programme poster" width={1055} height={1491} sizes="(max-width: 767px) 50vw, 20vw" /><figcaption>Ethics of Debate · planned programme</figcaption></figure></div></div>
      </section>

      <section id="mission-purposes" className="ms-section ms-container" aria-labelledby="purposes-title">
        <div className="ms-section-heading"><p className="ms-eyebrow">Choose what your contribution supports</p><h2 id="purposes-title">Choose the difference<br /><em>you want to make.</em></h2><p>Every contribution supports an area of meaningful work. Select a cause close to your heart.</p></div>
        <div className="ms-causes">{missionPurposes.map((item, index) => <article className={`ms-cause ms-cause-${index + 1}`} key={item.id}><div className="ms-cause-art"><Image src={item.image} alt={item.imageAlt} fill sizes="(max-width: 767px) 100vw, 45vw" /><span>{item.tag}</span></div><div className="ms-cause-copy"><span className="ms-number">0{index + 1}</span><h3>{item.title}</h3><p>{item.copy}</p><button className="ms-text-link" onClick={() => scrollToGiving(item.id)}>{item.action}<Icon name="arrow" /></button></div></article>)}</div>
        <p className="ms-allocation-note"><Icon name="book" />{config.allocationNotice || "Tell us which area you would like to support. If your contribution requires a specific restriction, please contact TGA to agree the arrangements before giving."}</p>
      </section>

      <section className="ms-impact ms-section" aria-labelledby="impact-title"><div className="ms-container"><p className="ms-eyebrow">From support to meaningful learning</p><h2 id="impact-title">What your support<br /><em>helps make possible.</em></h2><ol className="ms-impact-path"><li><span>01</span><h3>Access for learners</h3><p>Support for families facing financial barriers. TGA offers a confidential fee-waiver application route.</p><Link href="/seerah/fee-waiver">Explore learning access <Icon name="arrow" /></Link></li><li><span>02</span><h3>Teaching & resources</h3><p>Programme delivery, guided lessons, and educational materials that connect knowledge with practice.</p></li><li><span>03</span><h3>Programme development</h3><p>Planning and preparation for new learning, family-development, and community initiatives.</p></li><li><span>04</span><h3>Sustainable delivery</h3><p>The coordination, technology, and administration needed to support a consistent learning experience.</p></li></ol><p className="ms-impact-caption">These are areas of mission-related work, not fixed outcomes purchased by a particular contribution amount.</p></div></section>

      <section id="mission-work" className="ms-section ms-container" aria-labelledby="work-title"><div className="ms-section-heading"><p className="ms-eyebrow">Our work in action</p><h2 id="work-title">See the work<br /><em>you are helping sustain.</em></h2></div>
        <article className="ms-work-row"><figure><Image src="/Gen-Mumin.jpeg" alt="Gen-Mumin's published learning programme poster" width={640} height={800} sizes="(max-width: 767px) 100vw, 40vw" /><figcaption>Published programme artwork</figcaption></figure><div><span className="ms-status">Ongoing programme</span><h3>Gen-Mumin</h3><p>A connected learning journey for children: Arabic–Tajweed, Seerah, life skills and leadership, Qabail community building, and parental sessions.</p><p>House activities encourage belonging and shared responsibility, while parents stay connected to learning at home.</p><Link className="ms-text-link" href="/projects/gen-mumin">Discover Gen-Mumin <Icon name="arrow" /></Link></div></article>
        <article className="ms-work-row ms-work-reverse"><figure><Image src="/seerah slide-3.jpg" alt="TGA Seerah and Prophetic Strategies course artwork" width={1280} height={1600} sizes="(max-width: 767px) 100vw, 40vw" /><figcaption>Published course artwork</figcaption></figure><div><span className="ms-status">Ongoing programme</span><h3>Seerah & Prophetic leadership</h3><p>Learners study Prophetic guidance, reflect on principled leadership, and explore its relevance to personal and community challenges.</p><p>Supporting sustained delivery helps this learning remain structured, thoughtful, and accessible.</p><Link className="ms-text-link" href="/seerah">Explore the Seerah programme <Icon name="arrow" /></Link></div></article>
        <article className="ms-future"><div><p className="ms-eyebrow">Future initiatives · in development</p><h3>Build the foundations<br />for what comes next.</h3></div><div><p>TGA&apos;s wider vision includes family development, education, leadership, and community service. New initiatives require planning and resources before they can become active programmes.</p><Link className="ms-text-link" href="/about">Understand the wider vision <Icon name="arrow" /></Link></div></article>
      </section>

      <section className="ms-accountability ms-section" aria-labelledby="accountability-title"><div className="ms-container ms-accountability-layout"><div><p className="ms-eyebrow">Your support, our responsibility</p><h2 id="accountability-title">Know where your<br /><em>contribution goes.</em></h2><p>Giving should come with clarity. Ask about funding priorities, delivery costs, and the work your contribution is intended to support.</p><div className="ms-company"><strong>GLOBAL AWAKENING CIC</strong><p>Community Interest Company · England and Wales<br />Company number 15523255<br />128 City Road, London, EC1V 2NX</p><a href={companyRegisterUrl} target="_blank" rel="noopener noreferrer">View the company record <Icon name="arrow" /></a><small>Gift Aid is not offered on this page.</small></div></div><div className="ms-accountability-items"><article><span>01</span><div><h3>Funding priorities</h3><p>Discuss current programme needs and any restrictions before making a contribution.</p>{config.policyUrl && <a href={config.policyUrl} target="_blank" rel="noopener noreferrer">Contribution terms <Icon name="arrow" /></a>}</div></article><article><span>02</span><div><h3>Delivery & operational costs</h3><p>Teaching, resources, coordination, and administration all form part of sustainable educational work. Ask our team for the relevant funding breakdown.</p></div></article><article><span>03</span><div><h3>Financial reporting</h3><p>Company accounts and statutory filings are available through the public company register.</p><a href={`${companyRegisterUrl}/filing-history`} target="_blank" rel="noopener noreferrer">View public filings <Icon name="arrow" /></a></div></article><article><span>04</span><div><h3>Programme information & updates</h3><p>Contact TGA for available programme funding information and updates.</p>{config.impactReportUrl ? <a href={config.impactReportUrl} target="_blank" rel="noopener noreferrer">Read the verified impact report <Icon name="arrow" /></a> : <a href={`mailto:${missionContactEmail}?subject=TGA%20programme%20funding%20information`}>Ask about programme progress <Icon name="arrow" /></a>}</div></article></div></div></section>

      <section className="ms-monthly ms-section" aria-labelledby="monthly-title"><div className="ms-container ms-monthly-layout"><div><p className="ms-eyebrow">Regular support. Lasting intention.</p><h2 id="monthly-title">Help good work<br /><em>continue.</em></h2><p>Small, regular contributions help educational programmes plan and grow.</p><button className="ms-button ms-button-dark" onClick={() => scrollToGiving(undefined, true)}>Become a Monthly Supporter <Icon name="arrow" /></button></div><div><Icon name="book" /><p className="ms-reminder">Beneficial knowledge is among the deeds whose benefit can continue beyond a person&apos;s lifetime.</p><a href="https://sunnah.com/muslim:1631" target="_blank" rel="noopener noreferrer">A reminder from Sahih Muslim 1631</a><p>Give with sincerity and the hope of ongoing benefit, seeking Allah&apos;s reward. Monthly support can help sustain teaching, learning resources, and programme coordination.</p><p className="ms-small-note">Manage future payments with the secure link in your acknowledgment. No particular spiritual reward or educational outcome is guaranteed.</p></div></div></section>

      <section className="ms-learning ms-section ms-container" aria-labelledby="learning-title"><p className="ms-eyebrow">Learning beyond the classroom</p><h2 id="learning-title">Knowledge to practise.<br /><em>Values to live.</em></h2><p>Explore the activities described in TGA&apos;s learning programmes.</p><div className="ms-learning-examples"><article><Icon name="book" /><h3>Understanding & recitation</h3><p>Arabic vocabulary and guided Tajweed practice connect understanding with Quran recitation.</p></article><article><Icon name="people" /><h3>Shared responsibility</h3><p>Qabail houses, teamwork, and house points encourage participation and belonging.</p></article><article><Icon name="heart" /><h3>Learning together at home</h3><p>Parental sessions support Tarbiyah and a consistent connection between home and programme learning.</p></article></div><Link className="ms-text-link" href="/projects/gen-mumin">Explore the programme journey <Icon name="arrow" /></Link></section>

      <section className="ms-final"><div className="ms-container"><p className="ms-eyebrow">A shared purpose</p><h2>Be part of<br /><em>what comes next.</em></h2><p>Your support helps make meaningful education accessible, sustain ongoing programmes, and build opportunities for future generations.</p><div><button className="ms-button ms-button-light" onClick={() => scrollToGiving()}>Support the Mission <Icon name="arrow" /></button><a className="ms-text-link" href="#mission-work">Explore Our Work <Icon name="arrow" /></a></div></div></section>

      <section className="ms-faq ms-section ms-container" aria-labelledby="faq-title"><div><p className="ms-eyebrow">A little more clarity</p><h2 id="faq-title">Your questions,<br /><em>answered.</em></h2><p>Need to discuss your contribution?<br /><a href={`mailto:${missionContactEmail}`}>Contact the TGA team <Icon name="arrow" /></a></p></div><div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<Icon name="plus" /></summary><p>{answer}</p></details>)}</div></section>
    </main>
    <div className="ms-mission-footer"><Footer /></div>
    {stickyVisible && <div className="ms-mobile-action"><span>{formattedAmount}<small>{frequency === "MONTHLY" ? "Monthly support" : "One-time support"}</small></span><button className="ms-button ms-button-dark" onClick={() => scrollToGiving()}>Support the Mission <Icon name="arrow" /></button></div>}
  </>;
}
