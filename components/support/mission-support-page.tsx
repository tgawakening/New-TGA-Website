"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const amountOptions = [5, 10, 20, 50];
const methodOptions = [
  { id: "STRIPE", label: "Stripe / Card", description: "Pay securely with card and get instant confirmation." },
  { id: "PAYPAL", label: "PayPal", description: "Use your PayPal account or linked card in a familiar checkout." },
  { id: "BANK_TRANSFER", label: "Bank Transfer", description: "Send support manually and we will verify it for you." },
  { id: "JAZZCASH", label: "JazzCash", description: "A simple wallet option for supporters in Pakistan." },
] as const;

const impactPoints = [
  "Sponsor access to structured Islamic and academic learning",
  "Help children grow with mentorship, discipline, and confidence",
  "Strengthen families and communities through knowledge",
];

const sponsorshipSteps = [
  {
    title: "Choose how you want to help",
    description: "Select an amount that fits your capacity, whether monthly-style support or a custom contribution.",
  },
  {
    title: "Complete the support form",
    description: "Share your details so we can confirm your contribution and keep the process transparent.",
  },
  {
    title: "Support a child's journey",
    description: "Your contribution helps provide learning, mentorship, and a stronger path forward for a child.",
  },
];

const givingHighlights = [
  { value: "Clear purpose", label: "This page exists to let donors sponsor children's learning journeys." },
  { value: "Flexible giving", label: "Support instantly with card or PayPal, or submit manual support details." },
  { value: "Mission first", label: "Every contribution is aimed at education, tarbiyah, and future leadership." },
];

type MethodId = (typeof methodOptions)[number]["id"];

