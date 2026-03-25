"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { Header } from "@/components/home/sections/header";

type FormState = {
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
  monthlyContributionPkr: "" | "500" | "1000";
  reasonForWaiver: string;
  howHeard: string;
  adabCommitment: boolean;
  genuineFinancialNeed: boolean;
};

const initialForm: FormState = {
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
  reasonForWaiver: "",
  howHeard: "",
  adabCommitment: false,
  genuineFinancialNeed: false,
};

export default function FreeWarriorPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const progressPercent = useMemo(() => {
    const checks = [
      form.fullName,
      form.email,
      form.whatsapp,
      form.age,
      form.cityCountry,
      form.occupation,
      form.knowledgeLevel,
      form.whatDrawsYou,
      form.howItBenefits,
      form.mostInterestingTopic,
      form.whyThisTopic,
      form.canAttendRegularly,
      form.contributionPreference,
      form.contributionPreference === "PARTIAL_CONTRIBUTION" ? form.monthlyContributionPkr : "ok",
      form.reasonForWaiver,
      form.adabCommitment ? "yes" : "",
      form.genuineFinancialNeed ? "yes" : "",
    ];

    const completed = checks.filter((value) => value.trim().length > 0).length;
    return Math.round((completed / checks.length) * 100);
  }, [form]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.contributionPreference) {
      setError("Please tell us whether you need a complete scholarship or can pay some amount monthly.");
      return;
    }
    if (form.contributionPreference === "PARTIAL_CONTRIBUTION" && !form.monthlyContributionPkr) {
      setError("Please choose how much you are willing to pay monthly.");
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
      const response = await fetch("/api/free-warrior/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          age: Number(form.age),
          courseSlug: "seerah-course",
          courseTitle: "Prophetic Strategies (Seerah)",
          listedPrice: "£20/mo",
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        details?: {
          formErrors?: string[];
          fieldErrors?: Record<string, string[] | undefined>;
        };
      };
      if (!response.ok) {
        const detailMessage =
          data.details?.formErrors?.[0] ??
          Object.values(data.details?.fieldErrors ?? {}).flat().find(Boolean);
        throw new Error(detailMessage || data.error || "Application could not be submitted.");
      }

      setSuccess("Your Fee Waiver application has been submitted. We will email you after review.");
      setForm(initialForm);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Application error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header />
      <main className="ga-page">
        <section className="ga-section">
          <div className="ga-container" style={{ maxWidth: 820 }}>
            <div style={{ textAlign: "center", marginBottom: "1.15rem" }}>
              <p className="ga-kicker">Fee Waiver Application</p>
              <h1 className="ga-heading">Apply for the Fee Waiver Scholarship</h1>
              <p className="ga-copy" style={{ marginTop: "0.8rem" }}>
                One complete application. No separate steps. Fill it once and we will send it directly to admin review.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={formCardStyle}>
              <div style={topRibbonStyle}>
                <div>
                  <p style={ribbonLabelStyle}>Course</p>
                  <p style={ribbonValueStyle}>Prophetic Strategies (Seerah)</p>
                </div>
                <div>
                  <p style={ribbonLabelStyle}>Listed Price</p>
                  <p style={ribbonValueStyle}>£20/mo</p>
                </div>
                <div>
                  <p style={ribbonLabelStyle}>Review Mode</p>
                  <p style={ribbonValueStyle}>Full waiver scholarship</p>
                </div>
              </div>

              <div style={progressBoxStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#12425f" }}>Application progress</span>
                  <span style={{ fontSize: "0.86rem", color: "#57748d" }}>{progressPercent}% complete</span>
                </div>
                <div style={progressTrackStyle}>
                  <div style={{ ...progressFillStyle, width: `${progressPercent}%` }} />
                </div>
              </div>

              <div style={inlineHeadingStyle}>Personal Information</div>
              <div style={fieldGridStyle}>
                <label style={labelStyle}>
                  Name*
                  <input name="fullName" autoComplete="name" value={form.fullName} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} style={inputStyle} required />
                </label>
                <label style={labelStyle}>
                  Email*
                  <input name="email" autoComplete="email" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} style={inputStyle} required />
                </label>
                <label style={labelStyle}>
                  WhatsApp*
                  <input name="whatsapp" autoComplete="tel" value={form.whatsapp} onChange={(event) => setForm((prev) => ({ ...prev, whatsapp: event.target.value }))} placeholder="+923001234567" style={inputStyle} required />
                </label>
                <label style={labelStyle}>
                  Age*
                  <input name="age" type="number" min={10} max={120} value={form.age} onChange={(event) => setForm((prev) => ({ ...prev, age: event.target.value }))} style={inputStyle} required />
                </label>
                <label style={labelStyle}>
                  City & Country*
                  <input name="cityCountry" autoComplete="address-level2" value={form.cityCountry} onChange={(event) => setForm((prev) => ({ ...prev, cityCountry: event.target.value }))} placeholder="Gujranwala, Pakistan" style={inputStyle} required />
                </label>
                <label style={labelStyle}>
                  Occupation*
                  <input name="occupation" autoComplete="organization-title" value={form.occupation} onChange={(event) => setForm((prev) => ({ ...prev, occupation: event.target.value }))} style={inputStyle} required />
                </label>
              </div>

              <div style={dividerStyle} />

              <div style={inlineHeadingStyle}>Islamic Background</div>
              <div style={fieldGridStyle}>
                <label style={labelStyle}>
                  Knowledge Level*
                  <select value={form.knowledgeLevel} onChange={(event) => setForm((prev) => ({ ...prev, knowledgeLevel: event.target.value }))} style={inputStyle} required>
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </label>
                <label style={labelStyle}>
                  Previous Seerah Study
                  <input value={form.previousSeerahStudy} onChange={(event) => setForm((prev) => ({ ...prev, previousSeerahStudy: event.target.value }))} style={inputStyle} />
                </label>
              </div>
              <label style={labelStyle}>
                Current Involvement
                <input value={form.currentInvolvement} onChange={(event) => setForm((prev) => ({ ...prev, currentInvolvement: event.target.value }))} style={inputStyle} />
              </label>

              <div style={dividerStyle} />

              <div style={inlineHeadingStyle}>Why This Course</div>
              <label style={labelStyle}>
                What draws you to this course?*
                <textarea value={form.whatDrawsYou} onChange={(event) => setForm((prev) => ({ ...prev, whatDrawsYou: event.target.value }))} rows={3} style={textareaStyle} required />
              </label>
              <label style={labelStyle}>
                How will this course benefit you?*
                <textarea value={form.howItBenefits} onChange={(event) => setForm((prev) => ({ ...prev, howItBenefits: event.target.value }))} rows={4} style={textareaStyle} required />
              </label>
              <div style={fieldGridStyle}>
                <label style={labelStyle}>
                  Most interesting topic*
                  <input value={form.mostInterestingTopic} onChange={(event) => setForm((prev) => ({ ...prev, mostInterestingTopic: event.target.value }))} style={inputStyle} required />
                </label>
                <label style={labelStyle}>
                  Why this topic?*
                  <input value={form.whyThisTopic} onChange={(event) => setForm((prev) => ({ ...prev, whyThisTopic: event.target.value }))} style={inputStyle} required />
                </label>
              </div>

              <div style={dividerStyle} />

              <div style={inlineHeadingStyle}>Commitment & Need</div>
              <div style={fieldGridStyle}>
                <label style={labelStyle}>
                  Can attend regularly?*
                  <input value={form.canAttendRegularly} onChange={(event) => setForm((prev) => ({ ...prev, canAttendRegularly: event.target.value }))} placeholder="I'll try my best" style={inputStyle} required />
                </label>
                <label style={toggleStyle}>
                  <span>Attended orientation?</span>
                  <input type="checkbox" checked={form.attendedOrientation} onChange={(event) => setForm((prev) => ({ ...prev, attendedOrientation: event.target.checked }))} />
                </label>
              </div>
              <div style={radioSectionStyle}>
                <div style={labelStyle}>
                  <span>How much are you willing to pay monthly?*</span>
                  <p style={helperCopyStyle}>
                    Choose one option so we know whether you need a complete scholarship or can contribute a small amount each month.
                  </p>
                </div>

                <div style={choiceGridStyle}>
                  <label style={{ ...choiceCardStyle, ...(form.contributionPreference === "FULL_SCHOLARSHIP" ? activeChoiceCardStyle : {}) }}>
                    <input
                      type="radio"
                      name="contributionPreference"
                      value="FULL_SCHOLARSHIP"
                      checked={form.contributionPreference === "FULL_SCHOLARSHIP"}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          contributionPreference: "FULL_SCHOLARSHIP",
                          monthlyContributionPkr: "",
                        }))
                      }
                      required
                    />
                    <div>
                      <strong>No, I need complete scholarship</strong>
                      <p style={choiceDescriptionStyle}>Select this if you need the full fee waived.</p>
                    </div>
                  </label>

                  <label style={{ ...choiceCardStyle, ...(form.contributionPreference === "PARTIAL_CONTRIBUTION" ? activeChoiceCardStyle : {}) }}>
                    <input
                      type="radio"
                      name="contributionPreference"
                      value="PARTIAL_CONTRIBUTION"
                      checked={form.contributionPreference === "PARTIAL_CONTRIBUTION"}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          contributionPreference: "PARTIAL_CONTRIBUTION",
                        }))
                      }
                      required
                    />
                    <div>
                      <strong>I can afford some fees monthly</strong>
                      <p style={choiceDescriptionStyle}>Select this if you can still contribute a smaller monthly amount.</p>
                    </div>
                  </label>
                </div>

                {form.contributionPreference === "PARTIAL_CONTRIBUTION" ? (
                  <div style={amountChoiceWrapStyle}>
                    <p style={amountChoiceHeadingStyle}>Select monthly amount*</p>
                    <div style={amountChoiceGridStyle}>
                      <label style={{ ...miniChoiceStyle, ...(form.monthlyContributionPkr === "1000" ? activeMiniChoiceStyle : {}) }}>
                        <input
                          type="radio"
                          name="monthlyContributionPkr"
                          value="1000"
                          checked={form.monthlyContributionPkr === "1000"}
                          onChange={() => setForm((prev) => ({ ...prev, monthlyContributionPkr: "1000" }))}
                          required
                        />
                        <span>1000 PKR monthly</span>
                      </label>
                      <label style={{ ...miniChoiceStyle, ...(form.monthlyContributionPkr === "500" ? activeMiniChoiceStyle : {}) }}>
                        <input
                          type="radio"
                          name="monthlyContributionPkr"
                          value="500"
                          checked={form.monthlyContributionPkr === "500"}
                          onChange={() => setForm((prev) => ({ ...prev, monthlyContributionPkr: "500" }))}
                          required
                        />
                        <span>500 PKR monthly</span>
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
              <label style={labelStyle}>
                Reason for waiver*
                <textarea value={form.reasonForWaiver} onChange={(event) => setForm((prev) => ({ ...prev, reasonForWaiver: event.target.value }))} rows={4} style={textareaStyle} required />
              </label>
              <label style={labelStyle}>
                How did you hear about us?
                <input value={form.howHeard} onChange={(event) => setForm((prev) => ({ ...prev, howHeard: event.target.value }))} style={inputStyle} />
              </label>

              <div style={dividerStyle} />

              <div style={inlineHeadingStyle}>Agreements</div>
              <div style={agreementGridStyle}>
                <label style={agreementCardStyle}>
                  <input type="checkbox" checked={form.adabCommitment} onChange={(event) => setForm((prev) => ({ ...prev, adabCommitment: event.target.checked }))} />
                  <span>I commit to adab, etiquette, and respectful conduct in this course.</span>
                </label>
                <label style={agreementCardStyle}>
                  <input type="checkbox" checked={form.genuineFinancialNeed} onChange={(event) => setForm((prev) => ({ ...prev, genuineFinancialNeed: event.target.checked }))} />
                  <span>I confirm that this application is based on genuine financial need.</span>
                </label>
              </div>

              {error ? <p style={{ margin: 0, color: "#b42318" }}>{error}</p> : null}
              {success ? <p style={{ margin: 0, color: "#166534" }}>{success}</p> : null}

              <div style={submitRowStyle}>
                <p style={{ margin: 0, color: "#58758e", fontSize: "0.9rem" }}>
                  Your submission remains confidential and goes straight to manual admin review.
                </p>
                <button type="submit" className="ga-btn ga-btn-primary" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Fee Waiver Application"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}

const formCardStyle: CSSProperties = {
  display: "grid",
  gap: "0.8rem",
  padding: "1.15rem",
  borderRadius: 20,
  border: "1px solid #d6e3ef",
  background: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.08)",
};

const topRibbonStyle: CSSProperties = {
  display: "grid",
  gap: "0.7rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  padding: "0.85rem 0.95rem",
  borderRadius: 15,
  background: "linear-gradient(135deg, #0f5c8d 0%, #1f7faa 100%)",
  color: "#fff",
};

const ribbonLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.74rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  opacity: 0.84,
};

