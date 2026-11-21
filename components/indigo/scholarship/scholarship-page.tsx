"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { SIRAH_SCHOLARSHIP_BATCH, SIRAH_SCHOLARSHIP_LIMIT, scholarshipQuestions, arabicLevels } from "@/lib/sirah/scholarship";
import { prepareSirahReceipt, SIRAH_RECEIPT_ACCEPT, sirahReceiptSelectionError } from "@/lib/sirah/receipt-upload";
import { SIRAH_TITLE, formatSirahMoney } from "@/lib/sirah/catalog";
import type { ScholarshipCardOption } from "@/lib/sirah/scholarship-card";
import { Button } from "../button";
import { Wordmark } from "../nav";
import { Rosette } from "../ornaments";
import { Eyebrow } from "../section-heading";
import { liveLinks } from "../site-links";
import s from "./scholarship.module.css";

type Details = {
  seerahReflection: string; arabicLevel: string; arabicExperience: string; deenUnderstanding: string;
  communityContribution: string; missionSupport: string; skillsResources: string; actionPlan: string;
  skillsStatus: string; skillLearningPlan: string; skillsLearningCommitment: boolean;
  weeklyHours: string; missionCommitment: boolean; selectionAcknowledgement: boolean;
};

type FormState = {
  scholarshipDetails: Details;
  fullName: string;
  email: string;
  whatsapp: string;
  age: string;
  cityCountry: string;
  occupation: string;
  knowledgeLevel: string;
  previousSeerahStudy: string;
  currentInvolvement: string;
  whatDrawsYou: string;
  howItBenefits: string;
  mostInterestingTopic: string;
  whyThisTopic: string;
  canAttendRegularly: string;
  attendedOrientation: boolean;
  contributionPreference: "" | "FULL_SCHOLARSHIP" | "PARTIAL_CONTRIBUTION";
  /** The tier: PKR a month on the manual route, the matching regional share by card. */
  monthlyContributionPkr: "" | "500" | "1000";
  contributionRoute: "MANUAL" | "CARD";
  cardCountry: string;
  manualPaymentMethod: "" | "BANK_TRANSFER" | "JAZZCASH";
  manualSenderName: string;
  manualSenderNumber: string;
  manualReferenceKey: string;
  manualNotes: string;
  reasonForWaiver: string;
  howHeard: string;
  adabCommitment: boolean;
  genuineFinancialNeed: boolean;
};

const emptyManual = { manualPaymentMethod: "", manualSenderName: "", manualSenderNumber: "", manualReferenceKey: "", manualNotes: "" } as const;

const initialForm = (cardCountry: string): FormState => ({
  scholarshipDetails: {
    seerahReflection: "", arabicLevel: "", arabicExperience: "", deenUnderstanding: "",
    communityContribution: "", missionSupport: "", skillsResources: "", actionPlan: "",
    skillsStatus: "", skillLearningPlan: "", skillsLearningCommitment: false,
    weeklyHours: "", missionCommitment: false, selectionAcknowledgement: false,
  },
  fullName: "",
  email: "",
  whatsapp: "",
  age: "",
  cityCountry: "",
  occupation: "",
  knowledgeLevel: "Beginner",
  previousSeerahStudy: "",
  currentInvolvement: "",
  whatDrawsYou: "",
  howItBenefits: "",
  mostInterestingTopic: "",
  whyThisTopic: "",
  canAttendRegularly: "",
  attendedOrientation: false,
  contributionPreference: "",
  monthlyContributionPkr: "",
  contributionRoute: "MANUAL",
  cardCountry,
  ...emptyManual,
  reasonForWaiver: "",
  howHeard: "",
  adabCommitment: false,
  genuineFinancialNeed: false,
});

/* The manual transfer accounts, exactly as the page has always shown them. */
const meezan = [
  { label: "Account title", value: "AREEJ FATIMA" },
  { label: "Account number", value: "98900114432111" },
  { label: "IBAN", value: "PK96MEZN0098900114432111" },
];
const jazzcash = [
  { label: "Account name", value: "Areej Fatima" },
  { label: "Mobile account", value: "03244517741" },
];