const bankDetails = [
  ["Account Title", "AREEJ FATIMA"],
  ["Account Number", "98900114432111"],
  ["IBAN", "PK96MEZN0098900114432111"],
];

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
              <p className="ga-dashboard-kicker">Support Our Mission</p>
              <h1 className="ga-support-title">
                Help a child learn, grow, and lead with confidence.
              </h1>
              <p className="ga-copy ga-support-lead">
                This page is for supporters who want to sponsor a child&apos;s educational journey through TGA. Your
                support helps provide learning, mentorship, and guidance that can shape a stronger future.
              </p>

              <div className="ga-support-action-row">
                <button type="button" className="ga-btn ga-btn-primary" onClick={scrollToForm}>
                  Fill Support Form
                </button>
                <button type="button" className="ga-btn ga-btn-ghost" onClick={scrollToForm}>
                  Support Our Vision
                </button>
              </div>

              <div className="ga-support-hero-grid">
                {givingHighlights.map((item) => (
                  <div key={item.value} className="ga-support-stat">
                    <strong>{item.value}</strong>
                    <p>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="ga-support-hero-panel">
              <p className="ga-support-panel-kicker">What your support makes possible</p>
              <div className="ga-support-checklist">
                {impactPoints.map((point) => (
                  <div key={point} className="ga-support-check-item">
                    <span className="ga-support-check-icon">+</span>
                    <p>{point}</p>
                  </div>
                ))}
              </div>

              <div className="ga-support-panel-quote">
                <strong>Support our vision and mission</strong>
                <p>
                  Sponsor a child today and help create a generation grounded in knowledge, character, and service.
                </p>
              </div>
            </aside>
          </section>

          <section className="ga-support-story-grid">
            <article className="ga-dashboard-card ga-support-card">
              <p className="ga-dashboard-card-title">Why this page matters</p>
              <p className="ga-support-card-copy">
                Many visitors land here ready to help, but they first need clarity. This page now explains the purpose
                clearly: it is a direct way to support a child&apos;s access to meaningful education and development.
              </p>
              <div className="ga-support-purpose-list">
                <div className="ga-support-purpose-item">
                  <strong>Education with direction</strong>
                  <p>Support children with structured learning, not one-time scattered help.</p>
                </div>
                <div className="ga-support-purpose-item">
                  <strong>Mentorship with impact</strong>
                  <p>Contributions help children grow in confidence, discipline, and leadership.</p>
                </div>
                <div className="ga-support-purpose-item">
                  <strong>Giving made simple</strong>
                  <p>The page guides donors from understanding the mission to completing support in one place.</p>
                </div>
              </div>
            </article>

            <article className="ga-dashboard-card ga-support-card">
              <p className="ga-dashboard-card-title">How sponsorship works</p>
              <div className="ga-support-steps">
                {sponsorshipSteps.map((step, index) => (
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
                    Choose an amount, add your details, and continue with the payment option that suits you best.
                  </p>
                </div>
                <div className="ga-support-summary-chip">
                  <span>Selected support</span>
                  <strong>£{Number.isFinite(activeAmount) ? activeAmount.toFixed(2) : "0.00"}</strong>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="ga-dashboard-form ga-support-form">
                <div>
                  <label className="ga-support-label-title">Choose your amount</label>
                  <div className="ga-support-amount-grid">
                    {amountOptions.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        className={`ga-support-amount-button ${selectedAmount === amount ? "is-active" : ""}`}
                        onClick={() => setSelectedAmount(amount)}
                      >
                        £{amount}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`ga-support-amount-button ${selectedAmount === "custom" ? "is-active" : ""}`}
                      onClick={() => setSelectedAmount("custom")}
                    >
                      Custom
                    </button>
                  </div>
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

                <div className="ga-support-form-grid">
                  <label>
                    Full name
                    <input
                      autoComplete="name"
                      value={form.fullName}
                      onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
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
                    />
                  </label>
                  <label>
                    Phone number
                    <input
                      autoComplete="tel"
                      value={form.phoneNumber}
                      onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
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
                  Why are you supporting?
                  <textarea
                    value={form.donorMessage}
                    onChange={(event) => setForm((prev) => ({ ...prev, donorMessage: event.target.value }))}
                    rows={4}
                    className="ga-support-textarea"
                    placeholder="Optional message of support"
                  />
                </label>

                <div>
                  <label className="ga-support-label-title">Choose a payment method</label>
                  <div className="ga-support-methods">
                    {methodOptions.map((option) => (
                      <label
                        key={option.id}
                        className={`ga-support-method ${method === option.id ? "is-active" : ""}`}
                      >
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
                </div>

                {method === "BANK_TRANSFER" || method === "JAZZCASH" ? (
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
                        onClick={() =>
                          copyValue(bankDetails.map(([label, value]) => `${label}: ${value}`).join("\n"))
                        }
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
                          required
                        />
                      </label>
                      <label>
                        Sender number
                        <input
                          value={form.senderNumber}
                          onChange={(event) => setForm((prev) => ({ ...prev, senderNumber: event.target.value }))}
                        />
                      </label>
                    </div>

                    <div className="ga-support-form-grid">
                      <label>
                        Reference key
                        <input
                          value={form.referenceKey}
                          onChange={(event) => setForm((prev) => ({ ...prev, referenceKey: event.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        Notes for admin
                        <input
                          value={form.notes}
                          onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                          placeholder="Optional note"
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                <div className="ga-support-total-row">
                  <div>
                    <strong>Donation summary</strong>
                    <p>You will be charged exactly the amount selected below.</p>
                  </div>
                  <span>£{Number.isFinite(activeAmount) ? activeAmount.toFixed(2) : "0.00"}</span>
                </div>

                {success ? <p className="ga-dashboard-success">{success}</p> : null}
                {error ? <p className="ga-dashboard-error">{error}</p> : null}

                <button type="submit" className="ga-btn ga-btn-primary ga-support-submit" disabled={loading}>
                  {loading ? "Processing..." : summaryLabel}
                </button>
              </form>
            </article>

            <aside className="ga-support-side-column">
              <article className="ga-dashboard-card ga-support-side-card">
                <p className="ga-dashboard-card-title">Your support in one glance</p>
                <div className="ga-support-side-list">
                  <div className="ga-support-side-item">
                    <strong>Purpose</strong>
                    <p>Help visitors instantly understand this page is for sponsoring a child&apos;s learning journey.</p>
                  </div>
                  <div className="ga-support-side-item">
                    <strong>Action</strong>
                    <p>Clear CTA buttons lead donors directly to the support form without confusion.</p>
                  </div>
                  <div className="ga-support-side-item">
                    <strong>Trust</strong>
                    <p>Simple steps, visible payment options, and manual transfer details improve confidence.</p>
                  </div>
                </div>
              </article>

              <article className="ga-dashboard-card ga-support-side-card ga-support-side-cta">
                <p className="ga-dashboard-card-title">Ready to support our mission?</p>
                <p className="ga-dashboard-muted">
                  Fill the support form and help us invest in knowledge, tarbiyah, and the next generation.
                </p>
                <button type="button" className="ga-btn ga-btn-primary" onClick={scrollToForm}>
                  Support a Child Now
                </button>
              </article>
            </aside>
          </section>
        </div>
      </section>
    </main>
  );
}
