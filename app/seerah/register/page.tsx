"use client";

import { PaymentMethod } from "@prisma/client";
import { countries } from "countries-list";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Header } from "@/components/home/sections/header";

type PricingResponse = {
  pricing: {
    baseAmount: number;
    autoDiscountAmount: number;
    couponDiscountAmount: number;
    finalAmount: number;
    currency: string;
    autoDiscountApplied: boolean;
    canUseCoupon: boolean;
    allowedPaymentMethods: PaymentMethod[];
    display: {
      baseGbp: number;
      finalGbpApprox: number;
      exchangeRateApprox: number;
    };
  };
  error?: string;
};

type RegisterResponse = {
  registrationId: string;
  paymentReference: string;
  error?: string;
  details?: {
    formErrors?: string[];
    fieldErrors?: Record<string, string[] | undefined>;
  };
};

type RegistrationFormState = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phoneCountryCode: string;
  phoneNumber: string;
  countryCode: string;
  countryName: string;
  couponCode: string;
  paymentMethod: PaymentMethod;
  manualSenderName: string;
  manualReferenceKey: string;
  manualNotes: string;
};

type PhoneCountry = {
  id: string;
  label: string;
  dialCode: string;
  countryCode: string;
  countryName: string;
  flagUrl: string;
};

const SOUTH_ASIA_CODES = new Set(["PK", "IN", "AF", "BD"]);

const southAsiaLocalCurrencyApprox: Record<string, { currency: string; multiplier: number }> = {
  PK: { currency: "PKR", multiplier: 1 },
  IN: { currency: "INR", multiplier: 0.3 },
  BD: { currency: "BDT", multiplier: 0.42 },
  AF: { currency: "AFN", multiplier: 0.15 },
};

const paymentLabels: Record<PaymentMethod, string> = {
  STRIPE: "Stripe/Card",
  PAYPAL: "PayPal",
  BANK_TRANSFER: "Bank Transfer",
  EASYPAISA: "Easypaisa",
  JAZZCASH: "JazzCash",
  NAYAPAY: "Nayapay",
};

const supportWhatsappNumber = "03181602388";
const supportWhatsappHref = "https://wa.me/923181602388";

function formatMoney(amount: number, currency: string, isMinor = false) {
  const value = isMinor ? amount / 100 : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(value);
}

function getDynamicPhoneCountries(): PhoneCountry[] {
  return Object.entries(countries)
    .map(([code, value]) => {
      const dial = value.phone?.[0];
      if (!dial) return null;
      return {
        id: code,
        label: `${value.name} (+${dial})`,
        dialCode: `+${dial}`,
        countryCode: code,
        countryName: value.name,
        flagUrl: `https://flagcdn.com/w40/${code.toLowerCase()}.png`,
      } satisfies PhoneCountry;
    })
    .filter((item): item is PhoneCountry => Boolean(item))
    .sort((a, b) => a.countryName.localeCompare(b.countryName));
}

