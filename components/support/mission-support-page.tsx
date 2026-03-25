"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const amountOptions = [5, 10, 20, 50];
const methodOptions = [
  { id: "STRIPE", label: "Stripe / Card", description: "Instant online checkout with secure card payment." },
  { id: "PAYPAL", label: "PayPal", description: "Pay with your PayPal account or linked card." },
  { id: "BANK_TRANSFER", label: "Bank Transfer", description: "Send manually and submit your transfer reference for review." },
  { id: "JAZZCASH", label: "JazzCash", description: "A familiar wallet option for supporters in Pakistan." },
] as const;

const missionPillars = [
  {
    title: "Learning with structure",
    description: "Support access to meaningful Islamic and academic learning instead of scattered one-off help.",
  },
  {
    title: "Mentorship with care",
    description: "Help children grow in confidence, discipline, and responsibility through guided support.",
  },
  {
    title: "Future-focused impact",
    description: "Invest in a generation rooted in knowledge, character, and service to the community.",
  },
];

const supportFlow = [
  {
    title: "Choose your support amount",
    description: "Start with a suggested amount or enter a custom contribution in GBP.",
  },
  {
    title: "Add your details",
    description: "We use your contact details to confirm your contribution and keep the process transparent.",
  },
  {
    title: "Complete payment",
    description: "Use Stripe, PayPal, bank transfer, or JazzCash depending on what suits you best.",
  },
];

const whySupportPoints = [
  "Sponsor a child's educational journey with clear purpose.",
  "Support tarbiyah, confidence, and healthy character formation.",
  "Make giving simple through one organized support page.",
];

const donorChecklist = [
  "Choose a support amount that fits your capacity.",
  "Fill in your name, email, and country details clearly.",
  "For manual transfers, add sender details and your payment reference.",
  "Submit the form and we will confirm your contribution by email.",
];

const trustPoints = [
  {
    title: "Clear purpose",
    description: "Every section on this page is designed to explain what your support helps make possible.",
  },
  {
    title: "Simple process",
    description: "The page moves from mission, to form, to payment without extra clutter or confusion.",
  },
  {
    title: "Reviewable manual support",
    description: "Manual bank transfer and JazzCash submissions stay pending until verified by admin.",
  },
];

const supportSignals = [
  "Organized giving flow",
  "Flexible payment options",
  "Clear mission impact",
];

type MethodId = (typeof methodOptions)[number]["id"];

const bankDetails = [
  ["Account Title", "AREEJ FATIMA"],
  ["Account Number", "98900114432111"],
  ["IBAN", "PK96MEZN0098900114432111"],
] as const;

