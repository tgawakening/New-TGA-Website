"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { countries } from "countries-list";
import AdminNotificationBell from "@/components/admin/admin-notification-bell";
import type { AdminNotificationItem } from "@/services/admin.service";
import type { listSirahAdmin } from "@/services/sirah-admin.service";
import { formatSirahMoney, minorToDecimal } from "@/lib/sirah/catalog";
import { SirahAdminCohort } from "./admin-cohort";
import { SirahAdminNav } from "./admin-nav";
import styles from "./admin-students.module.css";

type Snapshot = Awaited<ReturnType<typeof listSirahAdmin>>;
type Student = Snapshot["rows"][number];

const paymentStates = [
  "UNPAID",
  "PROCESSING",
  "AWAITING_REVIEW",
  "PAID",
  "REJECTED",
  "FAILED",
  "REFUND_PENDING",
  "REFUNDED",
];
const enrolmentStates = ["PENDING", "ACTIVE", "CANCELLED", "COMPLETED"];
const actionLabels = {
  APPROVE: "Approve / complete payment",
  PENDING: "Set pending",
  REJECT: "Reject",
  CANCEL: "Cancel",
  COMPLETE: "Complete course",
  RECONCILE_PROVIDER: "Reconcile provider checkout",
  REFUND: "Issue / record verified refund",
  RETRY_NOTIFICATIONS: "Retry email delivery",
};
type Action = keyof typeof actionLabels;

const actionResults: Record<Action, string> = {
  APPROVE: "Payment completed. Course enrolment is active.",
  PENDING:
    "Returned to pending review. No payment or course access was granted.",
  REJECT: "Payment evidence rejected.",
  CANCEL:
    "Cancellation recorded. Check the access end date for any remaining paid access.",
  COMPLETE: "Enrolment marked complete.",
  RECONCILE_PROVIDER: "Provider status checked. See payment status below.",
  REFUND: "Refund recorded.",
  RETRY_NOTIFICATIONS: "Email delivery checked. See delivery history.",
};

function availableActions(student: Student): Action[] {
  const manual =
    student.method === "BANK_TRANSFER" || student.method === "JAZZCASH";
  const online = student.method === "STRIPE" || student.method === "PAYPAL";
  const review = manual && student.paymentState === "AWAITING_REVIEW";
  const actions: Action[] = [];
  if (
    review ||
    (manual && student.enrolmentState === "CANCELLED" && !student.paidCount)
  )
    actions.push("APPROVE");
  if (review) actions.push("REJECT");
  if (
    manual &&
    !student.cancelledAt &&
    student.enrolmentState === "PENDING" &&
    !student.paidCount &&
    !student.paidMinor &&
    ["UNPAID", "REJECTED", "FAILED"].includes(student.paymentState)
  )
    actions.push("PENDING");
  if (
    !student.cancelledAt &&
    (["PENDING", "ACTIVE"].includes(student.enrolmentState) ||
      (student.enrolmentState === "COMPLETED" && student.nextBillingAt))
  )
    actions.push("CANCEL");
  if (
    !student.cancelledAt &&
    student.paymentState === "PAID" &&
    student.enrolmentState === "ACTIVE"
  )
    actions.push("COMPLETE");
  if (online && student.paymentState === "PROCESSING")
    actions.push("RECONCILE_PROVIDER");
  if (
    student.paidMinor > student.refundedMinor &&
    (manual ||
      (online &&
        student.events.some((entry) =>
          ["FIRST", "RENEWAL"].includes(entry.kind),
        )))
  )
    actions.push("REFUND");
  if (
    student.notifications.some((entry) =>
      ["PENDING", "FAILED"].includes(entry.state),
    )
  )
    actions.push("RETRY_NOTIFICATIONS");
  return actions;
}

function actionClass(action: Action) {
  if (action === "APPROVE" || action === "COMPLETE")
    return "ga-admin-primary-btn";
  if (action === "REJECT" || action === "CANCEL" || action === "REFUND")
    return "ga-admin-outline-btn is-danger";
  return "ga-admin-outline-btn";
}

