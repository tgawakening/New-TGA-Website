"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLogoutButton from "@/components/admin/admin-logout-button";
import type { AdminDashboardSnapshot, AdminNotificationItem } from "@/services/admin.service";

type Props = {
  data: AdminDashboardSnapshot;
  adminEmail: string;
  initialNotifications: AdminNotificationItem[];
};

type TabKey = "home" | "orders" | "students" | "scholarships" | "mission" | "genmumin";
type RegistrationRow = AdminDashboardSnapshot["registrations"][number];
type StudentRow = AdminDashboardSnapshot["students"][number];
type FeeWaiverRow = AdminDashboardSnapshot["freeWarriorApplications"][number];
type GenMuminRow = AdminDashboardSnapshot["genMumin"]["recentRegistrations"][number];

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
});

const ADMIN_NOTIFICATIONS_LAST_SEEN_KEY = "ga-admin-notifications-last-seen";

function formatDate(value: string | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFlexibleCurrency(amount: number, currency: string) {
  if (currency === "GBP") {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
    }).format(amount);
  }

  return `${currency} ${amount.toLocaleString("en-GB")}`;
}

function prettify(value: string | null) {
  if (!value) return "N/A";
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

function getPrimaryActionLabel(row: RegistrationRow) {
  if (row.adminState === "COMPLETED") {
    return row.canManuallyComplete ? "Marked Paid" : row.isPartialScholarshipOrder ? "Approved" : "Completed";
  }

  if (row.canManuallyComplete) return "Mark Paid";
  return row.isPartialScholarshipOrder ? "Approve" : "Complete";
}

function DetailsButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="ga-admin-icon-btn" onClick={onClick} aria-label="View details">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    </button>
  );
}

