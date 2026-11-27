"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LiveStatusRefresh } from "@/components/sirah/live-status-refresh";
import { ClassroomCountdown } from "@/components/sirah/classroom-countdown";
import { Rosette } from "@/components/indigo/ornaments";
import { RenewalCycle } from "@/components/sirah/renewal-cycle";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { countries } from "countries-list";
import { trackConfirmedSeerahEnrolment } from "@/components/seerah/analytics";
import {
  SirahDashboardRegistration,
  sirahAmountLabel,
  sirahMethodLabel,
  sirahOrderHref,
  sirahOrderStatus,
  sirahPlanLabel,
  type SirahDashboardOrder,
} from "@/components/sirah/dashboard-registration";
import { StudentTopNav } from "@/components/student/student-topnav";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import { paymentPlanTypeLabels } from "@/lib/course-payment";
import { indigoFontVariables } from "@/lib/fonts";
import s from "./student-dashboard.module.css";

/** The student's next live class (read-only, from the dashboard page). */
export type DashboardNextLiveClass = {
  title: string;
  startsAt: string;
  /** Server-formatted in the viewer's (or profile) zone, until the browser's own zone takes over. */
  when: string;
  zone: string;
  live: boolean;
  joinable: boolean;
  joinPath: string;
};

type DashboardProps = {
  nextLiveClass?: DashboardNextLiveClass | null;
  latestRecording?: DashboardRecording | null;
  /** The student's own cohort recordings, newest first (empty: none yet or no classroom access). */
  recentRecordings?: DashboardRecording[];
  resourceCount?: number | null;
  serverNow: string;
  /** The classroom inbox for the top bar's bell (null: not enrolled in a cohort). */
  inbox?: { href: string; unread: number } | null;
  user: {
    id: string;
    currentSirahOnly?: boolean;
    /** Signed-in user may open the admin workspace (super admin or Sīrah team). */
    showAdminLink?: boolean;
    /** Signed-in user hosts live sessions (email matches an active Zoom host). */
    showTeachingLink?: boolean;
    sirahOrders?: SirahDashboardOrder[];
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

type DashboardRecording = { title: string; href: string; external: boolean };

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

export default function StudentDashboard({ user, nextLiveClass = null, latestRecording = null, recentRecordings = [], resourceCount = null, serverNow, inbox = null }: DashboardProps) {
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
  // Layout only: which dashboard section is shown. Follows the URL hash
  // (#overview, #course, #payments) so links and the back button work.
  const [section, setSection] = useState<DashboardSection>("overview");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [clockNow, setClockNow] = useState(() => new Date(serverNow).getTime());
  useEffect(() => {
    const tick = () => setClockNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const sirahOrders = user.sirahOrders ?? [];
  const latestSirahOrder = sirahOrders[0];
  const pendingSirahOrder = sirahOrders.find((order) => sirahOrderStatus(order).kind === "PAY");
  const supportLinks = [
    {
      label: "Your Sīrah registration",
      href: pendingSirahOrder ? sirahOrderHref(pendingSirahOrder) : "/seerah/register",
    },
    ...(user.showTeachingLink ? [{ label: "My sessions", href: "/seerah/classroom/teaching" }] : []),
    ...(user.showAdminLink ? [{ label: "Admin Panel", href: "/admin" }] : []),
  ];

  const seerahEnrollment = user.enrollments.find((item) => item.course.slug === "seerah-course");
  const latestRegistration = user.registrations.find((item) => item.course.slug === "seerah-course");
  const latestSubscription = user.subscriptions[0];
  const hasActiveLmsAccess = seerahEnrollment?.status === "ACTIVE";
  // Classroom links lead to existing pages that admit only enrolled students,
  // so they are live only for an enrolled student (display rule only; each
  // page keeps its own gate).
  const classroomOpen = sirahOrders.some((order) => sirahOrderStatus(order).kind === "ACTIVE") || hasActiveLmsAccess;
  // The only course on this dashboard (slug "seerah-course"). Not the stored
  // course title: legacy rows can still carry an older course name.
  const lmsCourseName = "Sīrah | Beyond Chronology";
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

  // These props come from the authenticated server dashboard, never payment URL parameters.
  // Manual transfers count only after verification; unpaid and pending registrations do not count.
  useEffect(() => {
    for (const registration of user.registrations) {
      if (registration.course.slug === "seerah-course" &&
        ["ACTIVE", "PAID"].includes(registration.status) &&
        registration.payment &&
        ["SUCCEEDED", "CONFIRMED"].includes(registration.payment.status)) {
        trackConfirmedSeerahEnrolment(registration.id, registration.createdAt);
      }
    }
  }, [user.registrations]);

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

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1) as DashboardSection;
      setSection(SECTIONS.includes(id) ? id : "overview");
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const go = (id: DashboardSection) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`);
    setSection(id);
    window.scrollTo({ top: 0 });
    // Move focus to the new section's heading for keyboard and screen-reader users.
    window.requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
  };

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

  /* ---------- The cards, each defined once and placed in its section ---------- */

  const notices = (
    <>
      {paymentMessage ? (
        <p className={s.notice} role="status">
          {paymentMessage}
        </p>
      ) : null}
      {paymentError ? (
        <p className={s.noticeError} role="alert">
          {paymentError}
        </p>
      ) : null}
    </>
  );

  const pendingCard = hasPendingPayment ? (
    <section className={`${s.card} ${s.cardAttention}`} aria-labelledby="pending-payment">
      <p id="pending-payment" className={s.cardTitle}>
        Pending Payment
      </p>
      <p className={s.muted}>
        Your registration account is active, but this order still needs payment completion. You can reopen the payment page, switch payment method, or change between monthly and full course payment.
      </p>
      <div className={`${s.actions} ${s.cardActions}`}>
        <Link href={pendingPaymentHref} className={s.btn}>
          Complete Pending Payment
        </Link>
        <Link href="/dashboard" className={s.btnGhost}>
          Stay on Dashboard
        </Link>
      </div>
    </section>
  ) : null;

  const sirahOverviewCard = latestSirahOrder ? (
    <article className={s.card}>
      <h2 className={s.cardTitle}>Overview</h2>
      <dl className={s.facts}>
        <Fact label="Email">{user.email}</Fact>
        <Fact label="Country">{countryName}</Fact>
        <Fact label="Enrolment">{sirahOrderStatus(latestSirahOrder).label}</Fact>
        <Fact label="Plan">{sirahPlanLabel(latestSirahOrder)}</Fact>
      </dl>
    </article>
  ) : null;

  const sirahPaymentCard = latestSirahOrder ? (
    <article className={s.card}>
      <h2 className={s.cardTitle}>Payment Status</h2>
      <dl className={s.facts}>
        <Fact label="Status">{sirahOrderStatus(latestSirahOrder).label}</Fact>
        <Fact label="Method">{sirahMethodLabel(latestSirahOrder)}</Fact>
        <Fact label="Amount">{sirahAmountLabel(latestSirahOrder)}</Fact>
        <Fact label="Reference">{latestSirahOrder.reference}</Fact>
      </dl>
      <RenewalCycle
        className={s.renewal}
        plan={latestSirahOrder.plan}
        method={latestSirahOrder.method}
        cycle={latestSirahOrder.renewalCycle ?? null}
        paid={(latestSirahOrder.paidCount ?? 0) > 0}
        paymentState={latestSirahOrder.paymentState}
        enrolmentState={latestSirahOrder.enrolmentState}
        cancelled={latestSirahOrder.cancelled}
        nextBillingAt={latestSirahOrder.nextBillingAt}
        accessEndsAt={latestSirahOrder.accessEndsAt}
      />
      {pendingSirahOrder ? null : (
        <div className={`${s.actions} ${s.cardActions}`}>
          <Link href={sirahOrderHref(latestSirahOrder)} className={s.btnGhost}>
            View your registration
          </Link>
        </div>
      )}
    </article>
  ) : null;

  const legacyOverviewCard = (
    <article className={s.card}>
      <h2 className={s.cardTitle}>Overview</h2>
      <dl className={s.facts}>
        <Fact label="Email">{user.email}</Fact>
        <Fact label="Country">{countryName}</Fact>
        <Fact label="Enrollment">{seerahEnrollment?.status ?? "NOT_REGISTERED"}</Fact>
        <Fact label="LMS Access">{hasActiveLmsAccess ? "Granted" : "Locked pending payment approval"}</Fact>
        <Fact label="Subscription">
          {latestRegistration?.paymentPlanType === "FULL_COURSE"
            ? "Not required for full course payment"
            : latestSubscription?.status ?? "Not started"}
        </Fact>
        <Fact label="Renewal">
          {latestRegistration?.paymentPlanType === "FULL_COURSE"
            ? "Not applicable"
            : latestSubscription?.currentPeriodEnd
              ? new Date(latestSubscription.currentPeriodEnd).toLocaleDateString()
              : "Will appear after subscription activation"}
        </Fact>
        <Fact label="Auto renew">
          {latestRegistration?.paymentPlanType === "FULL_COURSE"
            ? "Off"
            : latestSubscription
              ? latestSubscription.cancelAtPeriodEnd
                ? "Will stop"
                : "On"
              : "N/A"}
        </Fact>
      </dl>
    </article>
  );

  const legacyPaymentCard = (
    <article className={s.card}>
      <h2 className={s.cardTitle}>Payment Status</h2>
      <dl className={s.facts}>
        <Fact label="Plan">{latestPaymentPlanLabel}</Fact>
        <Fact label="Method">{latestRegistration?.paymentMethod ?? "N/A"}</Fact>
        <Fact label="Registration status">{latestRegistration?.status ?? "N/A"}</Fact>
        <Fact label="Payment status">{latestRegistration?.payment?.status ?? "N/A"}</Fact>
        <Fact label="Reference">{latestRegistration?.paymentReference ?? "N/A"}</Fact>
        <Fact label="Latest amount">
          {latestRegistration
            ? formatMoney(
                latestRegistration.payment?.amount ?? latestRegistration.finalAmount,
                latestRegistration.payment?.currency ?? latestRegistration.selectedCurrency,
              )
            : "N/A"}
        </Fact>
        <Fact label="Paid at">
          {latestRegistration?.payment?.paidAt ? new Date(latestRegistration.payment.paidAt).toLocaleString() : "Pending or awaiting review"}
        </Fact>
      </dl>
      {user.canManageStripeBilling ? (
        <div className={`${s.actions} ${s.cardActions}`}>
          <button type="button" className={s.btnGhost} onClick={openBillingPortal} disabled={billingPortalLoading}>
            {billingPortalLoading ? "Opening Billing..." : "Update Card Details"}
          </button>
        </div>
      ) : null}
    </article>
  );

  // The existing rule: current-cohort Sīrah students see the order cards,
  // everyone else the legacy registration cards.
  const sirahOnly = Boolean(user.currentSirahOnly && latestSirahOrder);
  const overviewCard = sirahOnly ? sirahOverviewCard : legacyOverviewCard;
  const paymentCard = sirahOnly ? sirahPaymentCard : legacyPaymentCard;

  // Reads the student's own cohort data (recordings and next live class from
  // the classroom schedule); nothing here is placeholder course content.
  const lmsCard = (
    <article className={s.card}>
      <h2 className={s.cardTitle}>My LMS</h2>
      <p className={s.muted}>
        {classroomOpen
          ? `${lmsCourseName}: your recorded lessons and next live session.`
          : user.currentSirahOnly
            ? "Open your Sīrah Beyond Chronology registration above for verified payment status, private evidence and your course invitation."
            : "Recorded lessons, weekly live links, and batch support appear here after activation."}
      </p>
      {classroomOpen ? (
        <ul className={s.list}>
          {recentRecordings.map((recording) => (
            <li key={recording.href + recording.title} className={s.item}>
              <div>
                <strong>{recording.title}</strong>
                <p>Recorded</p>
              </div>
              <a
                href={recording.href}
                className={s.itemValue}
                {...(recording.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                Watch
              </a>
            </li>
          ))}
          {nextLiveClass ? (
            <li className={s.item}>
              <div>
                <strong>{nextLiveClass.title}</strong>
                <p>Live</p>
              </div>
              <span className={s.itemValue}>
                {nextLiveClass.live ? "Happening now" : <LocalTime iso={nextLiveClass.startsAt} fallback={nextLiveClass.when} fallbackZone={nextLiveClass.zone} />}
              </span>
            </li>
          ) : null}
          {!recentRecordings.length && !nextLiveClass ? (
            <li className={s.item}>
              <div>
                <p>Recordings and live sessions appear here once your class schedule is published.</p>
              </div>
            </li>
          ) : null}
        </ul>
      ) : null}
      <div className={`${s.actions} ${s.cardActions}`}>
        {classroomOpen ? (
          <Link href="/seerah/classroom" className={s.btn}>
            Open Sīrah classroom
          </Link>
        ) : user.currentSirahOnly ? (
          <Link href="/seerah/register" className={s.btn}>
            Manage your Sīrah registration
          </Link>
        ) : (
          <Link href="/seerah/register" className={s.btnGhost}>
            Complete Payment First
          </Link>
        )}
        <Link href="/seerah/register" className={s.btnGhost} target="_blank">
          Join Batch Community
        </Link>
      </div>
    </article>
  );

  const profileCard = (
    <article className={s.card}>
      <h2 className={s.cardTitle}>Profile Settings</h2>
      <form onSubmit={saveProfile} className={s.form}>
        <label className={s.field}>
          Full Name
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        </label>
        <div className={s.formRow}>
          <label className={s.field}>
            Phone Country Code
            <input value={phoneCountryCode} onChange={(event) => setPhoneCountryCode(event.target.value)} required />
          </label>
          <label className={s.field}>
            Phone Number
            <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required />
          </label>
        </div>
        <label className={s.field}>
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
        <label className={s.field}>
          Timezone
          <input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Asia/Karachi" />
        </label>
        {profileMessage ? <p className={s.success}>{profileMessage}</p> : null}
        {profileError ? <p className={s.error}>{profileError}</p> : null}
        <div className={s.actions}>
          <button type="submit" className={s.btn} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>
    </article>
  );

  const historyCard = (
    <article className={s.card}>
      <h2 className={s.cardTitle}>Payment History</h2>
      <ul className={s.list}>
        {user.registrations.length
          ? user.registrations.map((registration) => (
              <li key={registration.id} className={s.item}>
                <div>
                  <strong>{registration.course.title}</strong>
                  <p>
                    {paymentPlanTypeLabels[registration.paymentPlanType]} - {registration.paymentMethod} - {registration.status}
                  </p>
                </div>
                <span className={s.itemValue}>
                  {formatMoney(registration.payment?.amount ?? registration.finalAmount, registration.payment?.currency ?? registration.selectedCurrency)}
                </span>
              </li>
            ))
          : null}
        {sirahOrders.map((order) => (
          <li key={order.id} className={s.item}>
            <div>
              <strong>Sīrah | Beyond Chronology</strong>
              <p>
                {sirahPlanLabel(order)} - {sirahMethodLabel(order)} - {sirahOrderStatus(order).label}
              </p>
            </div>
            <span className={s.itemValue}>{sirahAmountLabel(order)}</span>
          </li>
        ))}
      </ul>
      {!user.registrations.length && !sirahOrders.length ? <p className={s.muted}>No registrations yet.</p> : null}
    </article>
  );

  const supportCard = (
    <article className={s.card}>
      <h2 className={s.cardTitle}>Support</h2>
      <ul className={s.list}>
        {supportLinks.map((item) => (
          <li key={item.label} className={s.item}>
            <div>
              <strong>{item.label}</strong>
            </div>
            <Link href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} className={`${s.btnGhost} ${s.btnSmall}`}>
              Open
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );

  const lockedHint = "Live classes and resources open once your enrolment is confirmed.";

  const firstName = fullName.trim().split(/\s+/)[0] || fullName;

  /* ---------- Overview: the action-first hub ---------- */

  // Bookings that still need payment keep their prominent call to action.
  const ordersToPay = sirahOrders.filter((order) => sirahOrderStatus(order).kind === "PAY");

  const showNextClass = !!nextLiveClass && (nextLiveClass.live || new Date(nextLiveClass.startsAt).getTime() - clockNow <= 24 * 60 * 60 * 1000);
  const nextClassCard = (
    <section className={`${s.nextCard} ${showNextClass && nextLiveClass?.live ? s.nextLive : ""}`} aria-labelledby="next-class-title">
      <Rosette className={s.heroRosette} />
      <div className={s.nextBody}>
        <p className={s.cardTitle}>{showNextClass ? (nextLiveClass?.live ? "Happening now" : "Your next live class") : latestRecording ? "Continue with your latest recording" : "Your learning journey"}</p>
        {showNextClass && nextLiveClass ? (
          <>
            <h2 id="next-class-title" className={s.nextTitle}>{nextLiveClass.title}</h2>
            <p className={s.nextWhen}><LocalTime iso={nextLiveClass.startsAt} fallback={nextLiveClass.when} fallbackZone={nextLiveClass.zone} /></p>
            {!nextLiveClass.live && <ClassroomCountdown startsAt={nextLiveClass.startsAt} serverNow={serverNow} joinWindowMinutes={15} classes={{ root: s.countdown, units: s.countUnits, unit: s.countUnit, value: s.countValue, label: s.countLabel, note: s.countNote }} />}
            {!nextLiveClass.joinable && <LiveStatusRefresh />}
          </>
        ) : latestRecording ? (
          <h2 id="next-class-title" className={s.nextTitle}>{latestRecording.title}</h2>
        ) : (
          <>
            <h2 id="next-class-title" className={s.nextTitle}>You’re all caught up</h2>
            <p className={s.muted}>{classroomOpen ? "Your next class will appear here." : lockedHint}</p>
          </>
        )}
      </div>
      <div className={s.nextActions}>
        {showNextClass && nextLiveClass ? (
          nextLiveClass.joinable ? (
            <a href={nextLiveClass.joinPath} className={s.btn} target="_blank" rel="noopener noreferrer">{nextLiveClass.live ? "Enter the class" : "Join the class"} <span aria-hidden="true">→</span></a>
          ) : <span className={s.muted}>Join opens 15 minutes before class or when the host starts.</span>
        ) : latestRecording ? (
          <a href={latestRecording.href} className={s.btn} {...(latestRecording.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>Watch recording <span aria-hidden="true">→</span></a>
        ) : null}
        {classroomOpen ? <Link href="/seerah/classroom/schedule" className={showNextClass && nextLiveClass?.joinable || latestRecording && !showNextClass ? s.btnGhost : s.btn}>View live classes</Link> : null}
      </div>
    </section>
  );

  // One small card: the course, a status chip, and the registration link.
  const statusOrder = latestSirahOrder && (sirahOnly || !seerahEnrollment) ? latestSirahOrder : null;
  const sirahStatus = statusOrder ? sirahOrderStatus(statusOrder) : null;
  const enrolmentCard = (
    <section className={s.statusCard} aria-labelledby="enrolment-title">
      <div className={s.statusMain}>
        <p className={s.cardTitle}>Your enrolment</p>
        <h2 id="enrolment-title" className={s.statusCourse}>
          {statusOrder ? SIRAH_TITLE : seerahEnrollment?.course.title ?? SIRAH_TITLE}
        </h2>
      </div>
      <div className={s.statusSide}>
        {statusOrder && sirahStatus ? (
          <>
            <span className={`${s.chip} ${s[`chip${sirahStatus.kind}`]}`}>{sirahStatus.label}</span>
            <Link href={sirahOrderHref(statusOrder)} className={s.statusLink}>
              View your registration
            </Link>
          </>
        ) : seerahEnrollment ? (
          <>
            <span className={`${s.chip} ${hasActiveLmsAccess ? s.chipACTIVE : s.chipVERIFYING}`}>
              {hasActiveLmsAccess ? "Active" : seerahEnrollment.status}
            </span>
            <a href="#course" onClick={go("course")} className={s.statusLink}>
              View your registration
            </a>
          </>
        ) : (
          <>
            <span className={`${s.chip} ${s.chipCLOSED}`}>Not registered yet</span>
            <Link href="/seerah/register" className={s.statusLink}>
              Register now
            </Link>
          </>
        )}
      </div>
    </section>
  );

  const tiles = (
    <nav className={s.tiles} aria-label="Quick actions">
      <Tile href="/seerah/classroom/schedule" icon={ICONS.live} locked={!classroomOpen} hint={lockedHint} meta={nextLiveClass ? <LocalTime iso={nextLiveClass.startsAt} fallback={nextLiveClass.when} fallbackZone={nextLiveClass.zone} /> : "No class scheduled"}>
        Live classes
      </Tile>
      <Tile href="/seerah/classroom#resources" icon={ICONS.resources} locked={!classroomOpen} hint={lockedHint} meta={resourceCount === null ? undefined : `${resourceCount} ${resourceCount === 1 ? "resource" : "resources"} available`}>
        Resources &amp; notices
      </Tile>
      <Tile href="#payments" icon={ICONS.payments} onClick={go("payments")} meta={latestSirahOrder ? <>{sirahPlanLabel(latestSirahOrder)}{latestSirahOrder.plan === "MONTHLY" && latestSirahOrder.nextBillingAt ? <> · Next due <LocalTime iso={latestSirahOrder.nextBillingAt} fallback={new Date(latestSirahOrder.nextBillingAt).toLocaleDateString("en-GB")} fallbackZone="" /></> : ` · ${sirahOrderStatus(latestSirahOrder).label}`}</> : latestRegistration ? `${latestPaymentPlanLabel} · ${latestRegistration.status}` : undefined}>
        Payments &amp; subscription
      </Tile>
      <Tile href="/seerah/register" icon={ICONS.seat} meta="Invite someone to learn alongside our community.">
        Gift or register another seat
      </Tile>
    </nav>
  );

  const SECTION_TITLES: Record<DashboardSection, { eyebrow: string; title: string; lede: string }> = {
    overview: {
      eyebrow: "Student dashboard",
      title: `Assalam-u-Alaikum, ${firstName}`,
      lede: "Your next class, your enrolment and everything else, one tap away.",
    },
    course: {
      eyebrow: "My course",
      title: "Your registration",
      lede: "Your Sīrah enrolment, its registration page and your course access.",
    },
    payments: {
      eyebrow: "Payments",
      title: "Payments and subscription",
      lede: "Payment status, renewals, billing and every payment you have made.",
    },
  };
  const heading = SECTION_TITLES[section];

  return (
    <div className={`${s.page} ${indigoFontVariables}`}>
      <StudentTopNav
        active={section}
        inbox={inbox}
        classroomLocked={!classroomOpen}
        lockedHint={lockedHint}
        accountName={fullName}
        accountLinks={[
          ...(user.showTeachingLink ? [{ label: "My sessions", href: "/seerah/classroom/teaching" }] : []),
          ...(user.showAdminLink ? [{ label: "Admin Panel", href: "/admin" }] : []),
        ]}
        onSection={(id, event) => go(id)(event)}
      />

      <main className={s.main} id="dashboard-content">
        <header className={s.hero} aria-labelledby="dashboard-title">
          <p className={s.eyebrow}>{heading.eyebrow}</p>
          <h1 id="dashboard-title" className={s.title} tabIndex={-1} ref={titleRef}>
            {heading.title}
          </h1>
          <p className={s.lede}>{heading.lede}</p>
          {notices}
        </header>

        <div className={s.stack}>
          {section === "overview" ? (
            <>
              {ordersToPay.length || pendingCard ? (
                <div className={s.section}>
                  <SirahDashboardRegistration orders={ordersToPay} />
                  {pendingCard}
                </div>
              ) : null}
              {nextClassCard}
              {enrolmentCard}
              {tiles}
            </>
          ) : null}

          {section === "course" ? (
            <>
              <div className={s.section}>
                <SirahDashboardRegistration orders={sirahOrders} />
                {!sirahOrders.length ? (
                  <section className={s.card} aria-label="No registration">
                    <p className={s.muted}>You have no Sīrah registration yet.</p>
                    <div className={`${s.actions} ${s.cardActions}`}>
                      <Link href="/seerah/register" className={s.btn}>
                        Register Another Seat
                      </Link>
                    </div>
                  </section>
                ) : null}
              </div>
              <section className={s.grid} aria-label="Course access">
                {overviewCard}
                <article className={s.card}>
                  <h2 className={s.cardTitle}>Classroom</h2>
                  <p className={s.muted}>
                    {classroomOpen
                      ? "Your live classes, recordings, resources and notices are in the classroom."
                      : "The classroom opens here once your enrolment is confirmed."}
                  </p>
                  {classroomOpen ? (
                    <div className={`${s.actions} ${s.cardActions}`}>
                      <Link href="/seerah/classroom" className={s.btn}>
                        Open the classroom
                      </Link>
                      <Link href="/seerah/classroom/schedule" className={s.btnGhost}>
                        Live classes
                      </Link>
                    </div>
                  ) : null}
                </article>
              </section>
              <section className={s.grid} aria-label="Support">
                {supportCard}
              </section>
              {!user.currentSirahOnly ? (
                <section className={s.grid} aria-label="Learning and profile">
                  {lmsCard}
                  {profileCard}
                </section>
              ) : null}
            </>
          ) : null}

          {section === "payments" ? (
            <>
              {pendingCard ? <div className={s.section}>{pendingCard}</div> : null}
              <section className={s.grid} aria-label="Payment status and history">
                {paymentCard}
                {historyCard}
              </section>
              {user.canManageStripeBilling ? (
                <section className={s.card} aria-label="Billing">
                  <h2 className={s.cardTitle}>Billing</h2>
                  <p className={s.muted}>Update your card or manage your subscription on the secure billing page.</p>
                  <div className={`${s.actions} ${s.cardActions}`}>
                    <button type="button" className={s.btn} onClick={openBillingPortal} disabled={billingPortalLoading}>
                      {billingPortalLoading ? "Opening Billing..." : "Manage Billing / Update Card"}
                    </button>
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </div>

        <footer className={s.foot}>
          <b>Sīrah · Beyond Chronology</b> · The Global Awakening
        </footer>
      </main>
    </div>
  );
}

/* ---------- Navigation ---------- */

type DashboardSection = "overview" | "course" | "payments";
const SECTIONS: DashboardSection[] = ["overview", "course", "payments"];

const navIcon = (path: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={path} />
  </svg>
);
const ICONS = {
  payments: navIcon("M3 7h18v10H3zM3 11h18M7 15h3"),
  live: navIcon("M15 10l5-3v10l-5-3M3 6h12v12H3z"),
  resources: navIcon("M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5"),
  seat: navIcon("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6"),
};

/** A quick-action tile. Shown but inactive when the page would not admit the student. */
function Tile({
  href,
  icon,
  locked = false,
  hint,
  onClick,
  meta,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  meta?: React.ReactNode;
  locked?: boolean;
  hint?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  children: React.ReactNode;
}) {
  const body = (
    <>
      <span className={s.tileIcon}>{icon}</span>
      <span className={s.tileText}><span className={s.tileLabel}>{children}</span>{meta && <span className={s.tileMeta}>{meta}</span>}</span>
      {!locked ? (
        <span className={s.tileGo} aria-hidden="true">
          →
        </span>
      ) : null}
    </>
  );
  if (locked)
    return (
      <span className={`${s.tile} ${s.tileLocked}`} aria-disabled="true" title={hint}>
        {body}
      </span>
    );
  if (href.startsWith("#"))
    return (
      <a href={href} onClick={onClick} className={s.tile}>
        {body}
      </a>
    );
  return (
    <Link href={href} className={s.tile}>
      {body}
    </Link>
  );
}

/** The class time in the browser's own time zone (the student's), after
 * mount; the server-formatted time (viewer or profile zone) until then. */
function LocalTime({ iso, fallback, fallbackZone }: { iso: string; fallback: string; fallbackZone: string }) {
  const [local, setLocal] = useState<{ when: string; zone: string } | null>(null);
  useEffect(() => {
    try {
      const date = new Date(iso);
      const when = new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date);
      const zone =
        new Intl.DateTimeFormat("en-GB", { timeZoneName: "long" }).formatToParts(date).find((part) => part.type === "timeZoneName")
          ?.value ?? "";
      // Runs once after mount to switch from the server's zone to the browser's.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocal({ when, zone });
    } catch {
      /* keep the server-formatted time */
    }
  }, [iso]);
  return (
    <>
      <time dateTime={iso}>{local?.when ?? fallback}</time>{" "}
      <span className={s.zone}>your time ({local?.zone || fallbackZone})</span>
    </>
  );
}

/** One label / value row of a card's facts list. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={s.fact}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
