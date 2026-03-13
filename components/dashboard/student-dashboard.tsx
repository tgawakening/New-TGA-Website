"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { countries } from "countries-list";
import LogoutButton from "@/components/dashboard/logout-button";

type DashboardProps = {
  user: {
    id: string;
    fullName: string;
    email: string;
    phoneCountryCode: string;
    phoneNumber: string;
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
      status: string;
      paymentMethod: string;
      paymentReference: string | null;
      createdAt: string;
      course: {
        slug: string;
        title: string;
      };
      payment: {
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
  { label: "Admin Manual Reviews", href: "/admin/payments" },
];

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `${amount} ${currency}`;
  }
}

export default function StudentDashboard({ user }: DashboardProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [phoneCountryCode, setPhoneCountryCode] = useState(user.phoneCountryCode);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber);
  const [countryCode, setCountryCode] = useState(user.studentProfile?.countryCode ?? "GB");
  const [countryName, setCountryName] = useState(user.studentProfile?.countryName ?? "United Kingdom");
  const [timezone, setTimezone] = useState(user.studentProfile?.timezone ?? "");
  const [saving, setSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const seerahEnrollment = user.enrollments.find((item) => item.course.slug === "seerah-course");
  const latestRegistration = user.registrations.find((item) => item.course.slug === "seerah-course");
  const latestSubscription = user.subscriptions[0];
  const hasActiveLmsAccess = seerahEnrollment?.status === "ACTIVE";

  const countryEntries = useMemo(
    () =>
      Object.entries(countries)
        .map(([code, details]) => ({ code, name: details.name, phone: details.phone[0] ?? "" }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [],
  );

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
            </div>
            <div className="ga-dashboard-actions">
              <Link href="/seerah/register" className="ga-btn ga-btn-outline">
                Register Another Seat
              </Link>
              <LogoutButton />
            </div>
          </div>

          <section className="ga-dashboard-grid">
            <article className="ga-dashboard-card">
              <p className="ga-dashboard-card-title">Overview</p>
              <div className="ga-dashboard-stack">
                <p>Email: {user.email}</p>
                <p>Country: {countryName}</p>
                <p>Enrollment: {seerahEnrollment?.status ?? "NOT_REGISTERED"}</p>
                <p>LMS Access: {hasActiveLmsAccess ? "Granted" : "Locked pending payment approval"}</p>
                <p>Subscription: {latestSubscription?.status ?? "Not started"}</p>
                <p>
                  Renewal:{" "}
                  {latestSubscription?.currentPeriodEnd
                    ? new Date(latestSubscription.currentPeriodEnd).toLocaleDateString()
                    : "Will appear after subscription activation"}
                </p>
                <p>
                  Auto renew: {latestSubscription ? (latestSubscription.cancelAtPeriodEnd ? "Will stop" : "On") : "N/A"}
                </p>
              </div>
            </article>

            <article className="ga-dashboard-card">
              <p className="ga-dashboard-card-title">Payment Status</p>
              <div className="ga-dashboard-stack">
                <p>Method: {latestRegistration?.paymentMethod ?? "N/A"}</p>
                <p>Registration status: {latestRegistration?.status ?? "N/A"}</p>
                <p>Payment status: {latestRegistration?.payment?.status ?? "N/A"}</p>
                <p>Reference: {latestRegistration?.paymentReference ?? "N/A"}</p>
                <p>
                  Latest amount:{" "}
                  {latestRegistration
                    ? formatMoney(latestRegistration.finalAmount, latestRegistration.selectedCurrency)
                    : "N/A"}
                </p>
                <p>
                  Paid at:{" "}
                  {latestRegistration?.payment?.paidAt
                    ? new Date(latestRegistration.payment.paidAt).toLocaleString()
                    : "Pending or awaiting review"}
                </p>
              </div>
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
                          {registration.paymentMethod} • {registration.status}
                        </p>
                      </div>
                      <span>
                        {formatMoney(registration.finalAmount, registration.selectedCurrency)}
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