export default function MissionSupportPage() {
  const searchParams = useSearchParams();
  const paypalCaptureRan = useRef(false);
  const formCardRef = useRef<HTMLElement | null>(null);

  const [selectedAmount, setSelectedAmount] = useState<number | "custom">(20);
  const [customAmount, setCustomAmount] = useState("25");
  const [method, setMethod] = useState<MethodId>("STRIPE");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phoneCountryCode: "+44",
    phoneNumber: "",
    countryName: "",
    donorMessage: "",
    senderName: "",
    senderNumber: "",
    referenceKey: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeAmount = useMemo(() => {
    const parsedCustom = Number.parseFloat(customAmount || "0");
    return selectedAmount === "custom" ? parsedCustom : selectedAmount;
  }, [customAmount, selectedAmount]);

  const isManualMethod = method === "BANK_TRANSFER" || method === "JAZZCASH";

  useEffect(() => {
    if (searchParams.get("payment") === "success" && searchParams.get("provider") === "stripe") {
      setSuccess("JazakAllah khair. Your support payment was received successfully. A confirmation email will reach you shortly.");
      setError(null);
    }

    if (searchParams.get("payment") === "cancelled") {
      setError("The payment flow was cancelled before completion. You can try again whenever you are ready.");
      setSuccess(null);
    }
  }, [searchParams]);

  useEffect(() => {
    const provider = searchParams.get("provider");
    const donationId = searchParams.get("donationId");
    const orderId = searchParams.get("token");

    if (
      searchParams.get("payment") === "success" &&
      provider === "paypal" &&
      donationId &&
      orderId &&
      !paypalCaptureRan.current
    ) {
      paypalCaptureRan.current = true;
      setLoading(true);
      void fetch("/api/mission-support/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donationId, orderId }),
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.error || "PayPal capture failed.");
          }
          setSuccess("JazakAllah khair. Your PayPal support payment has been confirmed successfully.");
          setError(null);
        })
        .catch((captureError) => {
          setError(captureError instanceof Error ? captureError.message : "PayPal capture failed.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [searchParams]);

  function copyValue(value: string) {
    void navigator.clipboard.writeText(value);
  }

  function scrollToForm() {
    formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/mission-support/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amountGbp: activeAmount,
          paymentMethod: method,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Could not start support payment.");
      }

      if (payload.mode === "STRIPE" && payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }

      if (payload.mode === "PAYPAL" && payload.approveUrl) {
        window.location.href = payload.approveUrl;
        return;
      }

      setSuccess(
        `Your manual support submission is now pending admin confirmation. Reference: ${payload.paymentReference}. We will email you once it is confirmed.`,
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not start support payment.");
    } finally {
      setLoading(false);
    }
  }

  const summaryLabel =
    method === "STRIPE"
      ? "Proceed with Stripe"
      : method === "PAYPAL"
        ? "Proceed with PayPal"
        : "Submit Manual Support";

  return (
    <main className="ga-page ga-support-page">
      <section className="ga-section">
        <div className="ga-container ga-support-shell">
          <section className="ga-support-hero">
            <div className="ga-support-hero-copy">
              <p className="ga-dashboard-kicker">Support Our Vision and Mission</p>
              <h1 className="ga-support-title">Help a child learn, grow, and lead with confidence.</h1>
              <p className="ga-copy ga-support-lead">
                This support page is for donors who want to sponsor a child&apos;s journey through TGA. Your
                contribution helps create access to learning, mentorship, and guidance in one organized pathway.
              </p>

              <div className="ga-support-action-row">
                <button type="button" className="ga-btn ga-btn-primary" onClick={scrollToForm}>
                  Support a Child
                </button>
                <button type="button" className="ga-btn ga-btn-ghost" onClick={scrollToForm}>
                  Open Support Form
                </button>
              </div>

              <div className="ga-support-pill-row">
                <span className="ga-support-pill">Education</span>
                <span className="ga-support-pill">Tarbiyah</span>
                <span className="ga-support-pill">Mentorship</span>
                <span className="ga-support-pill">Leadership</span>
              </div>

              <div className="ga-support-signal-row">
                {supportSignals.map((item) => (
                  <div key={item} className="ga-support-signal">
                    <span className="ga-support-signal-dot" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <aside className="ga-support-hero-panel">
              <p className="ga-support-panel-kicker">What your support helps build</p>
              <ul className="ga-support-bullet-list">
                {whySupportPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>

              <div className="ga-support-panel-quote">
                <strong>Support our vision and mission</strong>
                <p>Sponsor a child today and help nurture knowledge, character, and service in the next generation.</p>
              </div>
            </aside>
          </section>

          <section className="ga-support-story-grid">
            <article className="ga-dashboard-card ga-support-card">
              <p className="ga-dashboard-card-title">Where your support goes</p>
              <div className="ga-support-impact-grid">
                {missionPillars.map((item) => (
                  <div key={item.title} className="ga-support-impact-card">
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="ga-dashboard-card ga-support-card">
              <p className="ga-dashboard-card-title">How support works</p>
              <div className="ga-support-steps">
                {supportFlow.map((step, index) => (
                  <div key={step.title} className="ga-support-step">
                    <div className="ga-support-step-number">0{index + 1}</div>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="ga-dashboard-split ga-support-main">
            <article ref={formCardRef} className="ga-dashboard-card ga-support-form-card">
              <div className="ga-support-form-head">
                <div>
                  <p className="ga-dashboard-card-title">Sponsor a Child Today</p>
                  <p className="ga-dashboard-muted ga-support-form-copy">
                    Complete the form below to support the mission with a payment method that feels right for you.
                  </p>
                </div>
                <div className="ga-support-summary-chip">
                  <span>Selected support</span>
                  <strong>GBP {Number.isFinite(activeAmount) ? activeAmount.toFixed(2) : "0.00"}</strong>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="ga-dashboard-form ga-support-form">
                <section className="ga-support-form-section">
                  <div className="ga-support-section-head">
                    <p className="ga-support-section-kicker">Step 1</p>
                    <h2>Choose your support amount</h2>
                  </div>

                  <div className="ga-support-amount-grid">
                    {amountOptions.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        className={`ga-support-amount-button ${selectedAmount === amount ? "is-active" : ""}`}
                        onClick={() => setSelectedAmount(amount)}
                      >
                        GBP {amount}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`ga-support-amount-button ${selectedAmount === "custom" ? "is-active" : ""}`}
                      onClick={() => setSelectedAmount("custom")}
                    >
                      Custom Amount
                    </button>
                  </div>

                  {selectedAmount === "custom" ? (
                    <label>
                      Custom amount in GBP
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={customAmount}
                        onChange={(event) => setCustomAmount(event.target.value)}
                        required
                      />
                    </label>
                  ) : null}
                </section>

                <section className="ga-support-form-section">
                  <div className="ga-support-section-head">
                    <p className="ga-support-section-kicker">Step 2</p>
                    <h2>Your details</h2>
                  </div>

                  <div className="ga-support-form-grid">
                    <label>
                      Full name
                      <input
                        autoComplete="name"
                        value={form.fullName}
                        onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                        placeholder="Your full name"
                        required
                      />
                    </label>

                    <label>
                      Email
                      <input
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                        placeholder="you@example.com"
                        required
                      />
                    </label>
                  </div>

                  <div className="ga-support-form-grid ga-support-form-grid-phone">
                    <label>
                      Code
                      <input
                        value={form.phoneCountryCode}
                        onChange={(event) => setForm((prev) => ({ ...prev, phoneCountryCode: event.target.value }))}
                        placeholder="+44"
                      />
                    </label>
                    <label>
                      Phone number
                      <input
                        autoComplete="tel"
                        value={form.phoneNumber}
                        onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                        placeholder="Optional phone number"
                      />
                    </label>
                  </div>

                  <label>
                    Country
                    <input
                      value={form.countryName}
                      onChange={(event) => setForm((prev) => ({ ...prev, countryName: event.target.value }))}
                      placeholder="United Kingdom"
                    />
                  </label>

                  <label>
                    Message or intention
                    <textarea
                      value={form.donorMessage}
                      onChange={(event) => setForm((prev) => ({ ...prev, donorMessage: event.target.value }))}
                      rows={4}
                      className="ga-support-textarea"
                      placeholder="Optional message of support"
                    />
                  </label>
                </section>

                <section className="ga-support-form-section">
                  <div className="ga-support-section-head">
                    <p className="ga-support-section-kicker">Step 3</p>
                    <h2>Choose a payment method</h2>
                  </div>

                  <div className="ga-support-methods">
                    {methodOptions.map((option) => (
                      <label key={option.id} className={`ga-support-method ${method === option.id ? "is-active" : ""}`}>
                        <div className="ga-support-method-copy">
                          <strong>{option.label}</strong>
                          <p>{option.description}</p>
                        </div>
                        <input
                          type="radio"
                          name="support-payment-method"
                          checked={method === option.id}
                          onChange={() => setMethod(option.id)}
                        />
                      </label>
                    ))}
                  </div>
                </section>

                {isManualMethod ? (
                  <section className="ga-support-form-section ga-support-manual-section">
                    <div className="ga-support-section-head">
                      <p className="ga-support-section-kicker">Manual Payment</p>
                      <h2>Transfer details and confirmation</h2>
                    </div>

                    <div className="ga-support-manual-block">
                      <div className="ga-support-manual-card">
                        <div>
                          <strong>Meezan Bank</strong>
                          {bankDetails.map(([label, value]) => (
                            <p key={label}>
                              {label}: {value}
                            </p>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="ga-btn ga-btn-outline"
                          onClick={() => copyValue(bankDetails.map(([label, value]) => `${label}: ${value}`).join("\n"))}
                        >
                          Copy
                        </button>
                      </div>

                      <div className="ga-support-manual-card">
                        <div>
                          <strong>JazzCash</strong>
                          <p>Areej Fatima: 03244517741</p>
                          <p>After sending payment, share screenshot on WhatsApp: 03181602388</p>
                        </div>
                        <button
                          type="button"
                          className="ga-btn ga-btn-outline"
                          onClick={() => copyValue("Areej Fatima 03244517741")}
                        >
                          Copy
                        </button>
                      </div>

                      <div className="ga-support-form-grid">
                        <label>
                          Sender name
                          <input
                            value={form.senderName}
                            onChange={(event) => setForm((prev) => ({ ...prev, senderName: event.target.value }))}
                            placeholder="Name used for the transfer"
                            required
                          />
                        </label>
                        <label>
                          Sender number
                          <input
                            value={form.senderNumber}
                            onChange={(event) => setForm((prev) => ({ ...prev, senderNumber: event.target.value }))}
                            placeholder="Optional sender phone or wallet number"
                          />
                        </label>
                      </div>

                      <div className="ga-support-form-grid">
                        <label>
                          Reference key
                          <input
                            value={form.referenceKey}
                            onChange={(event) => setForm((prev) => ({ ...prev, referenceKey: event.target.value }))}
                            placeholder="Bank transaction id or wallet reference"
                            required
                          />
                        </label>
                        <label>
                          Notes for admin
                          <input
                            value={form.notes}
                            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                            placeholder="Optional note to help verify payment"
                          />
                        </label>
                      </div>
                    </div>
                  </section>
                ) : null}

                <div className="ga-support-total-row">
                  <div>
                    <strong>Support summary</strong>
                    <p>You will be charged exactly the amount shown here.</p>
                  </div>
                  <span>GBP {Number.isFinite(activeAmount) ? activeAmount.toFixed(2) : "0.00"}</span>
                </div>

                <p className="ga-support-form-note">
                  Your details are used only to process and confirm your contribution. Manual submissions remain pending
                  until verification is completed.
                </p>

                {success ? <p className="ga-dashboard-success">{success}</p> : null}
                {error ? <p className="ga-dashboard-error">{error}</p> : null}

                <button type="submit" className="ga-btn ga-btn-primary ga-support-submit" disabled={loading}>
                  {loading ? "Processing..." : summaryLabel}
                </button>
              </form>
            </article>

            <aside className="ga-support-side-column">
              <article className="ga-dashboard-card ga-support-side-card">
                <p className="ga-dashboard-card-title">Before you submit</p>
                <ul className="ga-support-bullet-list ga-support-bullet-list-compact">
                  {donorChecklist.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>

              <article className="ga-dashboard-card ga-support-side-card">
                <p className="ga-dashboard-card-title">Why this page feels clearer</p>
                <div className="ga-support-side-list">
                  {trustPoints.map((item) => (
                    <div key={item.title} className="ga-support-side-item">
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="ga-dashboard-card ga-support-side-card ga-support-side-cta">
                <p className="ga-dashboard-card-title">Ready to support our mission?</p>
                <p className="ga-dashboard-muted">
                  Your contribution helps invest in learning, tarbiyah, and a stronger future for a child.
                </p>
                <button type="button" className="ga-btn ga-btn-primary" onClick={scrollToForm}>
                  Continue to Form
                </button>
              </article>
            </aside>
          </section>
        </div>
      </section>
    </main>
  );
}
