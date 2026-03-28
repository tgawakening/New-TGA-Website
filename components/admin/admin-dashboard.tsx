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

type TabKey = "home" | "orders" | "students" | "scholarships" | "mission";

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

function prettify(value: string | null) {
  if (!value) return "N/A";
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
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
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);

  const orderRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.registrations.filter((row) => {
      if (
        term &&
        ![row.paymentReference ?? "", row.fullName, row.email, row.courseTitle, row.countryName]
          .join(" ")
          .toLowerCase()
          .includes(term)
      ) {
        return false;
      }

      if (statusFilter !== "ALL" && row.adminState !== statusFilter) return false;
      if (paymentFilter !== "ALL" && row.paymentMethod !== paymentFilter) return false;
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
      return [row.fullName, row.email, row.countryName ?? "", row.phone].join(" ").toLowerCase().includes(term);
    });
  }, [data.students, search]);

  const feeWaiverRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.freeWarriorApplications.filter((row) => {
      if (applicationStatusFilter !== "ALL" && row.status !== applicationStatusFilter) return false;
      if (!term) return true;
      return [row.fullName, row.email, row.whatsapp, row.cityCountry].join(" ").toLowerCase().includes(term);
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

  const paymentOptions = Array.from(new Set(data.registrations.map((row) => row.paymentMethod)));
  const courseOptions = Array.from(new Set(data.registrations.map((row) => row.courseSlug)));

  const paymentCounts = useMemo(() => {
    return data.registrations.reduce<Record<string, number>>((acc, row) => {
      acc[row.paymentMethod] = (acc[row.paymentMethod] ?? 0) + 1;
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
          : "Mission Support Donations";
  const workspaceDescription =
    activeTab === "orders"
      ? "Filter and update registration, payment, and enrollment states."
      : activeTab === "students"
        ? "Scan the current student base and track access history."
        : activeTab === "scholarships"
        ? "Review scholarship requests and approve or reject them."
        : "Review donor submissions, confirm manual support payments, and track contribution details.";

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
            Fee Waivers
          </button>
          <button type="button" className={`ga-admin-nav-pill ${activeTab === "mission" ? "is-active" : ""}`} onClick={() => setActiveTab("mission")}>
            Mission Support
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
              <small>Live registrations in system</small>
            </article>
            <article className="ga-admin-metric-card is-blue">
              <span>Revenue</span>
              <strong>{currencyFormatter.format(data.summary.revenuePence / 100)}</strong>
              <small>Confirmed GBP revenue</small>
            </article>
            <article className="ga-admin-metric-card is-lilac">
              <span>Fee Waivers</span>
              <strong>{data.summary.feeWaivers}</strong>
              <small>Approved or pending waivers</small>
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
                  <p>Distribution by payment provider</p>
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
                        <span>{prettify(option)}</span>
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
                <button type="button" onClick={() => setActiveTab("scholarships")}>Check Fee Waivers</button>
                <button type="button" onClick={() => setActiveTab("mission")}>Review Mission Support</button>
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
                  <option key={option} value={option}>{prettify(option)}</option>
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
              {orderRows.map((row) => (
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
                  </div>
                  <div>
                    <strong>{prettify(row.paymentMethod)}</strong>
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
                      disabled={submittingRow === row.id}
                      onClick={() => void updateRegistrationStatus(row.id, "COMPLETE")}
                    >
                      {submittingRow === row.id ? "Saving..." : row.canManuallyComplete ? "Mark Paid" : "Complete"}
                    </button>
                    <button
                      type="button"
                      className="ga-admin-outline-btn"
                      disabled={submittingRow === row.id}
                      onClick={() => void updateRegistrationStatus(row.id, "PENDING")}
                    >
                      Pending
                    </button>
                    <button
                      type="button"
                      className="ga-admin-outline-btn is-danger"
                      disabled={submittingRow === row.id}
                      onClick={() => void updateRegistrationStatus(row.id, "CANCEL")}
                    >
                      Cancel
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}

        {activeTab === "students" ? (
          <div className="ga-admin-card-grid">
            {recentStudents.map((row) => (
              <article key={row.id} className="ga-admin-mini-card">
                <div className="ga-admin-mini-head">
                  <div className="ga-admin-mini-avatar">{row.fullName.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <strong>{row.fullName}</strong>
                    <p>{row.email}</p>
                  </div>
                </div>
                <div className="ga-admin-mini-stats">
                  <div><span>Phone</span><strong>{row.phone}</strong></div>
                  <div><span>Country</span><strong>{row.countryName ?? "N/A"}</strong></div>
                  <div><span>Registrations</span><strong>{row.totalRegistrations}</strong></div>
                  <div><span>Active</span><strong>{row.activeEnrollments}</strong></div>
                </div>
              </article>
            ))}
            {studentRows.length > recentStudents.length ? (
              <article className="ga-admin-mini-card is-more">
                <strong>{studentRows.length - recentStudents.length} more students</strong>
                <p>Use search to scan the full student base.</p>
              </article>
            ) : null}
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

            <div className="ga-admin-card-grid">
              {feeWaiverRows.map((row) => (
                <article key={row.id} className="ga-admin-fee-card">
                  <div className="ga-admin-fee-head">
                    <div>
                      <strong>{row.fullName}</strong>
                      <p>{row.email}</p>
                      <p>{row.whatsapp}</p>
                    </div>
                    <span className={`ga-admin-status is-${row.status.toLowerCase()}`}>{prettify(row.status)}</span>
                  </div>

                  <div className="ga-admin-fee-grid">
                    <p><strong>City:</strong> {row.cityCountry}</p>
                    <p><strong>Occupation:</strong> {row.occupation}</p>
                    <p><strong>Level:</strong> {row.knowledgeLevel}</p>
                    <p><strong>Course:</strong> {row.courseTitle}</p>
                    <p><strong>Price:</strong> {row.listedPrice}</p>
                    <p><strong>Attendance:</strong> {row.canAttendRegularly}</p>
                  </div>

                  <div className="ga-admin-fee-copy">
                    <p><strong>What draws them:</strong> {row.whatDrawsYou}</p>
                    <p><strong>How it benefits:</strong> {row.howItBenefits}</p>
                    <p><strong>Most interesting topic:</strong> {row.mostInterestingTopic}</p>
                    <p><strong>Why this topic:</strong> {row.whyThisTopic}</p>
                    <p><strong>Reason for waiver:</strong> {row.reasonForWaiver}</p>
                  </div>

                  <textarea
                    rows={3}
                    value={feeWaiverNotes[row.id] ?? row.reviewNote ?? ""}
                    onChange={(event) => setFeeWaiverNotes((current) => ({ ...current, [row.id]: event.target.value }))}
                    placeholder="Optional admin note"
                    className="ga-admin-note"
                  />

                  {row.status === "PENDING" ? (
                    <div className="ga-admin-actions">
                      <button
                        type="button"
                        className="ga-admin-primary-btn"
                        disabled={submittingRow === row.id}
                        onClick={() => void reviewFeeWaiver(row.id, true)}
                      >
                        {submittingRow === row.id ? "Saving..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="ga-admin-outline-btn is-danger"
                        disabled={submittingRow === row.id}
                        onClick={() => void reviewFeeWaiver(row.id, false)}
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
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

        {message ? <p className="ga-admin-success-banner">{message}</p> : null}
        {error ? <p className="ga-admin-error-banner">{error}</p> : null}
      </section>
      ) : null}
    </div>
  );
}