export default function SeerahRegisterPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingResponse["pricing"] | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement | null>(null);
  const countrySearchRef = useRef<HTMLInputElement | null>(null);

  const phoneCountries = useMemo(getDynamicPhoneCountries, []);
  const defaultCountry = useMemo(
    () => phoneCountries.find((item) => item.countryCode === "GB") ?? phoneCountries[0],
    [phoneCountries],
  );

  const [selectedPhoneCountryId, setSelectedPhoneCountryId] = useState(defaultCountry?.id ?? "GB");
  const selectedPhoneCountry = useMemo(
    () => phoneCountries.find((item) => item.id === selectedPhoneCountryId) ?? defaultCountry,
    [phoneCountries, selectedPhoneCountryId, defaultCountry],
  );

  const [form, setForm] = useState<RegistrationFormState>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phoneCountryCode: defaultCountry?.dialCode ?? "+44",
    phoneNumber: "",
    countryCode: defaultCountry?.countryCode ?? "GB",
    countryName: defaultCountry?.countryName ?? "United Kingdom",
    couponCode: "",
    paymentMethod: PaymentMethod.STRIPE,
    manualSenderName: "",
    manualReferenceKey: "",
    manualNotes: "",
  });

  useEffect(() => {
    if (!defaultCountry) return;
    setSelectedPhoneCountryId(defaultCountry.id);
    setForm((prev) => ({
      ...prev,
      phoneCountryCode: defaultCountry.dialCode,
      countryCode: defaultCountry.countryCode,
      countryName: defaultCountry.countryName,
    }));
  }, [defaultCountry]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!countryDropdownRef.current) return;
      if (!countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
        setCountrySearch("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (isCountryDropdownOpen) {
      countrySearchRef.current?.focus();
    }
  }, [isCountryDropdownOpen]);

  const filteredPhoneCountries = useMemo(() => {
    const term = countrySearch.trim().toLowerCase();
    if (!term) return phoneCountries;
    return phoneCountries.filter((item) => item.countryName.toLowerCase().startsWith(term));
  }, [countrySearch, phoneCountries]);

  const fetchPricing = useCallback(async (nextCouponCode?: string) => {
    const normalizedCountryCode = form.countryCode.trim().toUpperCase();
    if (normalizedCountryCode.length !== 2) {
      setPricing(null);
      return;
    }

    setError(null);
    setInfo(null);
    try {
      const response = await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "seerah-course",
          countryCode: normalizedCountryCode,
          couponCode: nextCouponCode ?? form.couponCode,
        }),
      });

      const data = (await response.json()) as PricingResponse;
      if (!response.ok || data.error) {
        throw new Error(data.error || "Could not fetch pricing.");
      }

      setPricing(data.pricing);
      if (!data.pricing.allowedPaymentMethods.includes(form.paymentMethod)) {
        setForm((prev) => ({
          ...prev,
          paymentMethod: data.pricing.allowedPaymentMethods[0] ?? PaymentMethod.STRIPE,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pricing error.");
    }
  }, [form.countryCode, form.couponCode, form.paymentMethod]);

  useEffect(() => {
    void fetchPricing();
  }, [fetchPricing]);

  async function copyToClipboard(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setInfo(`${label} copied.`);
      setError(null);
    } catch {
      setError(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pricing) {
      setError("Pricing is still loading. Please wait.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Confirm password does not match.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      const registerResponse = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          countryCode: form.countryCode.trim().toUpperCase(),
          courseSlug: "seerah-course",
        }),
      });

      const registerData = (await registerResponse.json()) as RegisterResponse;
      if (!registerResponse.ok) {
        const detailMessage =
          registerData.details?.formErrors?.[0] ??
          Object.values(registerData.details?.fieldErrors ?? {}).flat().find(Boolean);
        throw new Error(detailMessage || registerData.error || "Registration failed.");
      }

      const registrationId = registerData.registrationId;
      const paymentReference = registerData.paymentReference;

      if (form.paymentMethod === PaymentMethod.STRIPE) {
        const stripeResponse = await fetch("/api/payments/stripe/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId }),
        });
        const stripeData = await stripeResponse.json();
        if (!stripeResponse.ok || !stripeData.checkoutUrl) {
          throw new Error(stripeData.error || "Could not start Stripe checkout.");
        }
        window.location.href = stripeData.checkoutUrl;
        return;
      }

      if (form.paymentMethod === PaymentMethod.PAYPAL) {
        const paypalResponse = await fetch("/api/payments/paypal/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId }),
        });
        const paypalData = await paypalResponse.json();
        if (!paypalResponse.ok || !paypalData.approveUrl) {
          throw new Error(paypalData.error || "Could not start PayPal checkout.");
        }
        window.location.href = paypalData.approveUrl;
        return;
      }

      if (!form.manualReferenceKey.trim()) {
        throw new Error("Please provide transfer reference key before submitting manual payment.");
      }
      if (!form.manualSenderName.trim()) {
        throw new Error("Please provide sender name for manual payment verification.");
      }

      const manualResponse = await fetch("/api/payments/manual/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId,
          method: form.paymentMethod,
          senderName: form.manualSenderName || form.fullName,
          referenceKey: form.manualReferenceKey,
          notes: form.manualNotes
            ? `${form.manualNotes}\nPlatformRef:${paymentReference}`
            : `PlatformRef:${paymentReference}`,
        }),
      });
      const manualData = await manualResponse.json();
      if (!manualResponse.ok) {
        throw new Error(manualData.error || "Manual payment submission failed.");
      }

      setInfo(
        `Manual payment submitted. Status is pending admin verification. Your platform reference is ${paymentReference}.`,
      );
      router.push("/dashboard?payment=manual-under-review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration error.");
    } finally {
      setSubmitting(false);
    }
  }

  const isSouthAsia = SOUTH_ASIA_CODES.has(form.countryCode);
  const passwordMatchState =
    !form.confirmPassword.trim()
      ? null
      : form.password === form.confirmPassword
        ? "match"
        : "mismatch";
  const localApprox = southAsiaLocalCurrencyApprox[form.countryCode]
    ? {
        currency: southAsiaLocalCurrencyApprox[form.countryCode].currency,
        amount: Math.round(2000 * southAsiaLocalCurrencyApprox[form.countryCode].multiplier),
      }
    : null;

  const visiblePoundPrice = isSouthAsia && pricing
    ? `${formatMoney(Math.round(pricing.display.finalGbpApprox * 100), "GBP", true)}/mo`
    : "GBP 20.00/mo";
  const visibleConverted = isSouthAsia
    ? `${localApprox ? `(~${formatMoney(localApprox.amount, localApprox.currency)})` : ""}`
    : "";

  const orderSummaryAmount = isSouthAsia
    ? `${visiblePoundPrice} ${visibleConverted}`
    : pricing
      ? `${formatMoney(pricing.baseAmount, "GBP", true)}/mo`
      : "GBP 20.00/mo";

  return (
    <>
      <Header />
      <main className="ga-page" style={{ minHeight: "100vh" }}>
      {isModalOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(3, 16, 36, 0.72)",
            zIndex: 120,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "6.5rem 1rem 1rem",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              width: "min(100%, 480px)",
              background: "#f2f7fb",
              borderRadius: "12px",
              border: "1px solid #8db3d3",
              overflow: "hidden",
              boxShadow: "0 24px 42px rgba(0,0,0,0.35)",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                background: "#1f6d9f",
                color: "#e8f6ff",
                padding: "0.85rem 0.95rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "1.08rem" }}>Enroll Now</p>
                <p style={{ margin: 0, fontSize: "0.76rem", opacity: 0.9 }}>Global Awakening</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "999px",
                  border: "1px solid rgba(255,255,255,0.4)",
                  background: "rgba(255,255,255,0.1)",
                  color: "#e8f6ff",
                  cursor: "pointer",
                }}
              >
                x
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              style={{ padding: "0.9rem", display: "grid", gap: "0.62rem", color: "#2a4058", overflowY: "auto" }}
            >
              <label style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                Full Name*
                <input
                  name="fullName"
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                  required
                  placeholder="Enter your full name"
                  style={{ width: "100%", marginTop: 4, padding: "0.56rem", borderRadius: 6, border: "1px solid #b8cadb" }}
                />
              </label>

              <label style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                Email Address*
                <input
                  name="email"
                  autoComplete="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                  placeholder="you@example.com"
                  style={{ width: "100%", marginTop: 4, padding: "0.56rem", borderRadius: 6, border: "1px solid #b8cadb" }}
                />
              </label>

              <label style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                Create Password*
                <div style={{ position: "relative", marginTop: 4 }}>
                  <input
                    name="password"
                    autoComplete="new-password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                    required
                    placeholder="Minimum 8 characters"
                    style={{ width: "100%", padding: "0.56rem 2.8rem 0.56rem 0.56rem", borderRadius: 6, border: "1px solid #b8cadb" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute",
                      top: "50%",
                      right: 8,
                      transform: "translateY(-50%)",
                      border: 0,
                      background: "transparent",
                      color: "#50708f",
                      cursor: "pointer",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                    }}
                  >
                    {showPassword ? "Hide" : "View"}
                  </button>
                </div>
              </label>

              <label style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                Confirm Password*
                <div style={{ position: "relative", marginTop: 4 }}>
                  <input
                    name="confirmPassword"
                    autoComplete="new-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                    required
                    placeholder="Re-enter password"
                    style={{ width: "100%", padding: "0.56rem 2.8rem 0.56rem 0.56rem", borderRadius: 6, border: "1px solid #b8cadb" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    style={{
                      position: "absolute",
                      top: "50%",
                      right: 8,
                      transform: "translateY(-50%)",
                      border: 0,
                      background: "transparent",
                      color: "#50708f",
                      cursor: "pointer",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                    }}
                  >
                    {showConfirmPassword ? "Hide" : "View"}
                  </button>
                </div>
                {passwordMatchState === "match" ? (
                  <p style={{ margin: "0.28rem 0 0", color: "#1d6b43", fontSize: "0.72rem", fontWeight: 700 }}>
                    Confirm password matches.
                  </p>
                ) : null}
                {passwordMatchState === "mismatch" ? (
                  <p style={{ margin: "0.28rem 0 0", color: "#c03b3b", fontSize: "0.72rem", fontWeight: 700 }}>
                    Confirm password does not match.
                  </p>
                ) : null}
              </label>

              <label style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                Phone / WhatsApp Number*
                <div style={{ display: "grid", gridTemplateColumns: "170px 1fr", gap: "0.5rem", marginTop: 4 }}>
                  <div ref={countryDropdownRef} style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCountryDropdownOpen((prev) => !prev);
                        setCountrySearch("");
                      }}
                      style={{
                        width: "100%",
                        padding: "0.42rem 0.48rem",
                        borderRadius: 6,
                        border: "1px solid #b8cadb",
                        background: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.4rem",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "0.42rem", minWidth: 0 }}>
                        <Image
                          src={selectedPhoneCountry?.flagUrl ?? ""}
                          alt={selectedPhoneCountry?.countryCode ?? "flag"}
                          width={26}
                          height={18}
                          style={{ borderRadius: 3, border: "1px solid #d3dce6", objectFit: "cover", flexShrink: 0 }}
                        />
                        <span style={{ fontSize: "0.78rem", color: "#2b4661", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {selectedPhoneCountry?.label}
                        </span>
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "#4f6981" }}>v</span>
                    </button>

                    {isCountryDropdownOpen ? (
                      <div
                        style={{
                          position: "absolute",
                          zIndex: 100,
                          top: "calc(100% + 4px)",
                          left: 0,
                          right: 0,
                          maxHeight: 220,
                          overflowY: "auto",
                          borderRadius: 8,
                          border: "1px solid #b8cadb",
                          background: "#fff",
                          boxShadow: "0 10px 22px rgba(15, 37, 61, 0.2)",
                        }}
                      >
                        <div style={{ padding: "0.4rem", borderBottom: "1px solid #edf2f7" }}>
                          <input
                            ref={countrySearchRef}
                            value={countrySearch}
                            onChange={(event) => setCountrySearch(event.target.value)}
                            placeholder="Type country name..."
                            style={{
                              width: "100%",
                              padding: "0.45rem 0.5rem",
                              borderRadius: 6,
                              border: "1px solid #c7d7e6",
                              fontSize: "0.78rem",
                            }}
                          />
                        </div>
                        {filteredPhoneCountries.length === 0 ? (
                          <p style={{ margin: 0, padding: "0.6rem", fontSize: "0.76rem", color: "#5c7590" }}>
                            No country found.
                          </p>
                        ) : null}
                        {filteredPhoneCountries.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSelectedPhoneCountryId(item.id);
                              setForm((prev) => ({
                                ...prev,
                                phoneCountryCode: item.dialCode,
                                countryCode: item.countryCode,
                                countryName: item.countryName,
                              }));
                              setIsCountryDropdownOpen(false);
                              setCountrySearch("");
                            }}
                            style={{
                              width: "100%",
                              border: 0,
                              borderBottom: "1px solid #edf2f7",
                              background: "#fff",
                              padding: "0.45rem 0.5rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.42rem",
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            <Image
                              src={item.flagUrl}
                              alt={item.countryCode}
                              width={26}
                              height={18}
                              style={{ borderRadius: 3, border: "1px solid #d3dce6", objectFit: "cover", flexShrink: 0 }}
                            />
                            <span style={{ fontSize: "0.76rem", color: "#2b4661" }}>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <input
                    name="phoneNumber"
                    autoComplete="tel-national"
                    value={form.phoneNumber}
                    onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value.replace(/[^0-9]/g, "") }))}
                    required
                    placeholder="3001234567"
                    style={{ padding: "0.54rem", borderRadius: 6, border: "1px solid #b8cadb" }}
                  />
                </div>
              </label>

              <label style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                Select Program*
                <select style={{ width: "100%", marginTop: 4, padding: "0.56rem", borderRadius: 6, border: "1px solid #b8cadb", background: "#fff" }}>
                  <option>Prophetic Seerah and Planning</option>
                </select>
              </label>

              {isSouthAsia && pricing ? (
                <div style={{ background: "#dbf0e2", border: "1px solid #9fd2b0", borderRadius: 8, padding: "0.62rem" }}>
                  <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 800, color: "#1f6a44" }}>South Asian Family Discount</p>
                  <p style={{ margin: "0.2rem 0 0.35rem", fontSize: "0.72rem", color: "#25694b" }}>
                    Learning made easier, enjoy this special regional discount.
                  </p>
                  <p style={{ margin: 0, fontWeight: 700, color: "#154e31" }}>
                    {visiblePoundPrice} {visibleConverted}
                  </p>
                </div>
              ) : null}

              <div style={{ background: "#fff", border: "1px solid #d5e2ee", borderRadius: 8, padding: "0.64rem", fontSize: "0.85rem" }}>
                <p style={{ margin: "0 0 0.45rem", color: "#5b7e9e", fontWeight: 700, fontSize: "0.66rem" }}>ORDER SUMMARY</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span>Prophetic Seerah and Planning</span>
                  <span>{orderSummaryAmount}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: "#1b6ea3" }}>
                  <span>Total</span>
                  <span>{orderSummaryAmount}</span>
                </div>
              </div>

              <div style={{ display: "grid", gap: "0.4rem" }}>
                <p style={{ margin: 0, fontSize: "0.66rem", fontWeight: 700, color: "#5b7e9e" }}>PAYMENT METHOD</p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {(pricing?.allowedPaymentMethods ?? [PaymentMethod.STRIPE, PaymentMethod.PAYPAL]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, paymentMethod: method }))}
                      style={{
                        border: `1px solid ${form.paymentMethod === method ? "#1e6fa3" : "#9db7ce"}`,
                        background: form.paymentMethod === method ? "#e7f2fc" : "#fff",
                        color: "#2a4a66",
                        borderRadius: 7,
                        padding: "0.44rem 0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {paymentLabels[method]}
                    </button>
                  ))}
                </div>
                {form.countryCode === "PK" &&
                (form.paymentMethod === PaymentMethod.BANK_TRANSFER || form.paymentMethod === PaymentMethod.JAZZCASH) ? (
                  <div style={{ display: "grid", gap: "0.55rem" }}>
                    <div
                      style={{
                        fontSize: "0.73rem",
                        color: "#2f5576",
                        background: "#edf4fb",
                        border: "1px solid #c2d8ec",
                        borderRadius: 7,
                        padding: "0.55rem",
                      }}
                    >
                      Use your platform reference in the payment note. After payment, send your screenshot to WhatsApp support on{" "}
                      <a href={supportWhatsappHref} target="_blank" rel="noreferrer" style={{ color: "#1f6d9f", fontWeight: 700 }}>
                        {supportWhatsappNumber}
                      </a>{" "}
                      so your payment can be confirmed from the backend.
                    </div>
                    {form.paymentMethod === PaymentMethod.BANK_TRANSFER ? (
                      <div style={{ background: "#fff", border: "1px solid #cfe0ee", borderRadius: 7, padding: "0.7rem", display: "grid", gap: "0.45rem" }}>
                        <p style={{ margin: 0, fontSize: "0.74rem", fontWeight: 800, color: "#1f4f73" }}>[BANK] Meezan Bank</p>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", alignItems: "center" }}>
                          <span style={{ fontSize: "0.74rem", color: "#2d4a67" }}>Account Title: AREEJ FATIMA</span>
                          <button type="button" onClick={() => void copyToClipboard("AREEJ FATIMA", "Account title")} style={{ border: "1px solid #bfd4e6", background: "#eff7fd", borderRadius: 6, padding: "0.25rem 0.6rem", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}>Copy</button>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", alignItems: "center" }}>
                          <span style={{ fontSize: "0.74rem", color: "#2d4a67" }}>Account Number: 98900114432111</span>
                          <button type="button" onClick={() => void copyToClipboard("98900114432111", "Account number")} style={{ border: "1px solid #bfd4e6", background: "#eff7fd", borderRadius: 6, padding: "0.25rem 0.6rem", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}>Copy</button>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", alignItems: "center" }}>
                          <span style={{ fontSize: "0.74rem", color: "#2d4a67" }}>IBAN: PK96MEZN0098900114432111</span>
                          <button type="button" onClick={() => void copyToClipboard("PK96MEZN0098900114432111", "IBAN")} style={{ border: "1px solid #bfd4e6", background: "#eff7fd", borderRadius: 6, padding: "0.25rem 0.6rem", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}>Copy</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: "#fff", border: "1px solid #cfe0ee", borderRadius: 7, padding: "0.7rem", display: "grid", gap: "0.45rem" }}>
                        <p style={{ margin: 0, fontSize: "0.74rem", fontWeight: 800, color: "#1f4f73" }}>[JAZZ] JazzCash</p>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", alignItems: "center" }}>
                          <span style={{ fontSize: "0.74rem", color: "#2d4a67" }}>Areej Fatima</span>
                          <button type="button" onClick={() => void copyToClipboard("Areej Fatima", "JazzCash account name")} style={{ border: "1px solid #bfd4e6", background: "#eff7fd", borderRadius: 6, padding: "0.25rem 0.6rem", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}>Copy</button>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", alignItems: "center" }}>
                          <span style={{ fontSize: "0.74rem", color: "#2d4a67" }}>03244517741</span>
                          <button type="button" onClick={() => void copyToClipboard("03244517741", "JazzCash number")} style={{ border: "1px solid #bfd4e6", background: "#eff7fd", borderRadius: 6, padding: "0.25rem 0.6rem", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}>Copy</button>
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize: "0.73rem", color: "#2f5576", background: "#fff7ea", border: "1px solid #edd4a4", borderRadius: 7, padding: "0.55rem" }}>
                      Got stuck in payment? Contact our support team on{" "}
                      <a href={supportWhatsappHref} target="_blank" rel="noreferrer" style={{ color: "#1f6d9f", fontWeight: 700 }}>
                        {supportWhatsappNumber}
                      </a>.
                    </div>

                    <label style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                      Sender Name*
                      <input
                        value={form.manualSenderName}
                        onChange={(event) => setForm((prev) => ({ ...prev, manualSenderName: event.target.value }))}
                        placeholder="Name used for transfer"
                        style={{ width: "100%", marginTop: 4, padding: "0.56rem", borderRadius: 6, border: "1px solid #b8cadb" }}
                      />
                    </label>
                    <label style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                      Transfer Reference ID*
                      <input
                        value={form.manualReferenceKey}
                        onChange={(event) => setForm((prev) => ({ ...prev, manualReferenceKey: event.target.value }))}
                        placeholder="Transaction / reference id"
                        style={{ width: "100%", marginTop: 4, padding: "0.56rem", borderRadius: 6, border: "1px solid #b8cadb" }}
                      />
                    </label>
                    <label style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                      Notes (optional)
                      <textarea
                        value={form.manualNotes}
                        onChange={(event) => setForm((prev) => ({ ...prev, manualNotes: event.target.value }))}
                        placeholder="Any note for admin verification"
                        rows={2}
                        style={{ width: "100%", marginTop: 4, padding: "0.56rem", borderRadius: 6, border: "1px solid #b8cadb", resize: "vertical" }}
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              {error ? <p style={{ margin: 0, color: "#c03b3b", fontSize: "0.8rem" }}>{error}</p> : null}
              {info ? <p style={{ margin: 0, color: "#1d5d3f", fontSize: "0.8rem" }}>{info}</p> : null}

              <button
                type="submit"
                disabled={submitting || !pricing}
                style={{
                  border: "1px solid #7fa7c8",
                  background: "#83a8c6",
                  color: "#f3fbff",
                  borderRadius: 7,
                  padding: "0.72rem",
                  fontSize: "0.95rem",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {submitting
                  ? "Processing..."
                  : form.paymentMethod === PaymentMethod.BANK_TRANSFER || form.paymentMethod === PaymentMethod.JAZZCASH
                    ? "Submit Manual Payment"
                    : "Continue to Payment"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <section className="ga-section">
          <div className="ga-container" style={{ maxWidth: 720, textAlign: "center" }}>
            <h1 className="ga-heading">Ready to evolve in learning</h1>
            <p className="ga-copy" style={{ marginTop: "0.7rem" }}>
              Your Seerah journey starts with one enrollment.
            </p>
            <div style={{ marginTop: "1.25rem" }}>
              <button type="button" className="ga-btn ga-btn-primary" onClick={() => setIsModalOpen(true)}>
                Enroll Now
              </button>
            </div>
          </div>
        </section>
      )}
      </main>
    </>
  );
}