export default function AdminDashboard({ data, adminEmail, initialNotifications }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [pricingFilter, setPricingFilter] = useState("ALL");
  const [applicationStatusFilter, setApplicationStatusFilter] = useState("ALL");
  const [missionStatusFilter, setMissionStatusFilter] = useState("ALL");
  const [submittingRow, setSubmittingRow] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feeWaiverNotes, setFeeWaiverNotes] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>(initialNotifications);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedFeeWaiverId, setSelectedFeeWaiverId] = useState<string | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);

  const orderRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.registrations.filter((row) => {
      if (
        term &&
        ![row.paymentReference ?? "", row.fullName, row.email, row.courseTitle, row.countryName, row.contributionLabel ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(term)
      ) {
        return false;
      }

      if (statusFilter !== "ALL" && row.adminState !== statusFilter) return false;
      if (paymentFilter !== "ALL" && row.paymentLabel !== paymentFilter) return false;
      if (courseFilter !== "ALL" && row.courseSlug !== courseFilter) return false;
      if (pricingFilter === "DISCOUNTED" && !row.hasDiscount) return false;
      if (pricingFilter === "FULL_PRICE" && row.hasDiscount) return false;

      return true;
    });
  }, [courseFilter, data.registrations, paymentFilter, pricingFilter, search, statusFilter]);

  const studentRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.students.filter((row) => {
      if (!term) return true;
      return [row.fullName, row.email, row.countryName ?? "", row.phone, row.latestPaymentLabel ?? "", row.latestAmountLabel ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [data.students, search]);

  const feeWaiverRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.freeWarriorApplications.filter((row) => {
      if (applicationStatusFilter !== "ALL" && row.status !== applicationStatusFilter) return false;
      if (!term) return true;
      return [row.fullName, row.email, row.whatsapp, row.cityCountry, row.contributionLabel].join(" ").toLowerCase().includes(term);
    });
  }, [applicationStatusFilter, data.freeWarriorApplications, search]);

  const missionRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.missionSupportDonations.filter((row) => {
      if (missionStatusFilter !== "ALL" && row.status !== missionStatusFilter) return false;
      if (!term) return true;
      return [row.fullName, row.email, row.paymentReference ?? "", row.countryName ?? ""].join(" ").toLowerCase().includes(term);
    });
  }, [data.missionSupportDonations, missionStatusFilter, search]);

  const genMuminRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.genMumin.recentRegistrations.filter((row) => {
      if (!term) return true;
      return [row.parentName, row.parentEmail, row.country, row.source ?? "", row.referrer ?? "", row.status]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [data.genMumin.recentRegistrations, search]);

  const paymentOptions = Array.from(new Set(data.registrations.map((row) => row.paymentLabel)));
  const courseOptions = Array.from(new Set(data.registrations.map((row) => row.courseSlug)));

  const paymentCounts = useMemo(() => {
    return data.registrations.reduce<Record<string, number>>((acc, row) => {
      acc[row.paymentLabel] = (acc[row.paymentLabel] ?? 0) + 1;
      return acc;
    }, {});
  }, [data.registrations]);

  const completionPct = percent(data.summary.completedOrders, data.summary.totalOrders);
  const pendingPct = percent(data.summary.pendingOrders, data.summary.totalOrders);
  const cancelledPct = percent(data.summary.cancelledOrders, data.summary.totalOrders);
  const donutSegments = `conic-gradient(#225b88 0 ${completionPct}%, #f1b955 ${completionPct}% ${completionPct + pendingPct}%, #e88d84 ${completionPct + pendingPct}% 100%)`;

  async function updateRegistrationStatus(registrationId: string, action: "COMPLETE" | "PENDING" | "CANCEL") {
    setSubmittingRow(registrationId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/registrations/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, action }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Could not update order.");
      }

      setMessage(`Order updated to ${payload.status ?? action}.`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not update order.");
    } finally {
      setSubmittingRow(null);
    }
  }

  async function reviewFeeWaiver(applicationId: string, approve: boolean) {
    setSubmittingRow(applicationId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/fee-waiver/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          approve,
          note: feeWaiverNotes[applicationId] ?? "",
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Could not review application.");
      }

      setMessage(approve ? "Fee Waiver application approved." : "Fee Waiver application rejected.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not review application.");
    } finally {
      setSubmittingRow(null);
    }
  }

  async function updateMissionDonation(donationId: string, action: "CONFIRM" | "PENDING" | "CANCEL") {
    setSubmittingRow(donationId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/mission-support/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donationId, action }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Could not update support donation.");
      }
      setMessage(`Mission support donation updated to ${payload.status ?? action}.`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not update support donation.");
    } finally {
      setSubmittingRow(null);
    }
  }

  const recentOrders = orderRows.slice(0, 5);
  const recentStudents = studentRows.slice(0, 5);
  const selectedStudent: StudentRow | null = selectedStudentId ? data.students.find((row) => row.id === selectedStudentId) ?? null : null;
  const selectedFeeWaiver: FeeWaiverRow | null = selectedFeeWaiverId
    ? data.freeWarriorApplications.find((row) => row.id === selectedFeeWaiverId) ?? null
    : null;
  const unreadNotificationsCount = useMemo(() => {
    if (!lastSeenAt) return 0;
    const lastSeenTime = new Date(lastSeenAt).getTime();
    return notifications.filter((item) => new Date(item.createdAt).getTime() > lastSeenTime).length;
  }, [lastSeenAt, notifications]);
  const isHomeTab = activeTab === "home";
  const workspaceTitle =
    activeTab === "orders"
      ? "Orders"
      : activeTab === "students"
        ? "Students"
        : activeTab === "scholarships"
          ? "Fee Waiver Applications"
          : activeTab === "mission"
            ? "Mission Support Donations"
            : "Gen-Mumin Feed";
  const workspaceDescription =
    activeTab === "orders"
      ? "Review live orders with cleaner payment labels and state-aware action buttons."
      : activeTab === "students"
        ? "Scan the full student list in a compact table and open details only when needed."
        : activeTab === "scholarships"
          ? "Review fee warrior applications in a compact list with quick actions and detail popups."
          : activeTab === "mission"
            ? "Review donor submissions, confirm manual support payments, and track contribution details."
            : "Monitor Gen-Mumin registrations from the main TGA workspace using the secure external feed.";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(ADMIN_NOTIFICATIONS_LAST_SEEN_KEY);
    if (stored) {
      setLastSeenAt(stored);
      return;
    }

    const now = new Date().toISOString();
    window.localStorage.setItem(ADMIN_NOTIFICATIONS_LAST_SEEN_KEY, now);
    setLastSeenAt(now);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/admin/notifications", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as { notifications?: AdminNotificationItem[] };
        if (payload.notifications) {
          setNotifications(payload.notifications);
        }
      } catch {
        // Keep the current notification list if polling fails.
      }
    }, 45000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!notificationPanelRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }

    if (isNotificationsOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isNotificationsOpen]);

  function handleNotificationBellClick() {
    const nextOpenState = !isNotificationsOpen;
    setIsNotificationsOpen(nextOpenState);

    if (nextOpenState) {
      const now = new Date().toISOString();
      setLastSeenAt(now);
      window.localStorage.setItem(ADMIN_NOTIFICATIONS_LAST_SEEN_KEY, now);
    }
  }

  return (
    <div className="ga-admin-shell">
      <header className="ga-admin-topbar">
        <button type="button" className="ga-admin-brand" onClick={() => setActiveTab("home")}>
          <div className="ga-admin-brand-mark">TGA</div>
          <div>
            <p className="ga-admin-brand-title">The Global Awakening</p>
            <p className="ga-admin-brand-subtitle">Admin workspace</p>
          </div>
        </button>

        <nav className="ga-admin-nav">
          <button type="button" className={`ga-admin-nav-pill ${activeTab === "home" ? "is-active" : ""}`} onClick={() => setActiveTab("home")}>
            Home
          </button>
          <button type="button" className={`ga-admin-nav-pill ${activeTab === "orders" ? "is-active" : ""}`} onClick={() => setActiveTab("orders")}>
            Orders
          </button>
          <button type="button" className={`ga-admin-nav-pill ${activeTab === "students" ? "is-active" : ""}`} onClick={() => setActiveTab("students")}>
            Students
          </button>
          <button type="button" className={`ga-admin-nav-pill ${activeTab === "scholarships" ? "is-active" : ""}`} onClick={() => setActiveTab("scholarships")}>
            Fee Warriors
          </button>
          <button type="button" className={`ga-admin-nav-pill ${activeTab === "mission" ? "is-active" : ""}`} onClick={() => setActiveTab("mission")}>
            Mission Support
          </button>
          <button type="button" className={`ga-admin-nav-pill ${activeTab === "genmumin" ? "is-active" : ""}`} onClick={() => setActiveTab("genmumin")}>
            Gen-Mumin
          </button>
        </nav>

        <div className="ga-admin-topbar-actions">
          <div className="ga-admin-notification-wrap" ref={notificationPanelRef}>
            <button
              type="button"
              className="ga-admin-bell-btn"
              aria-label="Open notifications"
              aria-expanded={isNotificationsOpen}
              onClick={handleNotificationBellClick}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="ga-admin-bell-icon">
                <path
                  d="M12 3a4 4 0 0 0-4 4v1.1c0 1.1-.4 2.1-1.1 2.9L5.7 12.3A3 3 0 0 0 8 17h8a3 3 0 0 0 2.3-4.7l-1.2-1.4A4.5 4.5 0 0 1 16 8.1V7a4 4 0 0 0-4-4Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 19a2 2 0 0 0 4 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              {unreadNotificationsCount > 0 ? (
                <span className="ga-admin-bell-badge">{Math.min(unreadNotificationsCount, 9)}+</span>
              ) : null}
            </button>

            {isNotificationsOpen ? (
              <div className="ga-admin-notification-panel">
                <div className="ga-admin-notification-head">
                  <div>
                    <strong>Notifications</strong>
                    <p>{unreadNotificationsCount > 0 ? `${unreadNotificationsCount} new updates` : "All caught up"}</p>
                  </div>
                  <button type="button" className="ga-admin-notification-close" onClick={() => setIsNotificationsOpen(false)}>
                    Close
                  </button>
                </div>

                <div className="ga-admin-notification-list">
                  {notifications.length > 0 ? (
                    notifications.map((item) => {
                      const isUnread = lastSeenAt ? new Date(item.createdAt).getTime() > new Date(lastSeenAt).getTime() : false;
                      return (
                        <article key={item.id} className={`ga-admin-notification-item ${isUnread ? "is-unread" : ""}`}>
                          <div className="ga-admin-notification-item-head">
                            <strong>{item.title}</strong>
                            <span>{formatDate(item.createdAt)}</span>
                          </div>
                          <p>{item.message}</p>
                        </article>
                      );
                    })
                  ) : (
                    <p className="ga-admin-notification-empty">No notifications yet.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <button type="button" className="ga-admin-ghost-btn" onClick={() => router.refresh()}>
            Refresh
          </button>
          <div className="ga-admin-user-chip">
            <div className="ga-admin-user-avatar">{adminEmail.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>TGA Admin</strong>
              <span>{adminEmail}</span>
            </div>
          </div>
          <AdminLogoutButton />
        </div>
      </header>

      {isHomeTab ? (
        <>
          <section className="ga-admin-hero-card">
            <div>
              <p className="ga-admin-kicker">Dashboard overview</p>
              <h1 className="ga-admin-title">Monitor registrations, payments, enrollments, and fee waivers</h1>
              <p className="ga-admin-subtitle">
                A cleaner control room for live course operations. Review what came in, what is pending, what is active,
                and what needs manual intervention.
              </p>
            </div>
            <div className="ga-admin-date-chip">{new Date().toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" })}</div>
          </section>

          <section className="ga-admin-metric-grid">
            <article className="ga-admin-metric-card is-mint">
              <span>Total Orders</span>
              <strong>{data.summary.totalOrders}</strong>
                  <small>Payable orders in system</small>
            </article>
            <article className="ga-admin-metric-card is-blue">
              <span>Revenue</span>
              <strong>{currencyFormatter.format(data.summary.revenuePence / 100)}</strong>
              <small>Confirmed GBP revenue</small>
            </article>
            <article className="ga-admin-metric-card is-lilac">
              <span>Fee Waivers</span>
              <strong>{data.summary.feeWaivers}</strong>
                  <small>Approved or pending applications</small>
            </article>
            <article className="ga-admin-metric-card is-gold">
              <span>Pending Value</span>
              <strong>{currencyFormatter.format(data.summary.pendingPence / 100)}</strong>
              <small>Still awaiting completion</small>
            </article>
            <article className="ga-admin-metric-card is-blue">
              <span>Mission Support</span>
              <strong>{currencyFormatter.format(data.summary.missionSupportRevenuePence / 100)}</strong>
              <small>{data.summary.missionSupportCount} support submissions</small>
            </article>
            <article className="ga-admin-metric-card is-lilac">
              <span>Gen-Mumin Pending</span>
              <strong>{data.genMumin.metrics?.pendingRegistrations ?? 0}</strong>
              <small>
                {data.genMumin.status === "CONNECTED" ? "Live cross-project feed" : "Feed not connected yet"}
              </small>
            </article>
          </section>

          <section className="ga-admin-analytics-grid">
            <article className="ga-admin-card">
              <div className="ga-admin-card-head">
                <div>
                  <h2>Order Health</h2>
                  <p>Live split of completed, pending, and cancelled orders</p>
                </div>
              </div>
              <div className="ga-admin-donut-wrap">
                <div className="ga-admin-donut" style={{ background: donutSegments }}>
                  <div className="ga-admin-donut-hole">
                    <strong>{completionPct}%</strong>
                    <span>completed</span>
                  </div>
                </div>
                <div className="ga-admin-legend">
                  <div><span className="dot is-blue" /> Completed <strong>{data.summary.completedOrders}</strong></div>
                  <div><span className="dot is-gold" /> Pending <strong>{data.summary.pendingOrders}</strong></div>
                  <div><span className="dot is-rose" /> Cancelled <strong>{data.summary.cancelledOrders}</strong></div>
                </div>
              </div>
            </article>

            <article className="ga-admin-card">
              <div className="ga-admin-card-head">
                <div>
                  <h2>Payment Mix</h2>
                  <p>Distribution by payment flow</p>
                </div>
              </div>
              <div className="ga-admin-bars">
                {paymentOptions.map((option, index) => {
                  const count = paymentCounts[option] ?? 0;
                  const width = percent(count, data.summary.totalOrders);
                  const className = ["is-blue", "is-lilac", "is-mint", "is-gold", "is-rose"][index % 5];
                  return (
                    <div key={option} className="ga-admin-bar-row">
                      <div className="ga-admin-bar-meta">
                        <span>{option}</span>
                        <strong>{count}</strong>
                      </div>
                      <div className="ga-admin-bar-track">
                        <div className={`ga-admin-bar-fill ${className}`} style={{ width: `${Math.max(width, 8)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>

          <section className="ga-admin-panels-grid">
            <article className="ga-admin-card ga-admin-highlight-card">
              <h2>This Month</h2>
              <div className="ga-admin-highlight-metrics">
                <div>
                  <strong>{currencyFormatter.format(data.summary.revenuePence / 100)}</strong>
                  <span>Revenue</span>
                </div>
                <div>
                  <strong>{data.summary.studentCount}</strong>
                  <span>Students</span>
                </div>
              </div>
            </article>

            <article className="ga-admin-card">
              <div className="ga-admin-card-head">
                <div>
                  <h2>Gen-Mumin Feed</h2>
                  <p>
                    {data.genMumin.status === "CONNECTED"
                      ? "Live registration visibility from the Gen-Mumin project."
                      : data.genMumin.status === "NOT_CONFIGURED"
                        ? "Add the Gen-Mumin feed URL and secret to activate cross-project monitoring."
                        : "The feed is configured, but it could not be reached right now."}
                  </p>
                </div>
                <span className={`ga-admin-status is-${data.genMumin.status === "CONNECTED" ? "completed" : "pending"}`}>
                  {data.genMumin.status === "CONNECTED" ? "Connected" : data.genMumin.status === "NOT_CONFIGURED" ? "Not configured" : "Unavailable"}
                </span>
              </div>
              <div className="ga-admin-progress-stack">
                <div>
                  <div className="ga-admin-progress-meta">
                    <span>Pending registrations</span>
                    <strong>{data.genMumin.metrics?.pendingRegistrations ?? 0}</strong>
                  </div>
                  <div className="ga-admin-progress-track">
                    <div
                      className="ga-admin-progress-fill is-lilac"
                      style={{ width: `${Math.min(100, Math.max(12, (data.genMumin.metrics?.pendingRegistrations ?? 0) * 12))}%` }}
                    />
                  </div>
                </div>
                <div className="ga-admin-highlight-metrics">
                  <div>
                    <strong>{data.genMumin.metrics?.totalStudents ?? 0}</strong>
                    <span>Students</span>
                  </div>
                  <div>
                    <strong>{currencyFormatter.format(data.genMumin.metrics?.revenueGbp ?? 0)}</strong>
                    <span>Revenue</span>
                  </div>
                </div>
              </div>
            </article>

            <article className="ga-admin-card">
              <div className="ga-admin-card-head">
                <div>
                  <h2>Status Breakdown</h2>
                  <p>Operational split for quick scanning</p>
                </div>
              </div>
              <div className="ga-admin-progress-stack">
                <div>
                  <div className="ga-admin-progress-meta"><span>Completed</span><strong>{completionPct}%</strong></div>
                  <div className="ga-admin-progress-track"><div className="ga-admin-progress-fill is-blue" style={{ width: `${completionPct}%` }} /></div>
                </div>
                <div>
                  <div className="ga-admin-progress-meta"><span>Pending</span><strong>{pendingPct}%</strong></div>
                  <div className="ga-admin-progress-track"><div className="ga-admin-progress-fill is-gold" style={{ width: `${pendingPct}%` }} /></div>
                </div>
                <div>
                  <div className="ga-admin-progress-meta"><span>Cancelled</span><strong>{cancelledPct}%</strong></div>
                  <div className="ga-admin-progress-track"><div className="ga-admin-progress-fill is-rose" style={{ width: `${Math.max(cancelledPct, data.summary.cancelledOrders ? 8 : 0)}%` }} /></div>
                </div>
              </div>
            </article>

            <article className="ga-admin-card">
              <div className="ga-admin-card-head">
                <div>
                  <h2>Quick Actions</h2>
                  <p>Jump directly into the main admin tasks</p>
                </div>
              </div>
              <div className="ga-admin-quick-actions">
                <button type="button" onClick={() => setActiveTab("orders")}>Review Orders</button>
                <button type="button" onClick={() => setActiveTab("students")}>View Students</button>
                <button type="button" onClick={() => setActiveTab("scholarships")}>Check Fee Warriors</button>
                <button type="button" onClick={() => setActiveTab("mission")}>Review Mission Support</button>
                <button type="button" onClick={() => setActiveTab("genmumin")}>Open Gen-Mumin Feed</button>
              </div>
            </article>
          </section>

          <section className="ga-admin-bottom-grid">
            <article className="ga-admin-card">
              <div className="ga-admin-card-head">
                <div>
                  <h2>Recent Orders</h2>
                  <p>Latest five order records from the live database</p>
                </div>
              </div>
              <div className="ga-admin-simple-list">
                {recentOrders.map((row) => (
                  <div key={row.id} className="ga-admin-simple-list-item">
                    <div>
                      <strong>{row.paymentReference ?? row.id}</strong>
                      <p>{row.email}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong>{row.amountLabel}</strong>
                      <span className={`ga-admin-status is-${row.adminState.toLowerCase()}`}>{prettify(row.adminState)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="ga-admin-card">
              <div className="ga-admin-card-head">
                <div>
                  <h2>Recent Enrollments</h2>
                  <p>Quick scan of currently active student activity</p>
                </div>
              </div>
              <div className="ga-admin-simple-list">
                {recentStudents.map((row) => (
                  <div key={row.id} className="ga-admin-simple-list-item">
                    <div>
                      <strong>{row.fullName}</strong>
                      <p>{row.email}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong>{row.activeEnrollments} active</strong>
                      <p>{row.countryName ?? "N/A"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="ga-admin-card">
              <div className="ga-admin-card-head">
                <div>
                  <h2>Gen-Mumin Recent Registrations</h2>
                  <p>Latest intake coming through the linked Gen-Mumin project</p>
                </div>
              </div>
              <div className="ga-admin-simple-list">
                {data.genMumin.recentRegistrations.length > 0 ? (
                  data.genMumin.recentRegistrations.slice(0, 5).map((row) => (
                    <div key={row.id} className="ga-admin-simple-list-item">
                      <div>
                        <strong>{row.parentName}</strong>
                        <p>{row.parentEmail}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong>{formatFlexibleCurrency(row.totalAmount, row.currency)}</strong>
                        <p>{prettify(row.status)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="ga-admin-empty-state">
                    {data.genMumin.status === "CONNECTED" ? "No Gen-Mumin registrations yet." : "Gen-Mumin feed is not available yet."}
                  </p>
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}

      {!isHomeTab ? (
      <section className="ga-admin-workspace-card">
        <div className="ga-admin-workspace-head">
          <div>
            <p className="ga-admin-kicker">Operations</p>
            <h2>{workspaceTitle}</h2>
            <p>{workspaceDescription}</p>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, order reference, course, or country..."
            className="ga-admin-search"
          />
        </div>

        {activeTab === "orders" ? (
          <>
            <div className="ga-admin-filter-row">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="ALL">All status</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                <option value="ALL">All payments</option>
                {paymentOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
                <option value="ALL">All courses</option>
                {courseOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select value={pricingFilter} onChange={(event) => setPricingFilter(event.target.value)}>
                <option value="ALL">All pricing</option>
                <option value="DISCOUNTED">Discounted</option>
                <option value="FULL_PRICE">Full price</option>
              </select>
            </div>

            <div className="ga-admin-data-table">
              <div className="ga-admin-table-head">
                <span>Order</span>
                <span>Customer</span>
                <span>Amount</span>
                <span>Payment</span>
                <span>Status</span>
                <span>Date</span>
                <span>Actions</span>
              </div>
              {orderRows.length > 0 ? (
                orderRows.map((row) => {
                  const isSaving = submittingRow === row.id;
                  const isCompleted = row.adminState === "COMPLETED";
                  const isPending = row.adminState === "PENDING";
                  const isCancelled = row.adminState === "CANCELLED";

                  return (
                    <article key={row.id} className="ga-admin-table-row">
                      <div>
                        <span className="ga-admin-pill">Seerah</span>
                        <strong>{row.paymentReference ?? row.id}</strong>
                        <p>{row.courseTitle}</p>
                        {row.discountLabel ? <span className="ga-admin-subpill">{row.discountLabel}</span> : null}
                      </div>
                      <div>
                        <strong>{row.fullName}</strong>
                        <p>{row.email}</p>
                        <p>{row.phone}</p>
                      </div>
                      <div>
                        <strong>{row.amountLabel}</strong>
                        <p>{row.countryName}</p>
                        {row.contributionLabel ? <p>{row.contributionLabel}</p> : null}
                      </div>
                      <div>
                        <strong>{row.paymentLabel}</strong>
                        {row.paymentDetail ? <p>{row.paymentDetail}</p> : null}
                        <p>{prettify(row.paymentStatus)}</p>
                        {row.subscriptionStatus ? <p>Subscription: {prettify(row.subscriptionStatus)}</p> : null}
                      </div>
                      <div>
                        <span className={`ga-admin-status is-${row.adminState.toLowerCase()}`}>{prettify(row.adminState)}</span>
                        <p>Reg: {prettify(row.registrationStatus)}</p>
                        <p>Enroll: {prettify(row.enrollmentStatus)}</p>
                      </div>
                      <div>
                        <strong>{formatDate(row.createdAt)}</strong>
                      </div>
                      <div className="ga-admin-actions">
                        <button
                          type="button"
                          className="ga-admin-primary-btn"
                          disabled={isSaving || isCompleted}
                          onClick={() => void updateRegistrationStatus(row.id, "COMPLETE")}
                        >
                          {isSaving ? "Saving..." : getPrimaryActionLabel(row)}
                        </button>
                        <button
                          type="button"
                          className="ga-admin-outline-btn"
                          disabled={isSaving || isPending}
                          onClick={() => void updateRegistrationStatus(row.id, "PENDING")}
                        >
                          {isPending ? "Pending" : "Set Pending"}
                        </button>
                        <button
                          type="button"
                          className="ga-admin-outline-btn is-danger"
                          disabled={isSaving || isCancelled}
                          onClick={() => void updateRegistrationStatus(row.id, "CANCEL")}
                        >
                          {isCancelled ? "Cancelled" : "Cancel"}
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="ga-admin-empty-state">No orders match the current filters.</p>
              )}
            </div>
          </>
        ) : null}

        {activeTab === "students" ? (
          <div className="ga-admin-data-table">
            <div className="ga-admin-table-head ga-admin-table-head-students">
              <span>Student</span>
              <span>Country</span>
              <span>Access</span>
              <span>Latest Order</span>
              <span>Details</span>
            </div>
            {studentRows.length > 0 ? (
                studentRows.map((row) => (
                <article key={row.id} className="ga-admin-table-row ga-admin-table-row-students">
                  <div>
                    <strong>{row.fullName}</strong>
                    <p>{row.email}</p>
                    <p>{row.phone}</p>
                  </div>
                  <div>
                    <strong>{row.countryName ?? "N/A"}</strong>
                    <p>Scholarships: {row.scholarshipCount}</p>
                  </div>
                  <div>
                    <strong>{row.activeEnrollments} active</strong>
                    <p>{row.completedPayments} completed payments</p>
                    <p>{row.totalRegistrations} registrations</p>
                  </div>
                  <div>
                    <strong>{row.latestAmountLabel ?? "N/A"}</strong>
                    <p>{row.latestPaymentLabel ?? "No orders yet"}</p>
                    <p>{row.latestAdminState ? prettify(row.latestAdminState) : "N/A"}</p>
                  </div>
                  <div className="ga-admin-actions ga-admin-actions-inline">
                    <DetailsButton onClick={() => setSelectedStudentId(row.id)} />
                  </div>
                </article>
              ))
            ) : (
              <p className="ga-admin-empty-state">No students match the current search.</p>
            )}
          </div>
        ) : null}

        {activeTab === "scholarships" ? (
          <>
            <div className="ga-admin-filter-row ga-admin-filter-row-single">
              <select value={applicationStatusFilter} onChange={(event) => setApplicationStatusFilter(event.target.value)}>
                <option value="ALL">All applications</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="ga-admin-data-table">
              <div className="ga-admin-table-head ga-admin-table-head-scholarships">
                <span>Applicant</span>
                <span>Contact</span>
                <span>City</span>
                <span>Payment Preference</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {feeWaiverRows.length > 0 ? (
                  feeWaiverRows.map((row) => (
                  <article key={row.id} className="ga-admin-table-row ga-admin-table-row-scholarships">
                    <div>
                      <strong>{row.fullName}</strong>
                      <p>{row.email}</p>
                      <p>{row.courseTitle}</p>
                    </div>
                    <div>
                      <strong>{row.whatsapp}</strong>
                      <p>{row.occupation}</p>
                    </div>
                    <div>
                      <strong>{row.cityCountry}</strong>
                      <p>{row.knowledgeLevel}</p>
                    </div>
                    <div>
                      <strong>{row.paymentLabel}</strong>
                      <p>{row.amountLabel}</p>
                      <p>{row.contributionLabel}</p>
                    </div>
                    <div>
                      <span className={`ga-admin-status is-${row.status.toLowerCase()}`}>{prettify(row.status)}</span>
                      {row.reviewNote ? <p>{row.reviewNote}</p> : null}
                    </div>
                    <div className="ga-admin-actions">
                      <button
                        type="button"
                        className="ga-admin-primary-btn"
                        disabled={submittingRow === row.id || row.status !== "PENDING"}
                        onClick={() => void reviewFeeWaiver(row.id, true)}
                      >
                        {submittingRow === row.id ? "Saving..." : row.status === "APPROVED" ? "Approved" : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="ga-admin-outline-btn is-danger"
                        disabled={submittingRow === row.id || row.status !== "PENDING"}
                        onClick={() => void reviewFeeWaiver(row.id, false)}
                      >
                        {row.status === "REJECTED" ? "Rejected" : "Reject"}
                      </button>
                      <DetailsButton onClick={() => setSelectedFeeWaiverId(row.id)} />
                    </div>
                  </article>
                ))
              ) : (
                <p className="ga-admin-empty-state">No fee warrior applications match the current filters.</p>
              )}
            </div>
          </>
        ) : null}

        {activeTab === "mission" ? (
          <>
            <div className="ga-admin-filter-row ga-admin-filter-row-single">
              <select value={missionStatusFilter} onChange={(event) => setMissionStatusFilter(event.target.value)}>
                <option value="ALL">All support statuses</option>
                <option value="PENDING">Pending</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="SUCCEEDED">Succeeded</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            <div className="ga-admin-data-table">
              <div className="ga-admin-table-head">
                <span>Reference</span>
                <span>Donor</span>
                <span>Amount</span>
                <span>Payment</span>
                <span>Status</span>
                <span>Date</span>
                <span>Actions</span>
              </div>
              {missionRows.map((row) => (
                <article key={row.id} className="ga-admin-table-row">
                  <div>
                    <span className="ga-admin-pill">Support</span>
                    <strong>{row.paymentReference ?? row.id}</strong>
                    {row.countryName ? <p>{row.countryName}</p> : null}
                  </div>
                  <div>
                    <strong>{row.fullName}</strong>
                    <p>{row.email}</p>
                    <p>{row.phone}</p>
                  </div>
                  <div>
                    <strong>{row.amountLabel}</strong>
                    {row.donorMessage ? <p>{row.donorMessage}</p> : null}
                  </div>
                  <div>
                    <strong>{prettify(row.paymentMethod)}</strong>
                    {row.hasManualSubmission ? <p>Manual submission attached</p> : <p>Auto confirmation flow</p>}
                  </div>
                  <div>
                    <span className={`ga-admin-status is-${row.status.toLowerCase()}`}>{prettify(row.status)}</span>
                    {row.adminNote ? <p>{row.adminNote}</p> : null}
                  </div>
                  <div>
                    <strong>{formatDate(row.createdAt)}</strong>
                  </div>
                  <div className="ga-admin-actions">
                    <button
                      type="button"
                      className="ga-admin-primary-btn"
                      disabled={submittingRow === row.id}
                      onClick={() => void updateMissionDonation(row.id, "CONFIRM")}
                    >
                      {submittingRow === row.id ? "Saving..." : "Confirm"}
                    </button>
                    <button
                      type="button"
                      className="ga-admin-outline-btn"
                      disabled={submittingRow === row.id}
                      onClick={() => void updateMissionDonation(row.id, "PENDING")}
                    >
                      Pending
                    </button>
                    <button
                      type="button"
                      className="ga-admin-outline-btn is-danger"
                      disabled={submittingRow === row.id}
                      onClick={() => void updateMissionDonation(row.id, "CANCEL")}
                    >
                      Cancel
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}

        {activeTab === "genmumin" ? (
          <>
            <section className="ga-admin-panels-grid">
              <article className="ga-admin-card ga-admin-highlight-card">
                <h2>Feed Status</h2>
                <div className="ga-admin-highlight-metrics">
                  <div>
                    <strong>{data.genMumin.status === "CONNECTED" ? "Connected" : data.genMumin.status === "NOT_CONFIGURED" ? "Setup needed" : "Unavailable"}</strong>
                    <span>Connection</span>
                  </div>
                  <div>
                    <strong>{formatDate(data.genMumin.lastCheckedAt)}</strong>
                    <span>Last checked</span>
                  </div>
                </div>
                {data.genMumin.error ? <p>{data.genMumin.error}</p> : null}
                {data.genMumin.endpoint ? <p>{data.genMumin.endpoint}</p> : null}
              </article>

              <article className="ga-admin-card">
                <div className="ga-admin-card-head">
                  <div>
                    <h2>Gen-Mumin Metrics</h2>
                    <p>Shared admin visibility for registrations and student growth</p>
                  </div>
                </div>
                <div className="ga-admin-highlight-metrics">
                  <div>
                    <strong>{data.genMumin.metrics?.totalStudents ?? 0}</strong>
                    <span>Students</span>
                  </div>
                  <div>
                    <strong>{data.genMumin.metrics?.activeEnrollments ?? 0}</strong>
                    <span>Active enrollments</span>
                  </div>
                  <div>
                    <strong>{data.genMumin.metrics?.pendingRegistrations ?? 0}</strong>
                    <span>Pending registrations</span>
                  </div>
                  <div>
                    <strong>{currencyFormatter.format(data.genMumin.metrics?.revenueGbp ?? 0)}</strong>
                    <span>Revenue</span>
                  </div>
                </div>
              </article>
            </section>

            <div className="ga-admin-data-table">
              <div className="ga-admin-table-head">
                <span>Parent</span>
                <span>Location</span>
                <span>Students</span>
                <span>Amount</span>
                <span>Status</span>
                <span>Source</span>
                <span>Date</span>
              </div>
              {genMuminRows.length > 0 ? (
                genMuminRows.map((row) => (
                  <article key={row.id} className="ga-admin-table-row">
                    <div>
                      <strong>{row.parentName}</strong>
                      <p>{row.parentEmail}</p>
                    </div>
                    <div>
                      <strong>{row.country}</strong>
                      <p>{row.referrer ?? "Direct / unknown"}</p>
                    </div>
                    <div>
                      <strong>{row.studentCount}</strong>
                      <p>{row.studentCount === 1 ? "Child" : "Children"}</p>
                    </div>
                    <div>
                      <strong>{formatFlexibleCurrency(row.totalAmount, row.currency)}</strong>
                      <p>{row.currency}</p>
                    </div>
                    <div>
                      <span className={`ga-admin-status is-${row.status.toLowerCase().replaceAll("_", "-")}`}>{prettify(row.status)}</span>
                    </div>
                    <div>
                      <strong>{row.source ?? "Unknown"}</strong>
                    </div>
                    <div>
                      <strong>{formatDate(row.createdAt)}</strong>
                    </div>
                  </article>
                ))
              ) : (
                <p className="ga-admin-empty-state">
                  {data.genMumin.status === "CONNECTED"
                    ? "No Gen-Mumin registrations match the current search."
                    : "Gen-Mumin feed is not ready yet. Add GEN_MUMIN_FEED_URL and GEN_MUMIN_FEED_SECRET in the TGA app."}
                </p>
              )}
            </div>
          </>
        ) : null}

        {message ? <p className="ga-admin-success-banner">{message}</p> : null}
        {error ? <p className="ga-admin-error-banner">{error}</p> : null}
      </section>
      ) : null}

      {selectedStudent ? (
        <div className="ga-admin-modal-backdrop" onClick={() => setSelectedStudentId(null)}>
          <section className="ga-admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="ga-admin-modal-head">
              <div>
                <p className="ga-admin-kicker">Student Details</p>
                <h3>{selectedStudent.fullName}</h3>
              </div>
              <button type="button" className="ga-admin-notification-close" onClick={() => setSelectedStudentId(null)}>
                Close
              </button>
            </div>

            <div className="ga-admin-modal-grid">
              <p><strong>Email:</strong> {selectedStudent.email}</p>
              <p><strong>Phone:</strong> {selectedStudent.phone}</p>
              <p><strong>Country:</strong> {selectedStudent.countryName ?? "N/A"}</p>
              <p><strong>Total registrations:</strong> {selectedStudent.totalRegistrations}</p>
              <p><strong>Active enrollments:</strong> {selectedStudent.activeEnrollments}</p>
              <p><strong>Scholarships:</strong> {selectedStudent.scholarshipCount}</p>
              <p><strong>Completed payments:</strong> {selectedStudent.completedPayments}</p>
              <p><strong>Latest order:</strong> {formatDate(selectedStudent.latestOrderDate)}</p>
            </div>

            <div className="ga-admin-modal-section">
              <h4>Registrations</h4>
              <div className="ga-admin-detail-list">
                {selectedStudent.registrationSummaries.map((item) => (
                  <div key={item.id} className="ga-admin-detail-list-item">
                    <div>
                      <strong>{item.paymentReference ?? item.id}</strong>
                      <p>{item.courseTitle}</p>
                    </div>
                    <div>
                      <strong>{item.amountLabel}</strong>
                      <p>{item.paymentLabel}</p>
                    </div>
                    <div>
                      <span className={`ga-admin-status is-${item.adminState.toLowerCase()}`}>{prettify(item.adminState)}</span>
                      <p>{formatDate(item.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {selectedFeeWaiver ? (
        <div className="ga-admin-modal-backdrop" onClick={() => setSelectedFeeWaiverId(null)}>
          <section className="ga-admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="ga-admin-modal-head">
              <div>
                <p className="ga-admin-kicker">Fee Warrior Details</p>
                <h3>{selectedFeeWaiver.fullName}</h3>
              </div>
              <button type="button" className="ga-admin-notification-close" onClick={() => setSelectedFeeWaiverId(null)}>
                Close
              </button>
            </div>

            <div className="ga-admin-modal-grid">
              <p><strong>Email:</strong> {selectedFeeWaiver.email}</p>
              <p><strong>WhatsApp:</strong> {selectedFeeWaiver.whatsapp}</p>
              <p><strong>Age:</strong> {selectedFeeWaiver.age ?? "N/A"}</p>
              <p><strong>City and country:</strong> {selectedFeeWaiver.cityCountry}</p>
              <p><strong>Occupation:</strong> {selectedFeeWaiver.occupation}</p>
              <p><strong>Knowledge level:</strong> {selectedFeeWaiver.knowledgeLevel}</p>
              <p><strong>Course:</strong> {selectedFeeWaiver.courseTitle}</p>
              <p><strong>Listed price:</strong> {selectedFeeWaiver.listedPrice}</p>
              <p><strong>Payment preference:</strong> {selectedFeeWaiver.paymentLabel}</p>
              <p><strong>Amount:</strong> {selectedFeeWaiver.amountLabel}</p>
              <p><strong>Can attend regularly:</strong> {selectedFeeWaiver.canAttendRegularly}</p>
              <p><strong>How heard:</strong> {selectedFeeWaiver.howHeard ?? "N/A"}</p>
              <p><strong>Orientation attended:</strong> {formatBoolean(selectedFeeWaiver.attendedOrientation)}</p>
              <p><strong>Adab commitment:</strong> {formatBoolean(selectedFeeWaiver.adabCommitment)}</p>
              <p><strong>Genuine need confirmed:</strong> {formatBoolean(selectedFeeWaiver.genuineFinancialNeed)}</p>
              <p><strong>Status:</strong> {prettify(selectedFeeWaiver.status)}</p>
              {selectedFeeWaiver.senderName ? <p><strong>Sender name:</strong> {selectedFeeWaiver.senderName}</p> : null}
              {selectedFeeWaiver.senderNumber ? <p><strong>Sender number:</strong> {selectedFeeWaiver.senderNumber}</p> : null}
              {selectedFeeWaiver.referenceKey ? <p><strong>Reference key:</strong> {selectedFeeWaiver.referenceKey}</p> : null}
            </div>

            <div className="ga-admin-modal-section">
              <h4>Application Responses</h4>
              <div className="ga-admin-copy-stack">
                <p><strong>Previous Seerah study:</strong> {selectedFeeWaiver.previousSeerahStudy ?? "N/A"}</p>
                <p><strong>Current involvement:</strong> {selectedFeeWaiver.currentInvolvement ?? "N/A"}</p>
                <p><strong>What draws them:</strong> {selectedFeeWaiver.whatDrawsYou}</p>
                <p><strong>How it benefits:</strong> {selectedFeeWaiver.howItBenefits}</p>
                <p><strong>Most interesting topic:</strong> {selectedFeeWaiver.mostInterestingTopic}</p>
                <p><strong>Why this topic:</strong> {selectedFeeWaiver.whyThisTopic}</p>
                <p><strong>Financial reason:</strong> {selectedFeeWaiver.applicationReason}</p>
                {selectedFeeWaiver.manualNotes ? <p><strong>Manual notes:</strong> {selectedFeeWaiver.manualNotes}</p> : null}
                {selectedFeeWaiver.reviewNote ? <p><strong>Admin note:</strong> {selectedFeeWaiver.reviewNote}</p> : null}
              </div>
            </div>

            <textarea
              rows={4}
              value={feeWaiverNotes[selectedFeeWaiver.id] ?? selectedFeeWaiver.reviewNote ?? ""}
              onChange={(event) => setFeeWaiverNotes((current) => ({ ...current, [selectedFeeWaiver.id]: event.target.value }))}
              placeholder="Optional admin note"
              className="ga-admin-note"
            />

            <div className="ga-admin-actions ga-admin-modal-actions">
              <button
                type="button"
                className="ga-admin-primary-btn"
                disabled={submittingRow === selectedFeeWaiver.id || selectedFeeWaiver.status !== "PENDING"}
                onClick={() => void reviewFeeWaiver(selectedFeeWaiver.id, true)}
              >
                {submittingRow === selectedFeeWaiver.id ? "Saving..." : selectedFeeWaiver.status === "APPROVED" ? "Approved" : "Approve"}
              </button>
              <button
                type="button"
                className="ga-admin-outline-btn is-danger"
                disabled={submittingRow === selectedFeeWaiver.id || selectedFeeWaiver.status !== "PENDING"}
                onClick={() => void reviewFeeWaiver(selectedFeeWaiver.id, false)}
              >
                {selectedFeeWaiver.status === "REJECTED" ? "Rejected" : "Reject"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
