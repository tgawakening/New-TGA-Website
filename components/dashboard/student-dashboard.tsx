"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { countries } from "countries-list";
import LogoutButton from "@/components/dashboard/logout-button";
import { paymentPlanTypeLabels } from "@/lib/course-payment";

type DashboardProps = {
  user: {
    id: string;
    fullName: string;
    email: string;
    phoneCountryCode: string;
    phoneNumber: string;
    canManageStripeBilling: boolean;
    studentProfile: {
      countryCode: string;
      countryName: string;
      timezone: string | null;
    } | null;
    enrollments: Array<{
      status: string;
      activatedAt: string | null;
      course: {
        slug: string;
        title: string;
      };
    }>;
    registrations: Array<{
      id: string;
      selectedCurrency: string;
      finalAmount: number;
      paymentPlanType: "SUBSCRIPTION" | "FULL_COURSE";
      status: string;
      paymentMethod: string;
      paymentReference: string | null;
      createdAt: string;
      course: {
        slug: string;
        title: string;
      };
      payment: {
        amount: number;
        currency: string;
        status: string;
        paidAt: string | null;
      } | null;
    }>;
    subscriptions: Array<{
      status: string;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
    }>;
  };
};

const seerahLessons = [
  { title: "Introduction to Prophetic Strategy", type: "Recorded", access: "Available now" },
  { title: "Makkan Period Leadership", type: "Recorded", access: "Available now" },
  { title: "Diplomacy and Treaty Building", type: "Recorded", access: "Available now" },
  { title: "Weekly Live Reflection Circle", type: "Live", access: "Saturday 10:00 AM PKT" },
];

const supportLinks = [
  { label: "WhatsApp Community", href: "https://chat.whatsapp.com/EXcZmIOG9c8LOSdjK7KMko" },
  { label: "Course Registration", href: "/seerah/register" },
  { label: "Admin Panel", href: "/admin" },
];

function formatMoney(amount: number, currency: string) {
  const normalizedCurrency = currency.toUpperCase();
  const formattedAmount = normalizedCurrency === "GBP" ? amount / 100 : amount;

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(formattedAmount);
  } catch {
    return `${normalizedCurrency} ${formattedAmount}`;
  }
}