function label(value: string) {
  if (value === "PAID") return "Completed";
  if (value === "UNPAID") return "Pending payment";
  if (value === "BANK_TRANSFER") return "Bank transfer";
  if (value === "PAYPAL") return "PayPal";
  if (value === "JAZZCASH") return "JazzCash";
  return value[0] + value.slice(1).toLowerCase().replaceAll("_", " ");
}

function date(value: Date | string | null) {
  return value
    ? new Date(value).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not scheduled";
}

function Status({ value }: { value: string }) {
  const tone = ["PAID", "ACTIVE", "COMPLETED"].includes(value)
    ? "completed"
    : ["CANCELLED", "FAILED", "REJECTED"].includes(value)
      ? "cancelled"
      : "pending";
  return <span className={`ga-admin-status is-${tone}`}>{label(value)}</span>;
}

async function readSnapshot(
  query: string,
  signal?: AbortSignal,
): Promise<Snapshot> {
  const response = await fetch(`/api/admin/sirah?${query}`, {
    signal,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || "Could not load students.");
  return result;
}

export function SirahAdminStudents({
  initialOrder = "",
  initialNotifications,
  readOnly = false,
  canApproveScholarships = false,
  canCreateDiscountCodes = false,
  canManageEnrolments = false,
}: {
  initialOrder?: string;
  initialNotifications: AdminNotificationItem[];
  readOnly?: boolean;
  canApproveScholarships?: boolean;
  canCreateDiscountCodes?: boolean;
  canManageEnrolments?: boolean;
}) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [q, setQ] = useState(initialOrder);
  const [payment, setPayment] = useState("");
  const [enrolment, setEnrolment] = useState("");
  const [country, setCountry] = useState("");
  const [method, setMethod] = useState("");
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [refreshBell, setRefreshBell] = useState(0);
  const [selected, setSelected] = useState<Student | null>(null);
  const [detailStale, setDetailStale] = useState(false);
  const selectedId = selected?.id;
  // Reviewers get the full enrolment action set except refunds, which stay
  // super-admin only (readOnly === false only for the env super-admin).
  const actions =
    selected && canManageEnrolments
      ? availableActions(selected).filter((entry) => entry !== "REFUND" || !readOnly)
      : [];
  const [action, setAction] = useState<Action | "">("");
  const dialog = useRef<HTMLDialogElement>(null);
  const query = new URLSearchParams({
    q,
    payment,
    enrolment,
    country,
    method,
    page: String(page),
  }).toString();

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const snapshot = await readSnapshot(query, controller.signal);
        if (!controller.signal.aborted) {
          setData(snapshot);
          setLoadError("");
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setLoadError(
            cause instanceof Error ? cause.message : "Could not load students.",
          );
        }
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, reload]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !dialog.current?.open) {
        setReload((value) => value + 1);
        setRefreshBell((value) => value + 1);
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedId && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [selectedId]);

  function open(student: Student, nextAction: Action | "" = "") {
    setError("");
    setMessage("");
    setDetailStale(false);
    setAction(nextAction);
    setSelected(student);
  }

  async function act(event: FormEvent<HTMLFormElement>, student: Student) {
    event.preventDefault();
    if (
      !action ||
      busy ||
      detailStale ||
      !availableActions(student).includes(action)
    )
      return;
    const form = new FormData(event.currentTarget);
    const field = (name: string) =>
      String(form.get(name) || "").trim() || undefined;
    const confirmation =
      action === "REFUND" && ["STRIPE", "PAYPAL"].includes(student.method ?? "")
        ? `Issue a refund of ${field("currency")} ${field("verifiedAmount")} for ${student.user.fullName}?`
        : `${actionLabels[action]} for ${student.user.fullName}?`;
    if (["CANCEL", "REFUND"].includes(action) && !window.confirm(confirmation))
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/sirah", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: student.id,
          revision: student.revision,
          action,
          note: field("note"),
          verifiedAmount: field("verifiedAmount"),
          currency: field("currency"),
          transactionReference: field("transactionReference"),
          refundReference: field("refundReference"),
          paymentEventId: field("paymentEventId"),
          providerReference: field("providerReference"),
          verifiedTransfer: form.get("verifiedTransfer") === "on",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Action failed.");
      setRefreshBell((key) => key + 1);
      setMessage(
        result.duplicate
          ? "This payment was already recorded."
          : action === "APPROVE" &&
              (student.cancelledAt || student.enrolmentState === "CANCELLED")
            ? "Received funds recorded. The existing cancellation is preserved."
            : actionResults[action],
      );
      setAction("");
      // Fetch the open registration separately so a status change does not
      // remove its detail dialog when the list has a status filter applied.
      setReload((key) => key + 1);
      try {
        const detail = await readSnapshot(
          new URLSearchParams({ q: student.reference }).toString(),
        );
        setSelected(
          detail.rows.find((entry) => entry.id === student.id) ?? null,
        );
      } catch {
        setError(
          "Action recorded. Reopen this registration to see the updated details.",
        );
        setDetailStale(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`ga-admin-shell ${styles.shell}`}>
      <SirahAdminNav active="enrolments" readOnly={readOnly} canApproveScholarships={canApproveScholarships} canCreateDiscountCodes={canCreateDiscountCodes} />
        <div className="ga-admin-topbar-actions">
          {!readOnly && <AdminNotificationBell
            initialNotifications={initialNotifications}
            refreshKey={refreshBell}
          />}
          <button
            type="button"
            className="ga-admin-ghost-btn"
            onClick={() => {
              setReload((key) => key + 1);
              setRefreshBell((key) => key + 1);
            }}
          >
            Refresh
          </button>
        </div>

      <section className="ga-admin-workspace-card">
        <div className="ga-admin-workspace-head">
          <div>
            <p className="ga-admin-kicker">Current batch</p>
            <h2>Sīrah | Beyond Chronology enrolments</h2>
          </div>
          <div className="ga-admin-actions ga-admin-actions-inline">
            <a
              className="ga-admin-outline-btn"
              href={`/api/admin/sirah?${query}&format=csv`}
            >
              Export this page (CSV)
            </a>
            {!readOnly && <a className="ga-admin-outline-btn" href="/api/admin/sirah/legacy">
              Historical records
            </a>}
          </div>
        </div>

        {!readOnly && <SirahAdminCohort />}
        <div className={`ga-admin-filter-row ${styles.filters}`}>
          <label>
            Search students
            <input
              className="ga-admin-search"
              type="search"
              placeholder="Name, email, phone or reference"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Country
            <select
              aria-label="Country"
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All countries</option>
              {Object.entries(countries)
                .sort((a, b) => a[1].name.localeCompare(b[1].name))
                .map(([code, c]) => (
                  <option key={code} value={code}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Payment method
            <select
              aria-label="Payment method"
              value={method}
              onChange={(event) => {
                setMethod(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All payment methods</option>
              <option value="MANUAL">Manual payments (bank / JazzCash)</option>
              <option value="STRIPE">Stripe</option>
              <option value="PAYPAL">PayPal</option>
              <option value="BANK_TRANSFER">Meezan Bank transfer</option>
              <option value="JAZZCASH">JazzCash</option>
              <option value="UNSELECTED">No method selected</option>
            </select>
          </label>
          <label>
            Payment status
            <select
              aria-label="Payment status"
              value={payment}
              onChange={(event) => {
                setPayment(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All payments</option>
              {paymentStates.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Enrolment status
            <select
              aria-label="Enrolment status"
              value={enrolment}
              onChange={(event) => {
                setEnrolment(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All enrolments</option>
              {enrolmentStates.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ga-admin-outline-btn"
            onClick={() => {
              setQ("");
              setCountry("");
              setMethod("");
              setPayment("");
              setEnrolment("");
              setPage(1);
            }}
          >
            Clear filters
          </button>
        </div>
        {loadError && (
          <p className="ga-admin-error-banner" role="alert">
            {loadError}
          </p>
        )}
        {!data && !loadError && <p role="status">Loading students…</p>}
        {data && (
          <>
            <p className={styles.resultCount}>
              {data.total} registrations · Page {data.page}
            </p>
            <div className="ga-admin-data-table">
              <div className="ga-admin-table-head" aria-hidden="true">
                <span>Order</span>
                <span>Customer</span>
                <span>Amount</span>
                <span>Payment</span>
                <span>Course access</span>
                <span>Date</span>
                <span>Actions</span>
              </div>
              {data.rows.map((student) => (
                <article
                  key={student.id}
                  className={`ga-admin-table-row ${styles.row}`}
                >
                  <div>
                    <span className="ga-admin-pill">Sīrah</span>
                    <strong>{student.reference}</strong>
                    <p>Beyond Chronology</p>
                  </div>
                  <div>
                    <strong>{student.user.fullName}</strong>
                    <p>{student.user.email}</p>
                    <p>{student.phoneE164}</p>
                  </div>
                  <div>
                    <strong>
                      {formatSirahMoney(student.amountMinor, student.currency)}
                    </strong>
                    <p>{student.countryName}</p>
                  </div>
                  <div>
                    <strong>
                      {student.method
                        ? label(student.method)
                        : "No method selected"}
                    </strong>
                    <p>{label(student.plan)}</p>
                    <Status value={student.paymentState} />
                  </div>
                  <div>
                    <Status value={student.enrolmentState} />
                    {student.cancelledAt &&
                      student.enrolmentState === "ACTIVE" && (
                        <p>Cancellation scheduled</p>
                      )}
                  </div>
                  <div>
                    <strong>{date(student.createdAt)}</strong>
                  </div>
                  <div className="ga-admin-actions">
                    <button
                      type="button"
                      className="ga-admin-outline-btn"
                      onClick={() => open(student)}
                    >
                      View Details
                    </button>
                    {(readOnly ? [] : availableActions(student))
                      .filter((option) =>
                        [
                          "APPROVE",
                          "REJECT",
                          "PENDING",
                          "CANCEL",
                          "COMPLETE",
                        ].includes(option),
                      )
                      .map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={actionClass(option)}
                          onClick={() => open(student, option)}
                        >
                          {actionLabels[option]}
                        </button>
                      ))}
                  </div>
                </article>
              ))}
              {data.rows.length === 0 && (
                <p className="ga-admin-empty-state">
                  No registrations match these filters.
                </p>
              )}
            </div>
            {data.total > data.pageSize && (
              <div className={styles.pager}>
                <button
                  className="ga-admin-outline-btn"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {data.page} of {Math.ceil(data.total / data.pageSize)}
                </span>
                <button
                  className="ga-admin-outline-btn"
                  type="button"
                  disabled={page * data.pageSize >= data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {selectedId && selected && (
        <dialog
          ref={dialog}
          className="ga-admin-donation-dialog"
          aria-labelledby="sirah-student-title"
          onClose={() => setSelected(null)}
          onCancel={(event) => {
            if (busy) event.preventDefault();
          }}
          onClick={(event) => {
            if (!busy && event.target === event.currentTarget)
              dialog.current?.close();
          }}
        >
          <section className={`ga-admin-modal ${styles.modal}`}>
            <div className="ga-admin-modal-head">
              <div>
                <p className="ga-admin-kicker">Registration details</p>
                <h3 id="sirah-student-title">{selected.user.fullName}</h3>
              </div>
              <button
                type="button"
                className="ga-admin-notification-close"
                disabled={busy}
                onClick={() => dialog.current?.close()}
              >
                Close
              </button>
            </div>
            <section className="ga-admin-modal-section">
              <h4>Student information</h4>
              <div className="ga-admin-modal-grid">
                <p>
                  <strong>Email:</strong> {selected.user.email}
                </p>
                <p>
                  <strong>Phone:</strong> {selected.phoneE164}
                </p>
                <p>
                  <strong>Country:</strong> {selected.countryName}
                </p>
                <p>
                  <strong>Registered:</strong> {date(selected.createdAt)}
                </p>
                <p>
                  <strong>Reference:</strong> {selected.reference}
                </p>
                <p>
                  <strong>Batch:</strong> {selected.batchCode}
                </p>
              </div>
            </section>
            <section className="ga-admin-modal-section">
              <h4>Payment and enrolment</h4>
              <div className="ga-admin-modal-grid">
                <p>
                  <strong>Payment:</strong>{" "}
                  <Status value={selected.paymentState} />
                </p>
                <p>
                  <strong>Enrolment:</strong>{" "}
                  <Status value={selected.enrolmentState} />
                </p>
                <p>
                  <strong>Plan:</strong> {label(selected.plan)} ·{" "}
                  {selected.method
                    ? label(selected.method)
                    : "No method selected"}
                </p>
                <p>
                  <strong>Expected:</strong>{" "}
                  {formatSirahMoney(selected.amountMinor, selected.currency)}
                </p>
                <p>
                  <strong>Paid:</strong>{" "}
                  {formatSirahMoney(selected.paidMinor, selected.currency)} (
                  {selected.paidCount})
                </p>
                <p>
                  <strong>Refunded:</strong>{" "}
                  {formatSirahMoney(selected.refundedMinor, selected.currency)}
                </p>
                <p>
                  <strong>Next billing:</strong> {date(selected.nextBillingAt)}
                </p>
                <p>
                  <strong>Programme end:</strong> {date(selected.programmeEnd)}
                </p>
                {selected.cancelledAt && (
                  <p>
                    <strong>Cancellation recorded:</strong>{" "}
                    {date(selected.cancelledAt)}
                  </p>
                )}
                {selected.accessEndsAt && (
                  <p>
                    <strong>Access ends:</strong> {date(selected.accessEndsAt)}
                  </p>
                )}
                <p>
                  <strong>Pricing version:</strong> {selected.pricingVersion}
                </p>
              </div>
            </section>

            <section className="ga-admin-modal-section">
              <h4>Admin actions</h4>
              <div className="ga-admin-actions ga-admin-actions-inline">
                {actions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={actionClass(option)}
                    aria-pressed={action === option}
                    disabled={busy || detailStale}
                    onClick={() => {
                      setAction(action === option ? "" : option);
                      setError("");
                      setMessage("");
                    }}
                  >
                    {actionLabels[option]}
                  </button>
                ))}
                {!actions.length && (
                  <p>No actions available for this status.</p>
                )}
              </div>
              <form
                className={styles.form}
                onSubmit={(event) => void act(event, selected)}
              >
                {action && actions.includes(action) && (
                  <fieldset
                    key={action}
                    disabled={busy}
                    className={styles.form}
                  >
                    <legend className="sr-only">{actionLabels[action]}</legend>
                    {action === "APPROVE" && (
                      <>
                        <p>
                          Record received funds of{" "}
                          <strong>
                            {formatSirahMoney(
                              selected.amountMinor,
                              selected.currency,
                            )}
                          </strong>
                          .{" "}
                          {selected.cancelledAt ||
                          selected.enrolmentState === "CANCELLED"
                            ? "The existing cancellation is preserved."
                            : "This activates the student’s paid course access."}
                        </p>
                        <label className={styles.check}>
                          <input
                            name="verifiedTransfer"
                            type="checkbox"
                            required
                          />
                          I confirm these funds were received in the merchant
                          account.
                        </label>
                        <details>
                          <summary>Optional payment details</summary>
                          <p>
                            The saved fee and student’s receipt reference are
                            used automatically. If no transfer reference was
                            supplied, an internal review reference is recorded.
                          </p>
                          <div className={styles.amountFields}>
                            <label>
                              Received amount (optional override)
                              <input
                                name="verifiedAmount"
                                inputMode="decimal"
                                placeholder={minorToDecimal(
                                  selected.amountMinor,
                                  selected.currency,
                                )}
                              />
                            </label>
                            <label>
                              Currency (optional override)
                              <input
                                name="currency"
                                placeholder={selected.currency}
                                minLength={3}
                                maxLength={3}
                              />
                            </label>
                          </div>
                          <label>
                            Transfer transaction reference (optional)
                            <input
                              name="transactionReference"
                              maxLength={150}
                            />
                          </label>
                        </details>
                      </>
                    )}
                    {action === "REFUND" && (
                      <div className={styles.amountFields}>
                        <label>
                          Verified refund amount
                          <input
                            name="verifiedAmount"
                            inputMode="decimal"
                            required
                          />
                        </label>
                        <label>
                          Currency
                          <input
                            name="currency"
                            required
                            defaultValue={selected.currency}
                            minLength={3}
                            maxLength={3}
                          />
                        </label>
                      </div>
                    )}
                    {action === "RECONCILE_PROVIDER" && (
                      <label>
                        Provider checkout / subscription reference (optional override)
                        <input name="providerReference" maxLength={200} />
                      </label>
                    )}
                    {action === "COMPLETE" && (
                      <p>
                        Completion updates enrolment only. Use Cancel to stop
                        future billing.
                      </p>
                    )}
                    {action === "CANCEL" && (
                      <p>
                        Cancellation follows the agreed billing and access
                        terms. Refunds are handled separately.
                      </p>
                    )}
                    {action === "APPROVE" &&
                      selected.enrolmentState === "CANCELLED" && (
                        <p>
                          Record this transfer only if it settled. This does not
                          reopen the enrolment.
                        </p>
                      )}
                    {action !== "RETRY_NOTIFICATIONS" && (
                      <label>
                        {action === "REFUND" ||
                        (action === "APPROVE" &&
                          selected.enrolmentState === "CANCELLED")
                          ? "Reason / review note"
                          : "Review note (optional)"}
                        <textarea
                          name="note"
                          maxLength={1500}
                          required={
                            action === "REFUND" ||
                            (action === "APPROVE" &&
                              selected.enrolmentState === "CANCELLED")
                          }
                        />
                      </label>
                    )}
                    <button type="submit" className={actionClass(action)}>
                      {busy
                        ? "Saving…"
                        : `Confirm ${actionLabels[action].toLowerCase()}`}
                    </button>
                  </fieldset>
                )}
                {error && (
                  <p className="ga-admin-error-banner" role="alert">
                    {error}
                  </p>
                )}
                {message && (
                  <p className="ga-admin-success-banner" role="status">
                    {message}
                  </p>
                )}
              </form>
            </section>

            <div className={`ga-admin-modal-section ${styles.records}`}>
              <details>
                <summary>Receipt evidence ({selected.receipts.length})</summary>
                {selected.receipts.map((receipt) => (
                  <p key={receipt.id}>
                    <a
                      href={`/api/sirah/receipts/${receipt.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Receipt v{receipt.revision}: {receipt.filename}
                    </a>
                  </p>
                ))}
              </details>
              <details>
                <summary>Payment history ({selected.events.length})</summary>
                {selected.events.map((entry) => (
                  <p key={entry.id}>
                    {label(entry.kind)} ·{" "}
                    {formatSirahMoney(entry.amountMinor, entry.currency)} ·{" "}
                    {date(entry.createdAt)}
                    <br />
                    <code>{entry.id}</code>
                  </p>
                ))}
              </details>
              <details>
                <summary>
                  Email delivery ({selected.notifications.length})
                </summary>
                {selected.notifications.map((entry) => (
                  <p key={entry.id}>
                    {label(entry.kind)} · {label(entry.state)} ·{" "}
                    {entry.attempts} attempts
                    {entry.error ? ` · ${entry.error}` : ""}
                  </p>
                ))}
              </details>
              <details>
                <summary>Audit history ({selected.audits.length})</summary>
                {selected.audits.map((entry, index) => (
                  <div key={index}>
                    <strong>{label(entry.action)}</strong> · {entry.actor} ·{" "}
                    {date(entry.createdAt)}
                    <pre>{JSON.stringify(entry.detail, null, 2)}</pre>
                  </div>
                ))}
              </details>
            </div>
          </section>
        </dialog>
      )}
    </div>
  );
}
