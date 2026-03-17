"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLogoutButton from "@/components/admin/admin-logout-button";
import type { AdminDashboardSnapshot } from "@/services/admin.service";

type Props = {
  data: AdminDashboardSnapshot;
  adminEmail: string;
};

type TabKey = "orders" | "students" | "scholarships";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
});

function formatDate(value: string | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function prettify(value: string | null) {
  if (!value) return "N/A";
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AdminDashboard({ data, adminEmail }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("orders");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [pricingFilter, setPricingFilter] = useState("ALL");
  const [applicationStatusFilter, setApplicationStatusFilter] = useState("ALL");
  const [submittingRow, setSubmittingRow] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freeWarriorNotes, setFreeWarriorNotes] = useState<Record<string, string>>({});

  const orderRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.registrations.filter((row) => {
      if (
        term &&
        ![
          row.paymentReference ?? "",
          row.fullName,
          row.email,
          row.courseTitle,
          row.countryName,
        ]
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

  const scholarshipRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.freeWarriorApplications.filter((row) => {
      if (applicationStatusFilter !== "ALL" && row.status !== applicationStatusFilter) return false;
      if (!term) return true;
      return [row.fullName, row.email, row.whatsapp, row.cityCountry].join(" ").toLowerCase().includes(term);
    });
  }, [applicationStatusFilter, data.freeWarriorApplications, search]);

  const paymentOptions = Array.from(new Set(data.registrations.map((row) => row.paymentMethod)));
  const courseOptions = Array.from(new Set(data.registrations.map((row) => row.courseSlug)));

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

  async function reviewScholarship(applicationId: string, approve: boolean) {
    setSubmittingRow(applicationId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/free-warrior/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          approve,
          note: freeWarriorNotes[applicationId] ?? "",
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

  return (
    <div className="ga-dashboard-stack" style={{ gap: "1.2rem" }}>
      <section className="ga-dashboard-hero">
        <div>
          <p className="ga-dashboard-kicker">Admin panel</p>
          <h1 className="ga-heading">Registrations, payments, students, and scholarships in one place</h1>
          <p className="ga-copy" style={{ marginTop: "0.75rem", maxWidth: 780 }}>
            Use this dashboard to review incoming orders, verify pending manual payments, monitor fee waivers,
            and keep student access aligned with payment status.
          </p>
          <p className="ga-dashboard-muted" style={{ marginTop: "0.8rem" }}>
            Logged in as {adminEmail}
          </p>
        </div>
        <div className="ga-dashboard-actions">
          <button type="button" className="ga-btn ga-btn-outline" onClick={() => router.refresh()}>
            Refresh
          </button>
          <AdminLogoutButton />
        </div>
      </section>

      <section className="ga-admin-metric-grid">
        <article className="ga-admin-metric-card">
          <span>Total Orders</span>
          <strong>{data.summary.totalOrders}</strong>
        </article>
        <article className="ga-admin-metric-card">
          <span>Completed</span>
          <strong>{data.summary.completedOrders}</strong>
        </article>
        <article className="ga-admin-metric-card">
          <span>Pending</span>
          <strong>{data.summary.pendingOrders}</strong>
        </article>
        <article className="ga-admin-metric-card">
          <span>Cancelled</span>
          <strong>{data.summary.cancelledOrders}</strong>
        </article>
        <article className="ga-admin-metric-card">
          <span>Revenue</span>
          <strong>{currencyFormatter.format(data.summary.revenuePence / 100)}</strong>
        </article>
        <article className="ga-admin-metric-card">
          <span>Pending GBP</span>
          <strong>{currencyFormatter.format(data.summary.pendingPence / 100)}</strong>
        </article>
        <article className="ga-admin-metric-card">
          <span>Fee Waivers</span>
          <strong>{data.summary.feeWaivers}</strong>
        </article>
        <article className="ga-admin-metric-card">
          <span>Students</span>
          <strong>{data.summary.studentCount}</strong>
        </article>
      </section>

      <section className="ga-dashboard-card">
        <div className="ga-admin-toolbar">
          <div className="ga-dashboard-actions">
            <button
              type="button"
              className={`ga-btn ${activeTab === "orders" ? "ga-btn-primary" : "ga-btn-outline"}`}
              onClick={() => setActiveTab("orders")}
            >
              Orders
            </button>
            <button
              type="button"
              className={`ga-btn ${activeTab === "students" ? "ga-btn-primary" : "ga-btn-outline"}`}
              onClick={() => setActiveTab("students")}
            >
              Students
            </button>
            <button
              type="button"
              className={`ga-btn ${activeTab === "scholarships" ? "ga-btn-primary" : "ga-btn-outline"}`}
              onClick={() => setActiveTab("scholarships")}
            >
              Fee Waivers
            </button>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by order number, name, email, or country..."
            className="ga-admin-search"
          />
        </div>

        {activeTab === "orders" ? (
          <>
            <div className="ga-admin-filter-row">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="ALL">All statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                <option value="ALL">All payments</option>
                {paymentOptions.map((option) => (
                  <option key={option} value={option}>
                    {prettify(option)}
                  </option>
                ))}
              </select>
              <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
                <option value="ALL">All courses</option>
                {courseOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select value={pricingFilter} onChange={(event) => setPricingFilter(event.target.value)}>
                <option value="ALL">All pricing</option>
                <option value="DISCOUNTED">Discounted</option>
                <option value="FULL_PRICE">Full price</option>
              </select>
            </div>

            <div className="ga-admin-table-shell">
              {orderRows.map((row) => (
                <article key={row.id} className="ga-admin-row">
                  <div>
                    <p className="ga-admin-label">Order</p>
                    <strong>{row.paymentReference ?? row.id}</strong>
                    <p className="ga-dashboard-muted">{row.courseTitle}</p>
                    {row.discountLabel ? <span className="ga-admin-tag">{row.discountLabel}</span> : null}
                  </div>
                  <div>
                    <p className="ga-admin-label">Customer</p>
                    <strong>{row.fullName}</strong>
                    <p className="ga-dashboard-muted">{row.email}</p>
                    <p className="ga-dashboard-muted">{row.phone}</p>
                  </div>
                  <div>
                    <p className="ga-admin-label">Amount</p>
                    <strong>{row.amountLabel}</strong>
                    <p className="ga-dashboard-muted">{row.countryName}</p>
                  </div>
                  <div>
                    <p className="ga-admin-label">Payment</p>
                    <strong>{prettify(row.paymentMethod)}</strong>
                    <p className="ga-dashboard-muted">{prettify(row.paymentStatus)}</p>
                    {row.subscriptionStatus ? <p className="ga-dashboard-muted">Subscription: {prettify(row.subscriptionStatus)}</p> : null}
                  </div>
                  <div>
                    <p className="ga-admin-label">Status</p>
                    <strong>{prettify(row.adminState)}</strong>
                    <p className="ga-dashboard-muted">Reg: {prettify(row.registrationStatus)}</p>
                    <p className="ga-dashboard-muted">Enroll: {prettify(row.enrollmentStatus)}</p>
                  </div>
                  <div>
                    <p className="ga-admin-label">Date</p>
                    <strong>{formatDate(row.createdAt)}</strong>
                  </div>
                  <div>
                    <p className="ga-admin-label">Actions</p>
                    <div className="ga-admin-actions">
                      <button
                        type="button"
                        className="ga-btn ga-btn-primary"
                        disabled={submittingRow === row.id}
                        onClick={() => void updateRegistrationStatus(row.id, "COMPLETE")}
                      >
                        {submittingRow === row.id ? "Saving..." : row.canManuallyComplete ? "Mark Paid" : "Complete"}
                      </button>
                      <button
                        type="button"
                        className="ga-btn ga-btn-outline"
                        disabled={submittingRow === row.id}
                        onClick={() => void updateRegistrationStatus(row.id, "PENDING")}
                      >
                        Pending
                      </button>
                      <button
                        type="button"
                        className="ga-btn ga-btn-outline"
                        disabled={submittingRow === row.id}
                        onClick={() => void updateRegistrationStatus(row.id, "CANCEL")}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}

        {activeTab === "students" ? (
          <div className="ga-admin-table-shell">
            {studentRows.map((row) => (
              <article key={row.id} className="ga-admin-row ga-admin-row-students">
                <div>
                  <p className="ga-admin-label">Student</p>
                  <strong>{row.fullName}</strong>
                  <p className="ga-dashboard-muted">{row.email}</p>
                </div>
                <div>
                  <p className="ga-admin-label">Phone</p>
                  <strong>{row.phone}</strong>
                  <p className="ga-dashboard-muted">{row.countryName ?? "Country not set"}</p>
                </div>
                <div>
                  <p className="ga-admin-label">Registrations</p>
                  <strong>{row.totalRegistrations}</strong>
                  <p className="ga-dashboard-muted">Completed payments: {row.completedPayments}</p>
                </div>
                <div>
                  <p className="ga-admin-label">Access</p>
                  <strong>{row.activeEnrollments} active</strong>
                  <p className="ga-dashboard-muted">Scholarships: {row.scholarshipCount}</p>
                </div>
                <div>
                  <p className="ga-admin-label">Latest Order</p>
                  <strong>{formatDate(row.latestOrderDate)}</strong>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {activeTab === "scholarships" ? (
          <>
            <div className="ga-admin-filter-row">
              <select value={applicationStatusFilter} onChange={(event) => setApplicationStatusFilter(event.target.value)}>
                <option value="ALL">All applications</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div className="ga-admin-table-shell">
              {scholarshipRows.map((row) => (
                <article key={row.id} className="ga-admin-scholarship-card">
                  <div className="ga-admin-scholarship-head">
                    <div>
                      <strong>{row.fullName}</strong>
                      <p className="ga-dashboard-muted">{row.email}</p>
                      <p className="ga-dashboard-muted">{row.whatsapp}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong>{prettify(row.status)}</strong>
                      <p className="ga-dashboard-muted">{formatDate(row.createdAt)}</p>
                    </div>
                  </div>

                  <div className="ga-admin-scholarship-grid">
                    <p><strong>City & Country:</strong> {row.cityCountry}</p>
                    <p><strong>Occupation:</strong> {row.occupation}</p>
                    <p><strong>Knowledge Level:</strong> {row.knowledgeLevel}</p>
                    <p><strong>Course:</strong> {row.courseTitle}</p>
                    <p><strong>Listed Price:</strong> {row.listedPrice}</p>
                    <p><strong>Can attend regularly:</strong> {row.canAttendRegularly}</p>
                    <p><strong>Orientation:</strong> {row.attendedOrientation ? "Yes" : "No"}</p>
                    <p><strong>Adab commitment:</strong> {row.adabCommitment ? "Yes" : "No"}</p>
                    <p><strong>Financial need:</strong> {row.genuineFinancialNeed ? "Yes" : "No"}</p>
                  </div>

                  <div className="ga-admin-scholarship-copy">
                    <p><strong>What draws them:</strong> {row.whatDrawsYou}</p>
                    <p><strong>How it benefits:</strong> {row.howItBenefits}</p>
                    <p><strong>Most interesting topic:</strong> {row.mostInterestingTopic}</p>
                    <p><strong>Why this topic:</strong> {row.whyThisTopic}</p>
                    <p><strong>Reason for waiver:</strong> {row.reasonForWaiver}</p>
                  </div>

                  <textarea
                    rows={3}
                    value={freeWarriorNotes[row.id] ?? row.reviewNote ?? ""}
                    onChange={(event) => setFreeWarriorNotes((current) => ({ ...current, [row.id]: event.target.value }))}
                    placeholder="Optional admin note"
                    className="ga-admin-note"
                  />

                  {row.status === "PENDING" ? (
                    <div className="ga-admin-actions">
                      <button
                        type="button"
                        className="ga-btn ga-btn-primary"
                        disabled={submittingRow === row.id}
                        onClick={() => void reviewScholarship(row.id, true)}
                      >
                        {submittingRow === row.id ? "Saving..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="ga-btn ga-btn-outline"
                        disabled={submittingRow === row.id}
                        onClick={() => void reviewScholarship(row.id, false)}
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

        {message ? <p className="ga-dashboard-success" style={{ marginTop: "1rem" }}>{message}</p> : null}
        {error ? <p className="ga-dashboard-error" style={{ marginTop: "1rem" }}>{error}</p> : null}
      </section>
    </div>
  );
}