export default function StudentDashboard({ user }: DashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState(user.fullName);
  const [phoneCountryCode, setPhoneCountryCode] = useState(user.phoneCountryCode);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber);
  const [countryCode, setCountryCode] = useState(user.studentProfile?.countryCode ?? "GB");
  const [countryName, setCountryName] = useState(user.studentProfile?.countryName ?? "United Kingdom");
  const [timezone, setTimezone] = useState(user.studentProfile?.timezone ?? "");
  const [saving, setSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [billingPortalLoading, setBillingPortalLoading] = useState(false);
  const paymentSyncRan = useRef(false);

  const seerahEnrollment = user.enrollments.find((item) => item.course.slug === "seerah-course");
  const latestRegistration = user.registrations.find((item) => item.course.slug === "seerah-course");
  const latestSubscription = user.subscriptions[0];
  const hasActiveLmsAccess = seerahEnrollment?.status === "ACTIVE";
  const latestPaymentPlanLabel = latestRegistration ? paymentPlanTypeLabels[latestRegistration.paymentPlanType] : "N/A";
  const hasPendingPayment = Boolean(
    latestRegistration &&
      latestRegistration.payment &&
      latestRegistration.payment.status !== "SUCCEEDED" &&
      latestRegistration.payment.status !== "CONFIRMED" &&
      latestRegistration.status !== "ACTIVE" &&
      latestRegistration.status !== "PAID",
  );
  const pendingPaymentHref = latestRegistration ? `/seerah/register?resume=${encodeURIComponent(latestRegistration.id)}` : "/seerah/register";

  const countryEntries = useMemo(
    () =>
      Object.entries(countries)
        .map(([code, details]) => ({ code, name: details.name, phone: details.phone[0] ?? "" }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [],
  );

  useEffect(() => {
    if (paymentSyncRan.current) return;

    const payment = searchParams.get("payment");
    if (payment === "manual-under-review") {
      setPaymentError(null);
      setPaymentMessage("Your manual payment has been submitted. You can return here any time or complete another pending payment from below.");
      return;
    }

    const provider = searchParams.get("provider");
    const registrationId = searchParams.get("registrationId");
    if (payment !== "success" || !provider || !registrationId) return;

    paymentSyncRan.current = true;
    setPaymentError(null);
    setPaymentMessage(provider === "paypal" ? "Confirming your PayPal payment..." : "Confirming your Stripe payment...");

    const finish = (message?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("payment");
      params.delete("provider");
      params.delete("registrationId");
      params.delete("session_id");
      params.delete("token");
      params.delete("PayerID");
      params.delete("subscription_id");
      params.delete("ba_token");
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
      router.refresh();
      if (message) {
        setPaymentMessage(message);
      }
    };

    if (provider === "paypal") {
      const subscriptionId = searchParams.get("subscription_id") || searchParams.get("ba_token");
      if (subscriptionId) {
        setPaymentMessage("Confirming your PayPal subscription...");
        void fetch("/api/payments/paypal/confirm-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId, subscriptionId }),
        })
          .then(async (response) => {
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) {
              throw new Error(payload.error || "PayPal subscription confirmation failed.");
            }
            finish("Your PayPal subscription is active and your registration is now fully active.");
          })
          .catch((error: unknown) => {
            setPaymentError(error instanceof Error ? error.message : "PayPal subscription confirmation failed.");
            setPaymentMessage(null);
          });
        return;
      }

      const orderId = searchParams.get("token");
      if (!orderId) {
        setPaymentError("PayPal returned without an order token, so payment could not be confirmed automatically.");
        finish();
        return;
      }

      void fetch("/api/payments/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, orderId }),
      })
        .then(async (response) => {
          const payload = (await response.json()) as { error?: string };
          if (!response.ok) {
            throw new Error(payload.error || "PayPal payment confirmation failed.");
          }
          finish("Your payment has been confirmed and your registration is now fully active.");
        })
        .catch((error: unknown) => {
          setPaymentError(error instanceof Error ? error.message : "PayPal payment confirmation failed.");
          setPaymentMessage(null);
        });
      return;
    }

    if (provider === "stripe") {
      const sessionId = searchParams.get("session_id");
      if (!sessionId) {
        setPaymentError("Stripe returned without a session id, so payment could not be confirmed automatically.");
        finish();
        return;
      }

      void fetch("/api/payments/stripe/confirm-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, sessionId }),
      })
        .then(async (response) => {
          const payload = (await response.json()) as { error?: string };
          if (!response.ok) {
            throw new Error(payload.error || "Stripe payment confirmation failed.");
          }
          finish("Your payment has been confirmed and your registration is now fully active.");
        })
        .catch((error: unknown) => {
          setPaymentError(error instanceof Error ? error.message : "Stripe payment confirmation failed.");
          setPaymentMessage(null);
        });
    }
  }, [pathname, router, searchParams]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setProfileMessage(null);
    setProfileError(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phoneCountryCode,
          phoneNumber,
          countryCode,
          countryName,
          timezone,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Profile update failed.");
      }

      setProfileMessage(data.message || "Profile updated.");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Profile update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function openBillingPortal() {
    setBillingPortalLoading(true);
    setPaymentError(null);
    setPaymentMessage(null);

    try {
      const response = await fetch("/api/payments/stripe/billing-portal", {
        method: "POST",
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error || "Could not open Stripe billing portal.");
      }

      window.location.href = data.url;
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Could not open Stripe billing portal.");
      setBillingPortalLoading(false);
    }
  }

  return (
    <main className="ga-page">
      <section className="ga-section">
        <div className="ga-container" style={{ display: "grid", gap: "1.4rem" }}>
          <div className="ga-dashboard-hero">
            <div>
              <p className="ga-dashboard-kicker">Student dashboard</p>
              <h1 className="ga-heading">Assalam-u-Alaikum, {fullName}</h1>
              <p className="ga-copy" style={{ marginTop: "0.75rem", maxWidth: 760 }}>
                Track your enrollment, payment, subscription, and Seerah LMS access from one place.
              </p>
              {paymentMessage ? (
                <p className="ga-copy" style={{ marginTop: "0.75rem", color: "#0f5e91" }}>
                  {paymentMessage}
                </p>
              ) : null}
              {paymentError ? (
                <p className="ga-copy" style={{ marginTop: "0.75rem", color: "#a33f3f" }}>
                  {paymentError}
                </p>
              ) : null}
            </div>
            <div className="ga-dashboard-actions">
              {hasPendingPayment ? (
                <Link href={pendingPaymentHref} className="ga-btn ga-btn-primary">
                  Complete Pending Payment
                </Link>
              ) : null}
              {user.canManageStripeBilling ? (
                <button
                  type="button"
                  className="ga-btn ga-btn-primary"
                  onClick={openBillingPortal}
                  disabled={billingPortalLoading}
                >
                  {billingPortalLoading ? "Opening Billing..." : "Manage Billing / Update Card"}
                </button>
              ) : null}
              <Link href="/seerah/register" className="ga-btn ga-btn-outline">
                Register Another Seat
              </Link>
              <LogoutButton />
            </div>
          </div>

          {hasPendingPayment ? (
            <section className="ga-dashboard-card">
              <p className="ga-dashboard-card-title">Pending Payment</p>
              <p className="ga-dashboard-muted">
                Your registration account is active, but this order still needs payment completion. You can reopen the payment page, switch payment method, or change between monthly and full course payment.
              </p>
              <div className="ga-dashboard-actions" style={{ marginTop: "1rem" }}>
                <Link href={pendingPaymentHref} className="ga-btn ga-btn-primary">
                  Complete Pending Payment
                </Link>
                <Link href="/dashboard" className="ga-btn ga-btn-outline">
                  Stay on Dashboard
                </Link>
              </div>
            </section>
          ) : null}

          <section className="ga-dashboard-grid">
            <article className="ga-dashboard-card">
              <p className="ga-dashboard-card-title">Overview</p>
              <div className="ga-dashboard-stack">
                <p>Email: {user.email}</p>
                <p>Country: {countryName}</p>
                <p>Enrollment: {seerahEnrollment?.status ?? "NOT_REGISTERED"}</p>
                <p>LMS Access: {hasActiveLmsAccess ? "Granted" : "Locked pending payment approval"}</p>
                <p>
                  Subscription:{" "}
                  {latestRegistration?.paymentPlanType === "FULL_COURSE"
                    ? "Not required for full course payment"
                    : latestSubscription?.status ?? "Not started"}
                </p>
                <p>
                  Renewal:{" "}
                  {latestRegistration?.paymentPlanType === "FULL_COURSE"
                    ? "Not applicable"
                    : latestSubscription?.currentPeriodEnd
                      ? new Date(latestSubscription.currentPeriodEnd).toLocaleDateString()
                      : "Will appear after subscription activation"}
                </p>
                <p>
                  Auto renew:{" "}
                  {latestRegistration?.paymentPlanType === "FULL_COURSE"
                    ? "Off"
                    : latestSubscription
                      ? latestSubscription.cancelAtPeriodEnd
                        ? "Will stop"
                        : "On"
                      : "N/A"}
                </p>
              </div>
            </article>

            <article className="ga-dashboard-card">
              <p className="ga-dashboard-card-title">Payment Status</p>
              <div className="ga-dashboard-stack">
                <p>Plan: {latestPaymentPlanLabel}</p>
                <p>Method: {latestRegistration?.paymentMethod ?? "N/A"}</p>
                <p>Registration status: {latestRegistration?.status ?? "N/A"}</p>
                <p>Payment status: {latestRegistration?.payment?.status ?? "N/A"}</p>
                <p>Reference: {latestRegistration?.paymentReference ?? "N/A"}</p>
                <p>
                  Latest amount:{" "}
                  {latestRegistration
                    ? formatMoney(
                        latestRegistration.payment?.amount ?? latestRegistration.finalAmount,
                        latestRegistration.payment?.currency ?? latestRegistration.selectedCurrency,
                      )
                    : "N/A"}
                </p>
                <p>
                  Paid at:{" "}
                  {latestRegistration?.payment?.paidAt
                    ? new Date(latestRegistration.payment.paidAt).toLocaleString()
                    : "Pending or awaiting review"}
                </p>
              </div>
              {user.canManageStripeBilling ? (
                <div className="ga-dashboard-actions" style={{ marginTop: "1rem" }}>
                  <button
                    type="button"
                    className="ga-btn ga-btn-outline"
                    onClick={openBillingPortal}
                    disabled={billingPortalLoading}
                  >
                    {billingPortalLoading ? "Opening Billing..." : "Update Card Details"}
                  </button>
                </div>
              ) : null}
            </article>
          </section>

          <section className="ga-dashboard-split">
            <article className="ga-dashboard-card">
              <p className="ga-dashboard-card-title">My LMS</p>
              <p className="ga-dashboard-muted">
                Recorded lessons, weekly live links, and batch support appear here after activation.
              </p>
              <div className="ga-dashboard-list" style={{ marginTop: "1rem" }}>
                {seerahLessons.map((lesson) => (
                  <div key={lesson.title} className="ga-dashboard-list-item">
                    <div>
                      <strong>{lesson.title}</strong>
                      <p>{lesson.type}</p>
                    </div>
                    <span>{hasActiveLmsAccess ? lesson.access : "Locked"}</span>
                  </div>
                ))}
              </div>
              <div className="ga-dashboard-actions" style={{ marginTop: "1rem" }}>
                {hasActiveLmsAccess ? (
                  <Link href="/seerah/lms" className="ga-btn ga-btn-primary">
                    Open Seerah LMS
                  </Link>
                ) : (
                  <Link href="/seerah/register" className="ga-btn ga-btn-outline">
                    Complete Payment First
                  </Link>
                )}
                <Link href="https://chat.whatsapp.com/EXcZmIOG9c8LOSdjK7KMko" className="ga-btn ga-btn-outline" target="_blank">
                  Join Batch Community
                </Link>
              </div>
            </article>

            <article className="ga-dashboard-card">
              <p className="ga-dashboard-card-title">Profile Settings</p>
              <form onSubmit={saveProfile} className="ga-dashboard-form">
                <label>
                  Full Name
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
                </label>
                <label>
                  Phone Country Code
                  <input
                    value={phoneCountryCode}
                    onChange={(event) => setPhoneCountryCode(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Phone Number
                  <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required />
                </label>
                <label>
                  Country
                  <select
                    value={countryCode}
                    onChange={(event) => {
                      const nextCode = event.target.value;
                      const match = countryEntries.find((entry) => entry.code === nextCode);
                      setCountryCode(nextCode);
                      setCountryName(match?.name ?? nextCode);
                      if (match?.phone) {
                        setPhoneCountryCode(`+${match.phone}`);
                      }
                    }}
                  >
                    {countryEntries.map((entry) => (
                      <option key={entry.code} value={entry.code}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Timezone
                  <input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Asia/Karachi" />
                </label>
                {profileMessage ? <p className="ga-dashboard-success">{profileMessage}</p> : null}
                {profileError ? <p className="ga-dashboard-error">{profileError}</p> : null}
                <button type="submit" className="ga-btn ga-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </form>
            </article>
          </section>

          <section className="ga-dashboard-split">
            <article className="ga-dashboard-card">
              <p className="ga-dashboard-card-title">Payment History</p>
              <div className="ga-dashboard-list">
                {user.registrations.length ? (
                  user.registrations.map((registration) => (
                    <div key={registration.id} className="ga-dashboard-list-item">
                      <div>
                        <strong>{registration.course.title}</strong>
                        <p>
                          {paymentPlanTypeLabels[registration.paymentPlanType]} - {registration.paymentMethod} - {registration.status}
                        </p>
                      </div>
                      <span>
                        {formatMoney(
                          registration.payment?.amount ?? registration.finalAmount,
                          registration.payment?.currency ?? registration.selectedCurrency,
                        )}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="ga-dashboard-muted">No registrations yet.</p>
                )}
              </div>
            </article>

            <article className="ga-dashboard-card">
              <p className="ga-dashboard-card-title">Support</p>
              <div className="ga-dashboard-list">
                {supportLinks.map((item) => (
                  <div key={item.label} className="ga-dashboard-list-item">
                    <div>
                      <strong>{item.label}</strong>
                    </div>
                    <Link
                      href={item.href}
                      target={item.href.startsWith("http") ? "_blank" : undefined}
                      className="ga-btn ga-btn-outline"
                    >
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}