const sections = [
  { id: "personal", title: "Personal information" },
  { id: "background", title: "Islamic background" },
  { id: "course", title: "Why this course" },
  { id: "service", title: "Service and mission" },
  { id: "commitment", title: "Commitment and need" },
  { id: "agreements", title: "Agreements" },
] as const;

export function ScholarshipPage({
  countries,
  cardOptions,
  detectedCountry,
}: {
  countries: Array<{ code: string; name: string }>;
  /** Countries where the Sīrah Stripe config allows a one-time card payment. */
  cardOptions: Record<string, ScholarshipCardOption>;
  detectedCountry?: string;
}) {
  const cardEnabled = Object.keys(cardOptions).length > 0;
  const defaultCardCountry = detectedCountry && cardOptions[detectedCountry] ? detectedCountry : "";
  const [form, setForm] = useState<FormState>(() => initialForm(defaultCardCountry));
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptKey, setReceiptKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isPartialContribution = form.contributionPreference === "PARTIAL_CONTRIBUTION";
  const byCard = isPartialContribution && form.contributionRoute === "CARD";
  const isManual = isPartialContribution && !byCard;
  const cardOption = form.cardCountry ? cardOptions[form.cardCountry] : undefined;
  const cardCountryName = useMemo(() => countries.find((c) => c.code === form.cardCountry)?.name, [countries, form.cardCountry]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const setDetail = <K extends keyof Details>(key: K, value: Details[K]) =>
    setForm((prev) => ({ ...prev, scholarshipDetails: { ...prev.scholarshipDetails, [key]: value } }));
  const text = (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    set(key, event.target.value as never);

  function chooseRoute(route: FormState["contributionRoute"]) {
    // Switching route clears the other route's inputs, so nothing stale is sent.
    setForm((prev) => ({ ...prev, contributionRoute: route, monthlyContributionPkr: "", ...emptyManual }));
    setReceipt(null);
    setReceiptKey((n) => n + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.contributionPreference) {
      setError("Please tell us whether you need a complete scholarship or can pay some amount monthly.");
      return;
    }
    if (form.contributionPreference === "PARTIAL_CONTRIBUTION" && !form.monthlyContributionPkr) {
      setError("Please choose how much you are willing to pay monthly.");
      return;
    }
    if (byCard && !cardOption) {
      setError("Card payment is not available for the selected country. Choose Meezan Bank or JazzCash, or a full scholarship.");
      return;
    }
    if (isManual && !form.manualSenderName.trim()) {
      setError("Please provide sender name for payment verification.");
      return;
    }
    if (isManual && !form.manualSenderNumber.trim()) {
      setError("Please provide sender number for payment verification.");
      return;
    }
    if (isManual && !form.manualReferenceKey.trim()) {
      setError("Please provide transfer reference ID before submitting.");
      return;
    }
    if (isManual && (!form.manualPaymentMethod || !receipt)) {
      setError("Select your transfer method and attach a JPG, PNG, WebP or PDF receipt.");
      return;
    }
    if (isManual && receipt && sirahReceiptSelectionError(receipt)) {
      setError(sirahReceiptSelectionError(receipt));
      return;
    }
    if (!form.adabCommitment) {
      setError("You must commit to adab and etiquette before submitting.");
      return;
    }
    if (!form.genuineFinancialNeed) {
      setError("Please confirm genuine financial need before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const body = new FormData();
      body.set("details", JSON.stringify({
        ...form,
        manualPaymentMethod: isManual ? form.manualPaymentMethod : undefined,
        // Sent only for a card contribution; the server re-prices it.
        contributionRoute: byCard ? "CARD" : "MANUAL",
        cardCountry: byCard ? form.cardCountry : "",
        scholarshipBatch: SIRAH_SCHOLARSHIP_BATCH,
        age: Number(form.age),
        courseSlug: "seerah-course",
        courseTitle: SIRAH_TITLE,
        listedPrice: "Approved regional fees — see /seerah",
      }));
      if (isManual && receipt) body.set("receipt", await prepareSirahReceipt(receipt));
      const response = await fetch("/api/fee-waiver/apply", { method: "POST", body });

      const data = (await response.json()) as {
        error?: string;
        details?: { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
      };
      if (!response.ok) {
        const detailMessage = data.details?.formErrors?.[0] ?? Object.values(data.details?.fieldErrors ?? {}).flat().find(Boolean);
        throw new Error(detailMessage || data.error || "Application could not be submitted.");
      }

      setSuccess(
        byCard
          ? "Your Batch 4 scholarship application has been submitted for review. There are 10 places; an application does not guarantee an award. Nothing has been charged: if you are selected, we will email you a secure card payment link."
          : "Your Batch 4 scholarship application has been submitted for review. There are 10 places; an application does not guarantee an award. We will email you after review.",
      );
      setForm(initialForm(defaultCardCountry));
      setReceipt(null);
      setReceiptKey((n) => n + 1);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Application error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={s.page}>
      <a href="#scholarship-form" className={s.skip}>Skip to the application form</a>
      <header className={s.header}>
        <Wordmark href={liveLinks.home} />
        <Link href={liveLinks.seerah} className={s.back}>
          <span aria-hidden="true">←</span> Back to course
        </Link>
      </header>

      <section className={s.hero} aria-labelledby="scholarship-title">
        <Rosette className={s.heroRosette} accentClassName={s.heroRosetteAccent} />
        <div className={s.heroInner}>
          <Eyebrow>Batch 4 · Scholarship application</Eyebrow>
          <h1 id="scholarship-title" className={s.title}>Apply for a Sīrah Scholarship</h1>
          <p className={s.lede}>For committed learners ready to learn, contribute and serve.</p>
          <ul className={s.facts} aria-label="Scholarship at a glance">
            <li><strong>{SIRAH_SCHOLARSHIP_LIMIT}</strong><span>scholarships · Batch 4</span></li>
            <li><strong>Manual</strong><span>selection by the team</span></li>
            <li><strong>Private</strong><span>answers seen only by reviewers</span></li>
          </ul>
        </div>
      </section>

      <div className={s.layout}>
        <aside className={s.aside} aria-label="Scholarship selection summary">
          <div className={s.asideCard}>
            <h2 className={s.asideTitle}>{SIRAH_SCHOLARSHIP_LIMIT} scholarships · Batch 4</h2>
            <p>Selection considers Sīrah knowledge, basic Arabic, Islamic foundations and commitment to community service. Bring useful skills or commit to learning them to support TGA’s mission. Awards follow review and are not guaranteed.</p>
            <dl className={s.ribbon}>
              <div><dt>Course</dt><dd>{SIRAH_TITLE}</dd></div>
              <div><dt>Cohort</dt><dd>Batch 4</dd></div>
              <div><dt>Review mode</dt><dd>10 places · Manual selection</dd></div>
            </dl>
            <nav aria-label="Form sections" className={s.toc}>
              <ol>
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}><span aria-hidden="true">{index + 1}</span>{section.title}</a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </aside>

        <main className={s.main}>
          <form id="scholarship-form" onSubmit={handleSubmit} className={s.form}>
            <Section id="personal" index={1} title="Personal information">
              <div className={s.grid}>
                <Field label="Name" required>
                  <input name="fullName" autoComplete="name" value={form.fullName} onChange={text("fullName")} required />
                </Field>
                <Field label="Email" required>
                  <input name="email" autoComplete="email" type="email" value={form.email} onChange={text("email")} required />
                </Field>
                <Field label="WhatsApp" required hint="With country code, for example +923001234567.">
                  <input name="whatsapp" autoComplete="tel" inputMode="tel" value={form.whatsapp} onChange={text("whatsapp")} placeholder="+923001234567" required />
                </Field>
                <Field label="Age" required>
                  <input name="age" type="number" inputMode="numeric" min={10} max={120} value={form.age} onChange={text("age")} required />
                </Field>
                <Field label="City & country" required>
                  <input name="cityCountry" autoComplete="address-level2" value={form.cityCountry} onChange={text("cityCountry")} placeholder="Gujranwala, Pakistan" required />
                </Field>
                <Field label="Occupation" required>
                  <input name="occupation" autoComplete="organization-title" value={form.occupation} onChange={text("occupation")} required />
                </Field>
              </div>
            </Section>

            <Section id="background" index={2} title="Islamic background">
              <div className={s.grid}>
                <Field label="Knowledge level" required>
                  <select name="knowledgeLevel" value={form.knowledgeLevel} onChange={text("knowledgeLevel")} required>
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </Field>
                <Field label="Arabic understanding" required>
                  <select name="arabicLevel" value={form.scholarshipDetails.arabicLevel} onChange={(event) => setDetail("arabicLevel", event.target.value)} required>
                    <option value="">Select your current level</option>
                    {Object.entries(arabicLevels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Prior Sīrah study and familiarity" required hint="At least 20 characters.">
                <input name="previousSeerahStudy" minLength={20} maxLength={2000} placeholder="Books, teachers, courses or independent study" value={form.previousSeerahStudy} onChange={text("previousSeerahStudy")} required />
              </Field>
              {(["seerahReflection", "arabicExperience", "deenUnderstanding"] as const).map((key) => (
                <Field key={key} label={scholarshipQuestions[key]} required>
                  <textarea name={key} value={form.scholarshipDetails[key]} onChange={(event) => setDetail(key, event.target.value)} rows={3} minLength={20} maxLength={2000} required />
                </Field>
              ))}
              <Field label="Current community or Islamic learning involvement" optional>
                <input name="currentInvolvement" value={form.currentInvolvement} onChange={text("currentInvolvement")} />
              </Field>
            </Section>

            <Section id="course" index={3} title="Why this course">
              <Field label="What draws you to this course?" required>
                <textarea name="whatDrawsYou" value={form.whatDrawsYou} onChange={text("whatDrawsYou")} rows={3} required />
              </Field>
              <Field label="How will this course benefit you?" required>
                <textarea name="howItBenefits" value={form.howItBenefits} onChange={text("howItBenefits")} rows={4} required />
              </Field>
              <div className={s.grid}>
                <Field label="Most interesting topic" required>
                  <input name="mostInterestingTopic" value={form.mostInterestingTopic} onChange={text("mostInterestingTopic")} required />
                </Field>
                <Field label="Why this topic?" required>
                  <input name="whyThisTopic" value={form.whyThisTopic} onChange={text("whyThisTopic")} required />
                </Field>
              </div>
            </Section>

            <Section id="service" index={4} title="Service, mission & contribution">
              {(["communityContribution", "missionSupport", "skillsResources", "actionPlan"] as const).map((key) => (
                <Field key={key} label={scholarshipQuestions[key]} required>
                  <textarea name={key} value={form.scholarshipDetails[key]} onChange={(event) => setDetail(key, event.target.value)} rows={3} minLength={20} maxLength={2000} required />
                </Field>
              ))}
              <Field label="Do you currently have skills you can contribute to mission or community work?" required>
                <select name="skillsStatus" value={form.scholarshipDetails.skillsStatus} onChange={(event) => setDetail("skillsStatus", event.target.value)} required>
                  <option value="">Choose an option</option>
                  <option value="CURRENT_SKILLS">Yes — I have skills to contribute</option>
                  <option value="LEARNING_REQUIRED">Not yet — I will identify and start learning a useful skill</option>
                </select>
              </Field>
              {form.scholarshipDetails.skillsStatus === "LEARNING_REQUIRED" ? (
                <Field label={scholarshipQuestions.skillLearningPlan} required>
                  <textarea name="skillLearningPlan" rows={3} minLength={20} maxLength={2000} value={form.scholarshipDetails.skillLearningPlan} onChange={(event) => setDetail("skillLearningPlan", event.target.value)} required />
                </Field>
              ) : null}
              <div className={s.note}>
                <p><strong>If you do not yet possess relevant skills, you must identify and begin learning skills needed for mission and community work.</strong> We consider willingness to develop useful skills alongside your current experience.</p>
                <p>Examples may include mentoring, study circles, translation, writing, design, teaching, organising or professional support. Describe what is realistic for your circumstances.</p>
              </div>
            </Section>

            <Section id="commitment" index={5} title="Commitment & need">
              <Field label="Hours you can realistically set aside each week for classes, study and contribution" required>
                <input name="weeklyHours" type="number" inputMode="decimal" min="0.5" max="80" step="0.5" value={form.scholarshipDetails.weeklyHours} onChange={(event) => setDetail("weeklyHours", event.target.value)} required />
              </Field>
              <Field label="How will you attend regularly and follow through?" required>
                <input name="canAttendRegularly" value={form.canAttendRegularly} onChange={text("canAttendRegularly")} placeholder="Describe your schedule and how you will manage other commitments" required />
              </Field>
              <label className={s.toggle}>
                <input type="checkbox" name="attendedOrientation" checked={form.attendedOrientation} onChange={(event) => set("attendedOrientation", event.target.checked)} />
                <span>I attended the orientation</span>
              </label>

              <fieldset className={s.contribution}>
                <legend>
                  How much are you willing to pay monthly?<span className={s.req} aria-hidden="true">*</span>
                </legend>
                <p className={s.hint}>Choose one option so we know whether you need a complete scholarship or can contribute a small amount each month.</p>

                <div className={s.choices}>
                  <label className={s.choice} data-active={form.contributionPreference === "FULL_SCHOLARSHIP" || undefined}>
                    <input
                      type="radio"
                      name="contributionPreference"
                      value="FULL_SCHOLARSHIP"
                      checked={form.contributionPreference === "FULL_SCHOLARSHIP"}
                      onChange={() => {
                        setReceipt(null);
                        setReceiptKey((n) => n + 1);
                        setForm((prev) => ({ ...prev, contributionPreference: "FULL_SCHOLARSHIP", monthlyContributionPkr: "", contributionRoute: "MANUAL", ...emptyManual }));
                      }}
                      required
                    />
                    <span>
                      <strong>No, I need complete scholarship</strong>
                      <small>Select this if you need the full fee waived.</small>
                    </span>
                  </label>
                  <label className={s.choice} data-active={isPartialContribution || undefined}>
                    <input
                      type="radio"
                      name="contributionPreference"
                      value="PARTIAL_CONTRIBUTION"
                      checked={isPartialContribution}
                      onChange={() => set("contributionPreference", "PARTIAL_CONTRIBUTION")}
                      required
                    />
                    <span>
                      <strong>I can afford some fees monthly</strong>
                      <small>Select this if you can still contribute a smaller monthly amount.</small>
                    </span>
                  </label>
                </div>

                {isPartialContribution ? (
                  <div className={s.partial}>
                    {cardEnabled ? (
                      <div className={s.step}>
                        <p className={s.stepTitle}><span aria-hidden="true">a</span>How will you pay?</p>
                        <div className={s.segmented} role="radiogroup" aria-label="Payment route">
                          <label data-active={!byCard || undefined}>
                            <input type="radio" name="contributionRoute" value="MANUAL" checked={!byCard} onChange={() => chooseRoute("MANUAL")} />
                            <span><strong>Meezan Bank or JazzCash</strong><small>Pakistan · PKR transfer now, with a receipt</small></span>
                          </label>
                          <label data-active={byCard || undefined}>
                            <input type="radio" name="contributionRoute" value="CARD" checked={byCard} onChange={() => chooseRoute("CARD")} />
                            <span><strong>Card</strong><small>Outside Pakistan · paid once, only if selected</small></span>
                          </label>
                        </div>
                      </div>
                    ) : null}

                    {byCard ? (
                      <>
                        <div className={s.step}>
                          <Field label="Country your card is billed in" required hint="Amounts are shown in that country’s currency.">
                            <select name="cardCountry" value={form.cardCountry} onChange={(event) => setForm((prev) => ({ ...prev, cardCountry: event.target.value, monthlyContributionPkr: "" }))} required>
                              <option value="">Choose a country</option>
                              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                            </select>
                          </Field>
                        </div>
                        {form.cardCountry && !cardOption ? (
                          <p className={s.warn} role="status">
                            Card payment is not available for {cardCountryName || "this country"} yet. If you are in Pakistan, choose Meezan Bank or JazzCash; otherwise you can apply for a complete scholarship.
                          </p>
                        ) : null}
                        {cardOption ? (
                          <>
                            <div className={s.step}>
                              <p className={s.stepTitle}><span aria-hidden="true">b</span>Select monthly amount<span className={s.req} aria-hidden="true">*</span></p>
                              <div className={s.amounts}>
                                {cardOption.tiers.map((row) => (
                                  <label key={row.tier} className={s.amount} data-active={form.monthlyContributionPkr === row.tier || undefined}>
                                    <input type="radio" name="monthlyContributionPkr" value={row.tier} checked={form.monthlyContributionPkr === row.tier} onChange={() => set("monthlyContributionPkr", row.tier)} required />
                                    <span>
                                      <strong>{formatSirahMoney(row.monthlyMinor, cardOption.currency)} <em>a month</em></strong>
                                      <small>Paid once as {formatSirahMoney(row.totalMinor, cardOption.currency)} for {cardOption.months} months</small>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className={s.cardInfo}>
                              <p><strong>Nothing is charged now.</strong> If you are selected, we email you a secure card payment link for a single payment of your chosen amount for the whole programme. Your course access starts as soon as it is paid.</p>
                              <p>It is one payment, not a monthly subscription, so it also works for cards that cannot be charged automatically each month.</p>
                            </div>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className={s.step}>
                          <p className={s.stepTitle}><span aria-hidden="true">{cardEnabled ? "b" : "a"}</span>Select monthly amount<span className={s.req} aria-hidden="true">*</span></p>
                          <div className={s.amounts}>
                            {(["1000", "500"] as const).map((tier) => (
                              <label key={tier} className={s.amount} data-active={form.monthlyContributionPkr === tier || undefined}>
                                <input type="radio" name="monthlyContributionPkr" value={tier} checked={form.monthlyContributionPkr === tier} onChange={() => set("monthlyContributionPkr", tier)} required />
                                <span><strong>{tier} PKR <em>monthly</em></strong></span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className={s.step}>
                          <p className={s.stepTitle}><span aria-hidden="true">{cardEnabled ? "c" : "b"}</span>Send your transfer</p>
                          <p className={s.hint}>Use your payment reference in the transfer note and then complete the verification fields below clearly.</p>
                          <div className={s.accounts}>
                            <Account title="Meezan Bank" rows={meezan} />
                            <Account title="JazzCash" rows={jazzcash} />
                          </div>
                          <ol className={s.steps}>
                            <li>Send payment to Areej via Meezan Bank or JazzCash.</li>
                            <li>Keep your sender details ready.</li>
                            <li>Fill sender name, sender number, and transfer reference clearly below.</li>
                          </ol>
                        </div>

                        <div className={s.step}>
                          <p className={s.stepTitle}><span aria-hidden="true">{cardEnabled ? "d" : "c"}</span>Confirm your transfer</p>
                          <Field label="Manual payment method" required>
                            <select name="manualPaymentMethod" value={form.manualPaymentMethod} onChange={text("manualPaymentMethod")} required>
                              <option value="">Select the method you used</option>
                              <option value="BANK_TRANSFER">Meezan Bank transfer</option>
                              <option value="JAZZCASH">JazzCash</option>
                            </select>
                          </Field>
                          <div className={s.grid}>
                            <Field label="Sender name" required>
                              <input name="manualSenderName" value={form.manualSenderName} onChange={text("manualSenderName")} placeholder="Name used for transfer" required />
                            </Field>
                            <Field label="Sender number" required>
                              <input name="manualSenderNumber" value={form.manualSenderNumber} onChange={text("manualSenderNumber")} placeholder="Number used for transfer" required />
                            </Field>
                          </div>
                          <Field label="Transfer reference ID" required>
                            <input name="manualReferenceKey" value={form.manualReferenceKey} onChange={text("manualReferenceKey")} placeholder="Transaction / reference id" required />
                          </Field>
                          <Field label="Payment receipt evidence" required hint="Upload a clear JPG, PNG, WebP or PDF. Images up to 20 MB are resized automatically; PDFs must be under 4 MB. Required for both Meezan Bank and JazzCash; staff must verify receipt before confirming payment. No receipt is needed for a full scholarship.">
                            <input key={receiptKey} name="receipt" type="file" accept={SIRAH_RECEIPT_ACCEPT} required onChange={(event) => setReceipt(event.target.files?.[0] || null)} />
                          </Field>
                          <Field label="Notes" optional>
                            <textarea name="manualNotes" value={form.manualNotes} onChange={text("manualNotes")} rows={2} />
                          </Field>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </fieldset>

              <Field label="Reason for waiver" required>
                <textarea name="reasonForWaiver" value={form.reasonForWaiver} onChange={text("reasonForWaiver")} rows={4} required />
              </Field>
              <Field label="How did you hear about us?" optional>
                <input name="howHeard" value={form.howHeard} onChange={text("howHeard")} />
              </Field>
            </Section>

            <Section id="agreements" index={6} title="Agreements">
              <div className={s.agreements}>
                <Agreement name="skillsLearningCommitment" checked={form.scholarshipDetails.skillsLearningCommitment} onChange={(v) => setDetail("skillsLearningCommitment", v)}>
                  If I do not yet have relevant skills, I commit to identifying and starting to learn a skill needed for mission and community work.
                </Agreement>
                <Agreement name="missionCommitment" checked={form.scholarshipDetails.missionCommitment} onChange={(v) => setDetail("missionCommitment", v)}>
                  I am applying for sustained learning and practical service, and I am willing to contribute to the wider mission wherever possible.
                </Agreement>
                <Agreement name="selectionAcknowledgement" checked={form.scholarshipDetails.selectionAcknowledgement} onChange={(v) => setDetail("selectionAcknowledgement", v)}>
                  I understand that only 10 Batch 4 scholarship places are available, my answers are truthful, and applying or meeting the criteria does not guarantee selection.
                </Agreement>
                <Agreement name="adabCommitment" checked={form.adabCommitment} onChange={(v) => set("adabCommitment", v)}>
                  I commit to adab, etiquette, and respectful conduct in this course.
                </Agreement>
                <Agreement name="genuineFinancialNeed" checked={form.genuineFinancialNeed} onChange={(v) => set("genuineFinancialNeed", v)}>
                  I confirm that this application is based on genuine financial need.
                </Agreement>
              </div>
            </Section>

            <div className={s.submit}>
              {error ? <p role="alert" className={s.error}>{error}</p> : null}
              {success ? <p role="status" className={s.success}>{success}</p> : null}
              <div className={s.submitRow}>
                <p>Your submission remains confidential and goes straight to manual admin review.</p>
                <Button type="submit" disabled={submitting} arrow={!submitting}>
                  {submitting ? "Submitting..." : "Submit Scholarship Application"}
                </Button>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

function Section({ id, index, title, children }: { id: string; index: number; title: string; children: ReactNode }) {
  return (
    <section className={s.section} aria-labelledby={`${id}-title`} id={id}>
      <h2 id={`${id}-title`} className={s.sectionTitle}>
        <span className={s.sectionIndex} aria-hidden="true">{index}</span>
        {title}
      </h2>
      <div className={s.sectionBody}>{children}</div>
    </section>
  );
}

function Field({ label, required, optional, hint, children }: { label: string; required?: boolean; optional?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className={s.field}>
      <span className={s.label}>
        {label}
        {required ? <span className={s.req} aria-hidden="true">*</span> : null}
        {optional ? <span className={s.optional}>Optional</span> : null}
      </span>
      {children}
      {hint ? <span className={s.hint}>{hint}</span> : null}
    </label>
  );
}

function Agreement({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: (value: boolean) => void; children: ReactNode }) {
  return (
    <label className={s.agreement} data-active={checked || undefined}>
      <input name={name} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} required />
      <span>{children}</span>
    </label>
  );
}

function Account({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) {
  const [copied, setCopied] = useState("");
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied((current) => (current === value ? "" : current)), 1600);
    } catch {
      setCopied("");
    }
  }
  return (
    <div className={s.account}>
      <p className={s.accountTitle}>{title}</p>
      <dl>
        {rows.map((row) => (
          <div key={row.value} className={s.accountRow}>
            <dt>{row.label}</dt>
            <dd>
              <code>{row.value}</code>
              <button type="button" className={s.copy} onClick={() => void copy(row.value)} aria-label={copied === row.value ? `Copied ${title} ${row.label.toLowerCase()}` : `Copy ${title} ${row.label.toLowerCase()}`}>
                {copied === row.value ? "Copied" : "Copy"}
              </button>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
