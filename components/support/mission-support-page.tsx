"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const amountOptions = [5, 10, 20, 50];
const methodOptions = [
  { id: "STRIPE", label: "Stripe / Card", description: "Fast card payment with instant confirmation." },
  { id: "PAYPAL", label: "PayPal", description: "Pay with PayPal balance or linked card." },
  { id: "BANK_TRANSFER", label: "Bank Transfer", description: "Manual transfer with admin verification." },
  { id: "JAZZCASH", label: "JazzCash", description: "Manual wallet payment for Pakistan donors." },
] as const;

type MethodId = (typeof methodOptions)[number]["id"];

const bankDetails = [
  ["Account Title", "AREEJ FATIMA"],
  ["Account Number", "98900114432111"],
  ["IBAN", "PK96MEZN0098900114432111"],
];

export default function MissionSupportPage() {
  const searchParams = useSearchParams();
  const paypalCaptureRan = useRef(false);

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

  return (
    <main className="ga-page">
      <section className="ga-section">
        <div className="ga-container" style={{ display: "grid", gap: "1.5rem" }}>
          <div className="ga-dashboard-hero" style={{ alignItems: "start" }}>
            <div>
              <p className="ga-dashboard-kicker">Support Our Mission</p>
              <h1 className="ga-heading" style={{ maxWidth: 760 }}>
                Sponsor a child. Strengthen access to knowledge. Build the next generation of Muslim leaders.
              </h1>
              <p className="ga-copy" style={{ marginTop: "0.85rem", maxWidth: 820 }}>
                Through TGA&apos;s Sponsor a Child initiative, your support helps children access structured online
                education, mentorship, and the guidance they need to grow into confident and capable leaders.
              </p>
            </div>
            <div className="ga-dashboard-card" style={{ minWidth: 260 }}>
              <p className="ga-dashboard-card-title">Impact snapshot</p>
              <div className="ga-dashboard-stack">
                <p>Structured online educational programs</p>
                <p>Mentorship and life skills support</p>
                <p>Long-term community empowerment through knowledge</p>
              </div>
            </div>
          </div>

          <section className="ga-dashboard-split">
            <article className="ga-dashboard-card">
              <p className="ga-dashboard-card-title">Why Sponsorship Matters</p>
              <div className="ga-dashboard-stack">
                <p>Education can transform lives, families, and communities.</p>
                <p>Your sponsorship helps break barriers to learning and supports confident, capable leadership.</p>
                <p>Every child supported today helps build a stronger future for tomorrow.</p>
              </div>

              <p className="ga-dashboard-card-title" style={{ marginTop: "1.35rem" }}>How Sponsorship Works</p>
              <div className="ga-dashboard-list" style={{ marginTop: "0.9rem" }}>
                <div className="ga-dashboard-list-item">
                  <div>
                    <strong>1. Choose to Sponsor</strong>
                    <p>Select a monthly or custom amount that matches your capacity.</p>
                  </div>
                </div>
                <div className="ga-dashboard-list-item">
                  <div>
                    <strong>2. Support Their Learning</strong>
                    <p>Your contribution supports educational access, online learning, and development opportunities.</p>
                  </div>
                </div>
                <div className="ga-dashboard-list-item">
                  <div>
                    <strong>3. Change a Life</strong>
                    <p>With the right knowledge and guidance, children can grow into future leaders.</p>
                  </div>
                </div>
              </div>
            </article>

            <article className="ga-dashboard-card">
              <p className="ga-dashboard-card-title">Sponsor a Child Today</p>
              <p className="ga-dashboard-muted" style={{ marginTop: "0.55rem" }}>
                Choose an amount, add donor details, then proceed with your preferred payment method.
              </p>

              <form onSubmit={handleSubmit} className="ga-dashboard-form">
                <div>
                  <label style={{ marginBottom: "0.5rem", display: "block" }}>Choose your amount</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "0.7rem" }}>
                    {amountOptions.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        className={`ga-btn ${selectedAmount === amount ? "ga-btn-primary" : "ga-btn-outline"}`}
                        onClick={() => setSelectedAmount(amount)}
                      >
                        £{amount}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`ga-btn ${selectedAmount === "custom" ? "ga-btn-primary" : "ga-btn-outline"}`}
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

                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "0.7rem" }}>
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
                    style={{ borderRadius: "0.78rem", border: "1px solid rgba(164, 196, 226, 0.24)", background: "rgba(6, 17, 32, 0.84)", color: "#f7fbff", padding: "0.75rem 0.9rem", resize: "vertical" }}
                    placeholder="Optional message of support"
                  />
                </label>

                <div>
                  <label style={{ marginBottom: "0.6rem", display: "block" }}>Payment method</label>
                  <div style={{ display: "grid", gap: "0.7rem" }}>
                    {methodOptions.map((option) => (
                      <label key={option.id} className="ga-dashboard-list-item" style={{ cursor: "pointer" }}>
                        <div>
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

                {(method === "BANK_TRANSFER" || method === "JAZZCASH") ? (
                  <div className="ga-dashboard-list" style={{ marginTop: "0.4rem" }}>
                    <div className="ga-dashboard-list-item" style={{ alignItems: "start" }}>
                      <div>
                        <strong>Meezan Bank</strong>
                        {bankDetails.map(([label, value]) => (
                          <p key={label}>{label}: {value}</p>
                        ))}
                      </div>
                      <button type="button" className="ga-btn ga-btn-outline" onClick={() => copyValue(bankDetails.map(([label, value]) => `${label}: ${value}`).join("\n"))}>
                        Copy
                      </button>
                    </div>
                    <div className="ga-dashboard-list-item" style={{ alignItems: "start" }}>
                      <div>
                        <strong>JazzCash</strong>
                        <p>Areej Fatima: 03244517741</p>
                        <p>After sending payment, share screenshot on WhatsApp: 03181602388</p>
                      </div>
                      <button type="button" className="ga-btn ga-btn-outline" onClick={() => copyValue("Areej Fatima 03244517741")}>
                        Copy
                      </button>
                    </div>
                    <label>
                      Sender name
                      <input value={form.senderName} onChange={(event) => setForm((prev) => ({ ...prev, senderName: event.target.value }))} required />
                    </label>
                    <label>
                      Sender number
                      <input value={form.senderNumber} onChange={(event) => setForm((prev) => ({ ...prev, senderNumber: event.target.value }))} />
                    </label>
                    <label>
                      Reference key
                      <input value={form.referenceKey} onChange={(event) => setForm((prev) => ({ ...prev, referenceKey: event.target.value }))} required />
                    </label>
                    <label>
                      Notes for admin
                      <input value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Optional note" />
                    </label>
                  </div>
                ) : null}

                <div className="ga-dashboard-list-item" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div>
                    <strong>Donation summary</strong>
                    <p>You will be charged exactly the amount selected below.</p>
                  </div>
                  <span style={{ fontSize: "1.25rem", fontWeight: 700 }}>£{activeAmount.toFixed(2)}</span>
                </div>

                {success ? <p className="ga-dashboard-success">{success}</p> : null}
                {error ? <p className="ga-dashboard-error">{error}</p> : null}

                <button type="submit" className="ga-btn ga-btn-primary" disabled={loading}>
                  {loading ? "Processing..." : method === "STRIPE" || method === "PAYPAL" ? `Proceed with ${method === "STRIPE" ? "Stripe" : "PayPal"}` : "Submit Manual Support"}
                </button>
              </form>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}
