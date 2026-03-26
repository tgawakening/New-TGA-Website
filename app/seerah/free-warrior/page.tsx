"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
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
  manualSenderName: string;
  manualReferenceKey: string;
  manualNotes: string;
  transactionScreenshotName: string;
  transactionScreenshotData: string;
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
  manualSenderName: "",
  manualReferenceKey: "",
  manualNotes: "",
  transactionScreenshotName: "",
  transactionScreenshotData: "",
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
  const isPartialContribution = form.contributionPreference === "PARTIAL_CONTRIBUTION";

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
    if (isPartialContribution && !form.manualSenderName.trim()) {
      setError("Please provide sender name for payment verification.");
      return;
    }
    if (isPartialContribution && !form.manualReferenceKey.trim()) {
      setError("Please provide transfer reference ID before submitting.");
      return;
    }
    if (isPartialContribution && !form.transactionScreenshotName.trim()) {
      setError("Please select your transaction screenshot before submitting.");
      return;
    }
    if (isPartialContribution && !form.transactionScreenshotData.trim()) {
      setError("Please upload your transaction screenshot before submitting.");
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

  async function handleScreenshotChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setForm((prev) => ({ ...prev, transactionScreenshotName: "", transactionScreenshotData: "" }));
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Could not read screenshot file."));
      reader.readAsDataURL(file);
    });

    setForm((prev) => ({
      ...prev,
      transactionScreenshotName: file.name,
      transactionScreenshotData: dataUrl,
    }));
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
                          manualSenderName: "",
                          manualReferenceKey: "",
                          manualNotes: "",
                          transactionScreenshotName: "",
                          transactionScreenshotData: "",
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

                    <div style={manualInfoWrapStyle}>
                      <div style={manualInfoNoteStyle}>
                        Use your payment reference in the transfer note. After payment, keep your transaction screenshot ready and complete the verification fields below.
                      </div>

                      <div style={manualCardGridStyle}>
                        <div style={manualCardStyle}>
                          <p style={manualCardTitleStyle}>[BANK] Meezan Bank</p>
                          <div style={manualRowStyle}>
                            <span style={manualRowTextStyle}>Account Title: AREEJ FATIMA</span>
                            <button type="button" onClick={() => void navigator.clipboard.writeText("AREEJ FATIMA")} style={copyButtonStyle}>Copy</button>
                          </div>
                          <div style={manualRowStyle}>
                            <span style={manualRowTextStyle}>Account Number: 98900114432111</span>
                            <button type="button" onClick={() => void navigator.clipboard.writeText("98900114432111")} style={copyButtonStyle}>Copy</button>
                          </div>
                          <div style={manualRowStyle}>
                            <span style={manualRowTextStyle}>IBAN: PK96MEZN0098900114432111</span>
                            <button type="button" onClick={() => void navigator.clipboard.writeText("PK96MEZN0098900114432111")} style={copyButtonStyle}>Copy</button>
                          </div>
                        </div>

                        <div style={manualCardStyle}>
                          <p style={manualCardTitleStyle}>[JAZZ] JazzCash</p>
                          <div style={manualRowStyle}>
                            <span style={manualRowTextStyle}>Areej Fatima</span>
                            <button type="button" onClick={() => void navigator.clipboard.writeText("Areej Fatima")} style={copyButtonStyle}>Copy</button>
                          </div>
                          <div style={manualRowStyle}>
                            <span style={manualRowTextStyle}>03244517741</span>
                            <button type="button" onClick={() => void navigator.clipboard.writeText("03244517741")} style={copyButtonStyle}>Copy</button>
                          </div>
                        </div>
                      </div>

                      <div style={manualInfoWarnStyle}>
                        1. Send payment to Areej via Meezan Bank or JazzCash.
                        <br />
                        2. Save your transaction screenshot.
                        <br />
                        3. Fill sender name and transfer reference clearly below.
                      </div>

                      <div style={fieldGridStyle}>
                        <label style={labelStyle}>
                          Sender Name*
                          <input
                            value={form.manualSenderName}
                            onChange={(event) => setForm((prev) => ({ ...prev, manualSenderName: event.target.value }))}
                            placeholder="Name used for transfer"
                            style={inputStyle}
                            required
                          />
                        </label>
                        <label style={labelStyle}>
                          Transfer Reference ID*
                          <input
                            value={form.manualReferenceKey}
                            onChange={(event) => setForm((prev) => ({ ...prev, manualReferenceKey: event.target.value }))}
                            placeholder="Transaction / reference id"
                            style={inputStyle}
                            required
                          />
                        </label>
                      </div>

                      <label style={labelStyle}>
                        Upload Transaction Screenshot*
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => void handleScreenshotChange(event)}
                          style={fileInputStyle}
                          required
                        />
                        {form.transactionScreenshotName ? <span style={fileNameStyle}>Selected: {form.transactionScreenshotName}</span> : null}
                      </label>

                      <label style={labelStyle}>
                        Notes (optional)
                        <textarea
                          value={form.manualNotes}
                          onChange={(event) => setForm((prev) => ({ ...prev, manualNotes: event.target.value }))}
                          rows={2}
                          style={textareaStyle}
                        />
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

const manualInfoWrapStyle: CSSProperties = {
  display: "grid",
  gap: "0.7rem",
  paddingTop: "0.2rem",
};

const manualInfoNoteStyle: CSSProperties = {
  fontSize: "0.73rem",
  color: "#2f5576",
  background: "#edf4fb",
  border: "1px solid #c2d8ec",
  borderRadius: 7,
  padding: "0.6rem",
  lineHeight: 1.5,
};

const manualCardGridStyle: CSSProperties = {
  display: "grid",
  gap: "0.7rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
};

const manualCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #cfe0ee",
  borderRadius: 10,
  padding: "0.75rem",
  display: "grid",
  gap: "0.5rem",
};

const manualCardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.74rem",
  fontWeight: 800,
  color: "#1f4f73",
};

const manualRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.6rem",
};

const manualRowTextStyle: CSSProperties = {
  fontSize: "0.74rem",
  color: "#2d4a67",
};

const copyButtonStyle: CSSProperties = {
  border: "1px solid #bfd4e6",
  background: "#eff7fd",
  borderRadius: 6,
  padding: "0.25rem 0.6rem",
  cursor: "pointer",
  fontSize: "0.72rem",
  fontWeight: 700,
};

const manualInfoWarnStyle: CSSProperties = {
  fontSize: "0.73rem",
  color: "#2f5576",
  background: "#fff7ea",
  border: "1px solid #edd4a4",
  borderRadius: 7,
  padding: "0.6rem",
  lineHeight: 1.6,
};

const fileInputStyle: CSSProperties = {
  ...inputStyle,
  padding: "0.5rem",
};

const fileNameStyle: CSSProperties = {
  fontSize: "0.76rem",
  color: "#58758e",
  fontWeight: 500,
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