const ribbonValueStyle: CSSProperties = {
  margin: "0.24rem 0 0",
  fontSize: "0.94rem",
  fontWeight: 700,
};

const progressBoxStyle: CSSProperties = {
  display: "grid",
  gap: "0.42rem",
};

const progressTrackStyle: CSSProperties = {
  width: "100%",
  height: 10,
  borderRadius: 999,
  background: "#d9e8f4",
  overflow: "hidden",
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, #12805e 0%, #1cbc7c 100%)",
  transition: "width 180ms ease",
};

const inlineHeadingStyle: CSSProperties = {
  margin: "0.1rem 0 0",
  fontSize: "0.82rem",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#0f5c8d",
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: "#d7e3ee",
};

const fieldGridStyle: CSSProperties = {
  display: "grid",
  gap: "0.7rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: "0.28rem",
  fontSize: "0.86rem",
  color: "#1f3f59",
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.62rem 0.72rem",
  borderRadius: 10,
  border: "1px solid #bfd2e4",
  background: "#fff",
  fontSize: "0.92rem",
  lineHeight: 1.3,
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: "vertical",
};

const toggleStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.72rem 0.82rem",
  borderRadius: 12,
  border: "1px solid #c9d8e6",
  background: "#fbfdff",
  fontSize: "0.9rem",
  color: "#1f3f59",
  fontWeight: 600,
};

const radioSectionStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  padding: "0.9rem",
  borderRadius: 14,
  border: "1px solid #d2dfeb",
  background: "#fbfdff",
};

const helperCopyStyle: CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "0.84rem",
  lineHeight: 1.5,
  color: "#58758e",
  fontWeight: 500,
};

const choiceGridStyle: CSSProperties = {
  display: "grid",
  gap: "0.7rem",
};

const choiceCardStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: "0.75rem",
  alignItems: "start",
  padding: "0.85rem 0.9rem",
  borderRadius: 12,
  border: "1px solid #c9d8e6",
  background: "#ffffff",
  color: "#1f3f59",
};

const activeChoiceCardStyle: CSSProperties = {
  border: "1px solid #7cb2da",
  background: "#f2f8fd",
  boxShadow: "0 0 0 3px rgba(31, 127, 170, 0.08)",
};

const choiceDescriptionStyle: CSSProperties = {
  margin: "0.24rem 0 0",
  fontSize: "0.84rem",
  lineHeight: 1.5,
  color: "#58758e",
  fontWeight: 500,
};

const amountChoiceWrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.65rem",
  paddingTop: "0.1rem",
};

const amountChoiceHeadingStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.84rem",
  fontWeight: 700,
  color: "#1f3f59",
};

const amountChoiceGridStyle: CSSProperties = {
  display: "grid",
  gap: "0.65rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const miniChoiceStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.65rem",
  padding: "0.78rem 0.85rem",
  borderRadius: 12,
  border: "1px solid #c9d8e6",
  background: "#ffffff",
  color: "#1f3f59",
  fontSize: "0.88rem",
  fontWeight: 600,
};

const activeMiniChoiceStyle: CSSProperties = {
  border: "1px solid #7cb2da",
  background: "#f2f8fd",
};

const agreementGridStyle: CSSProperties = {
  display: "grid",
  gap: "0.65rem",
};

const agreementCardStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.75rem",
  padding: "0.78rem 0.88rem",
  borderRadius: 12,
  border: "1px solid #c9d8e6",
  background: "#fbfdff",
  fontSize: "0.9rem",
  color: "#1f3f59",
};

const submitRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
  marginTop: "0.35rem",
};
