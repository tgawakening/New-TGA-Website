"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/home/sections/header";
import { Footer } from "@/components/home/sections/footer";

const amountOptions = [5, 10, 20, 50];
const methodOptions = [
  { id: "STRIPE", label: "Stripe / Card", description: "Pay securely with card." },
  { id: "PAYPAL", label: "PayPal", description: "Use your PayPal account or linked card." },
  { id: "BANK_TRANSFER", label: "Bank Transfer", description: "Transfer manually and submit your payment reference." },
  { id: "JAZZCASH", label: "JazzCash", description: "Use JazzCash and then submit your payment reference." },
] as const;

const impactPoints = [
  "Sponsor a child's educational journey.",
  "Support learning, mentorship, and guidance.",
  "Help build a stronger future through knowledge and character.",
];

const sectionCards = [
  {
    title: "Support our vision and mission",
    points: [
      "Help a child learn, grow, and lead with confidence.",
      "Support meaningful education through one organized page.",
      "Make your contribution with a clear and simple process.",
    ],
  },
  {
    title: "How support works",
    points: [
      "Choose your support amount.",
      "Fill in your details clearly.",
      "Select a payment method and complete support.",
    ],
  },
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
    <>
      <Header />
      <main className="ga-page ga-support-page">
        <section className="ga-support-band ga-support-band-hero">
          <div className="ga-container ga-support-stack">
            <div className="ga-support-hero-card">
              <p className="ga-dashboard-kicker">Support Our Vision and Mission</p>
              <h1 className="ga-support-title">Help a child learn, grow, and lead with confidence.</h1>
              <p className="ga-copy ga-support-lead">
                This page is for supporters who want to sponsor a child&apos;s educational journey through TGA. Your
                support helps provide learning, mentorship, and guidance.
              </p>
              <div className="ga-support-action-row">
                <button type="button" className="ga-btn ga-btn-primary" onClick={scrollToForm}>
                  Support Now
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="ga-support-band">
          <div className="ga-container ga-support-stack">
            <div className="ga-support-full-grid">
              {sectionCards.map((card) => (
                <article key={card.title} className="ga-support-section-card">
                  <p className="ga-dashboard-card-title">{card.title}</p>
                  <ul className="ga-support-bullet-list">
                    {card.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <article className="ga-support-section-card">
              <p className="ga-dashboard-card-title">What your support makes possible</p>
              <ul className="ga-support-bullet-list">
                {impactPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>

            <article ref={formCardRef} className="ga-support-form-wrap">
              <div className="ga-support-form-header">
                <div>
                  <p className="ga-dashboard-card-title">Support Form</p>
                  <p className="ga-support-form-copy">
                    Choose your amount, fill your details, and complete your support from this section.
                  </p>
                </div>
                <div className="ga-support-summary-chip">
                  <span>Selected support</span>
                  <strong>GBP {Number.isFinite(activeAmount) ? activeAmount.toFixed(2) : "0.00"}</strong>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="ga-dashboard-form ga-support-form">
                <section className="ga-support-form-card">
                  <div className="ga-support-section-head">
                    <p className="ga-support-section-kicker">Step 1</p>
                    <h2>Choose your amount</h2>
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

                <section className="ga-support-form-card">
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
                    />
                  </label>

                  <label>
                    Message
                    <textarea
                      value={form.donorMessage}
                      onChange={(event) => setForm((prev) => ({ ...prev, donorMessage: event.target.value }))}
                      rows={4}
                      className="ga-support-textarea"
                    />
                  </label>
                </section>

                <section className="ga-support-form-card">
                  <div className="ga-support-section-head">
                    <p className="ga-support-section-kicker">Step 3</p>
                    <h2>Payment method</h2>
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

                  <ul className="ga-support-payment-notes">
                    <li>Choose one payment method only.</li>
                    <li>For manual payments, add sender details and reference clearly.</li>
                    <li>Manual support stays pending until admin verification.</li>
                  </ul>
                </section>

                {isManualMethod ? (
                  <section className="ga-support-form-card">
                    <div className="ga-support-section-head">
                      <p className="ga-support-section-kicker">Manual Payment</p>
                      <h2>Transfer details</h2>
                    </div>

                    <div className="ga-support-manual-grid">
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
                          <p>WhatsApp after payment: 03181602388</p>
                        </div>
                        <button
                          type="button"
                          className="ga-btn ga-btn-outline"
                          onClick={() => copyValue("Areej Fatima 03244517741")}
                        >
                          Copy
                        </button>
                      </div>
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
                        Notes
                        <input
                          value={form.notes}
                          onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                        />
                      </label>
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

                {success ? <p className="ga-dashboard-success">{success}</p> : null}
                {error ? <p className="ga-dashboard-error">{error}</p> : null}

                <button type="submit" className="ga-btn ga-btn-primary ga-support-submit" disabled={loading}>
                  {loading ? "Processing..." : summaryLabel}
                </button>
              </form>
            </article>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
