"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { confirmDialog } from "@/components/confirm-dialog";
import { countries } from "countries-list";
import AdminNotificationBell from "@/components/admin/admin-notification-bell";
import type { AdminNotificationItem } from "@/services/admin.service";
import type { listSirahAdmin } from "@/services/sirah-admin.service";
import { formatSirahMoney, minorToDecimal } from "@/lib/sirah/catalog";
import { canRecoverSirahManualPayment } from "@/lib/sirah/manual-review";
import {
  sirahDisplayPaymentState,
  sirahNetReceivedMinor,
  sirahPendingRefundMinor,
} from "@/lib/sirah/refund-display";
import { AdminLedger } from "./admin-ledger";
import { AdminAddRegistration } from "./admin-add-registration";
import { AdminOverduePlans } from "./admin-overdue-plans";
import { displayAgreedFee } from "@/lib/sirah/admin-agreed-fee";
import { RowMenu, type RowMenuItem } from "./admin-row-menu";
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

type RecordAction = "EXCLUDE" | "INCLUDE" | "ARCHIVE" | "RESTORE";
const recordActionTitles: Record<RecordAction, string> = {
  EXCLUDE: "Exclude this record from analytics?",
  INCLUDE: "Count this record in analytics again?",
  ARCHIVE: "Delete this record?",
  RESTORE: "Restore this record?",
};
const recordActionButtons: Record<RecordAction, string> = {
  EXCLUDE: "Exclude from analytics",
  INCLUDE: "Un-exclude",
  ARCHIVE: "Delete (move to archive)",
  RESTORE: "Restore",
};
const recordActionDone: Record<RecordAction, string> = {
  EXCLUDE: "excluded from analytics",
  INCLUDE: "included in analytics again",
  ARCHIVE: "moved to the archive. It can be restored for 7 days",
  RESTORE: "restored from the archive",
};
const DAY_MS = 24 * 60 * 60 * 1000;
/** Archive view: days left before the maintenance job deletes it for good. */
function purgeLabel(purgeAt: Date | string) {
  const days = Math.ceil((new Date(purgeAt).getTime() - Date.now()) / DAY_MS);
  return days > 0
    ? `${days} ${days === 1 ? "day" : "days"} left before permanent deletion`
    : "Due for permanent deletion at the next maintenance run";
}

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
    review || canRecoverSirahManualPayment(student) ||
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
    student.paidMinor > student.refundedMinor + sirahPendingRefundMinor(student) &&
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

/** One colour language for every status pill (list and details):
 * Active green; Completed (paid, or course completed) teal; refunded,
 * cancelled, failed or rejected muted red; partially refunded its own
 * neutral; everything still in progress (pending, awaiting review,
 * processing, pending payment, refund pending) amber. Display only. */
function statusTone(value: string) {
  if (value === "ACTIVE") return "active";
  if (value === "PAID" || value === "COMPLETED") return "done";
  if (["CANCELLED", "FAILED", "REJECTED", "REFUNDED"].includes(value)) return "cancelled";
  if (value === "PARTIALLY_REFUNDED") return "partially-refunded";
  return "pending";
}

function Status({ value }: { value: string }) {
  return <span className={`ga-admin-status is-${statusTone(value)}`}>{label(value)}</span>;
}

/** Payment status pill. A PAID order with a verified partial refund reads
 * "Partially refunded" (not the green "Completed"); display only. */
function PaymentStatus({ order }: { order: Student }) {
  const state = sirahDisplayPaymentState(order);
  return <>{order.hasMonthlyPlan && state === "PAID" ? <span className="ga-admin-status is-done">Payment received</span> : <Status value={state} />}{sirahPendingRefundMinor(order) > 0 && <> <Status value="REFUND_PENDING" /></>}</>;
}

/** Short inline labels for the row's one primary action (the menu keeps the
 * full wording; the full label is the button's tooltip). */
const inlineLabels: Record<string, string> = {
  APPROVE: "Approve",
  RESTORE: "Restore",
};

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
  view = "students",
  initialOrder = "",
  initialGroup = "",
  initialPayment = "",
  initialNotifications,
  readOnly = false,
  canManageEnrolments = false,
  canMarkGroupAdded = false,
  canManageRecords = false,
  canExcludeRecords = false,
  initialExcluded = false,
  initialArchived = false,
}: {
  view?: "students" | "payments";
  initialOrder?: string;
  initialGroup?: "" | "ADDED" | "NOT_ADDED";
  initialPayment?: string;
  initialNotifications: AdminNotificationItem[];
  readOnly?: boolean;
  canManageEnrolments?: boolean;
  canMarkGroupAdded?: boolean;
  /** Super admin only: delete (archive) and restore junk rows, and the
   * Archive view. One record at a time, behind a confirm; never bulk. */
  canManageRecords?: boolean;
  /** Super admin or manager: exclude / un-exclude (mark as test), per row or
   * via the checkbox selection, and the Excluded view. */
  canExcludeRecords?: boolean;
  initialExcluded?: boolean;
  initialArchived?: boolean;
}) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [q, setQ] = useState(initialOrder);
  const [payment, setPayment] = useState(initialPayment);
  const [group, setGroup] = useState<string>(initialGroup);
  const [groupBusy, setGroupBusy] = useState("");
  const [enrolment, setEnrolment] = useState("");
  const [country, setCountry] = useState("");
  const [method, setMethod] = useState("");
  // From / To (YYYY-MM-DD, UTC): the date a payment or refund was recorded.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [refreshBell, setRefreshBell] = useState(0);
  const [selected, setSelected] = useState<Student | null>(null);
  const [addRegistrationOpen, setAddRegistrationOpen] = useState(false);
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
  // Record housekeeping. Per-row actions sit behind a confirm dialog: exclude /
  // un-exclude (super admin or manager), delete (archive) / restore (super
  // admin only). The checkbox selection drives ONLY exclude / un-exclude
  // through its own endpoint, which cannot archive or delete.
  const [recordsView, setRecordsView] = useState<"" | "EXCLUDED" | "ARCHIVED">(
    canManageRecords && initialArchived
      ? "ARCHIVED"
      : canExcludeRecords && initialExcluded
        ? "EXCLUDED"
        : "",
  );
  const archivedView = recordsView === "ARCHIVED";
  const [recordAction, setRecordAction] = useState<{
    kind: RecordAction;
    student: Student;
  } | null>(null);
  const [recordBusy, setRecordBusy] = useState(false);
  const [recordMessage, setRecordMessage] = useState("");
  const [recordError, setRecordError] = useState("");
  const recordDialog = useRef<HTMLDialogElement>(null);
  // Checkbox selection (ids on the current page). Exclusion only.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  // The list filters without the page number: shared by the list and the
  // students CSV export, which covers the whole filtered set. (Payments
  // received and its CSV live on the Overview page.)
  const filterQuery = new URLSearchParams({
    q,
    payment,
    enrolment,
    country,
    method,
    group,
    from,
    to,
    ...(recordsView === "ARCHIVED"
      ? { archived: "only" }
      : recordsView === "EXCLUDED"
        ? { excluded: "only" }
        : {}),
  }).toString();
  const query = `${filterQuery}&page=${page}`;

  function openRecordAction(kind: RecordAction, student: Student) {
    setRecordAction({ kind, student });
    setRecordError("");
    recordDialog.current?.showModal();
  }
  async function runRecordAction() {
    if (!recordAction) return;
    const { kind, student } = recordAction;
    setRecordBusy(true);
    setRecordError("");
    try {
      const response = await fetch("/api/admin/sirah/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: kind, orderId: student.id }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Could not update this record.");
      setRecordMessage(
        `${student.reference} ${recordActionDone[kind]}.` +
          (result.reason ? ` ${result.reason}` : ""),
      );
      recordDialog.current?.close();
      setReload((key) => key + 1);
    } catch (cause) {
      setRecordError(cause instanceof Error ? cause.message : "Could not update this record.");
    } finally {
      setRecordBusy(false);
    }
  }

  function toggleChecked(id: string, on: boolean) {
    setCheckedIds((previous) => {
      const next = new Set(previous);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  /** Bulk exclude / un-exclude for the ticked rows. The only thing the
   * selection can do: there is deliberately no archive or delete here. */
  async function runBulkExclusion(action: "EXCLUDE" | "INCLUDE") {
    const orderIds = [...checkedIds];
    if (!orderIds.length) return;
    setBulkBusy(true);
    setBulkError("");
    try {
      const response = await fetch("/api/admin/sirah/records/exclusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, orderIds }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Could not update these records.");
      const results = (result.results ?? []) as { ok: boolean; reason?: string }[];
      const done = results.filter((entry) => entry.ok).length;
      const failed = results.length - done;
      setRecordMessage(
        `${done} ${done === 1 ? "record" : "records"} ${
          action === "EXCLUDE" ? "excluded from analytics" : "included in analytics again"
        }.` + (failed ? ` ${failed} could not be updated; reload and try again.` : ""),
      );
      setCheckedIds(new Set());
      setReload((key) => key + 1);
    } catch (cause) {
      setBulkError(cause instanceof Error ? cause.message : "Could not update these records.");
    } finally {
      setBulkBusy(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const snapshot = await readSnapshot(query, controller.signal);
        if (!controller.signal.aborted) {
          setData(snapshot);
          setLoadError("");
          // Keep only ticks for rows still on this page (the list refreshes
          // every 30s and after each action) that can still be excluded.
          setCheckedIds((previous) => {
            const onPage = new Set(
              snapshot.rows.filter((row) => !row.archivedAt).map((row) => row.id),
            );
            const kept = [...previous].filter((id) => onPage.has(id));
            return kept.length === previous.size ? previous : new Set(kept);
          });
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

  async function openAddedRegistration(record: { id: string; reference: string; archived?: boolean; excluded?: boolean }, newAccount = false) {
    setAddRegistrationOpen(false);
    if (newAccount) setRecordMessage("Account created. The student can use Forgot password to set a password.");
    setQ(record.reference);
    setPage(1);
    setRecordsView(record.archived ? "ARCHIVED" : record.excluded ? "EXCLUDED" : "");
    setReload((value) => value + 1);
    try {
      const query = new URLSearchParams({ q: record.reference, ...(record.archived ? { archived: "only" } : record.excluded ? { excluded: "only" } : {}) });
      const snapshot = await readSnapshot(query.toString());
      const student = snapshot.rows.find((row) => row.id === record.id);
      if (!student) throw new Error(record.archived ? "This archived registration can only be opened by the super admin." : "Registration not found in the current view.");
      open(student);
      if (newAccount) setMessage("Account created. The student can use Forgot password to set a password.");
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Could not open the registration.");
    }
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
    if (
      ["CANCEL", "REFUND"].includes(action) &&
      !(await confirmDialog({
        title: action === "REFUND" ? "Issue this refund?" : "Cancel this enrolment?",
        message: confirmation,
        confirmLabel: action === "REFUND" ? "Issue refund" : "Cancel enrolment",
        cancelLabel: "Go back",
        tone: "danger",
      }))
    )
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
          manualMethod: field("manualMethod"),
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
          : result.refundPending ? "Refund initiated and awaiting settlement."
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

  /** Mark / unmark "added to course group". Its own endpoint, open to every
   * workspace role; it never touches payment or enrolment state. */
  /** The row's "…" menu: exactly the actions the row used to show inline,
   * with the same conditions and handlers, in the same order. */
  function rowMenuItems(student: Student): RowMenuItem[] {
    const items: RowMenuItem[] = [];
    // Managers and the super admin may approve / complete; refunds are not
    // in this row list and stay super-admin only at the endpoint.
    (!canManageEnrolments || student.archivedAt ? [] : availableActions(student))
      // "Complete course" is not offered on the row (too easy to hit by
      // mistake); it stays in View Details, which lists every action.
      .filter((option) =>
        ["APPROVE", "REJECT", "PENDING", "CANCEL"].includes(option),
      )
      .forEach((option) => {
        const tone = actionClass(option);
        items.push({
          key: option,
          label: actionLabels[option],
          tone: tone.includes("is-danger")
            ? "danger"
            : tone === "ga-admin-primary-btn"
              ? "primary"
              : "default",
          onSelect: () => open(student, option),
        });
      });
    if (student.archivedAt) {
      if (canManageRecords)
        items.push({
          key: "RESTORE",
          label: "Restore",
          tone: "primary",
          onSelect: () => openRecordAction("RESTORE", student),
        });
    } else if (canExcludeRecords) {
      items.push({
        key: student.excludedAt ? "INCLUDE" : "EXCLUDE",
        label: student.excludedAt ? "Un-exclude" : "Exclude (test)",
        onSelect: () =>
          openRecordAction(student.excludedAt ? "INCLUDE" : "EXCLUDE", student),
      });
      // Delete: per row, super admin only, behind the confirm dialog. Never
      // part of the selection.
      if (canManageRecords && !student.deleteRefusal)
        items.push({
          key: "ARCHIVE",
          label: "Delete",
          tone: "danger",
          onSelect: () => openRecordAction("ARCHIVE", student),
        });
    }
    return items;
  }

  async function toggleGroup(student: Student) {
    const added = !student.groupAddedAt;
    if (
      !added &&
      !(await confirmDialog({
        title: "Mark as not added?",
        message: `Mark ${student.user.fullName} as NOT added to the course group?`,
        confirmLabel: "Mark not added",
      }))
    )
      return;
    setGroupBusy(student.id);
    setError("");
    try {
      const response = await fetch("/api/admin/sirah/group-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: student.id, added }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Could not update group status.");
      setReload((key) => key + 1);
      if (selected?.id === student.id) {
        const detail = await readSnapshot(
          new URLSearchParams({ q: student.reference }).toString(),
        ).catch(() => null);
        const fresh = detail?.rows.find((entry) => entry.id === student.id);
        if (fresh) setSelected(fresh);
      }
    } catch (cause) {
      const text =
        cause instanceof Error ? cause.message : "Could not update group status.";
      if (selected?.id === student.id) setError(text);
      else setLoadError(text);
    } finally {
      setGroupBusy("");
    }
  }

  /** Splits the row's actions for the inbox list: the one primary action for
   * the row's state shows inline, every other action stays in the "…" menu in
   * its existing order. The primary is the row's first approve / complete /
   * restore action; failing that, "Mark added" to the course group. The group
   * toggle keeps its own condition and handler wherever it lands. */
  function rowActions(student: Student): {
    primary:
      | (RowMenuItem & { title?: string; disabled?: boolean; pressed?: boolean })
      | null;
    rest: RowMenuItem[];
  } {
    const menu = rowMenuItems(student);
    const groupItem: (RowMenuItem & { disabled?: boolean; pressed?: boolean }) | null =
      canMarkGroupAdded
        ? {
            key: "GROUP",
            label:
              groupBusy === student.id
                ? "Saving…"
                : student.groupAddedAt
                  ? "Undo: mark not added to group"
                  : "Mark added",
            disabled: groupBusy === student.id,
            pressed: !!student.groupAddedAt,
            onSelect: () => void toggleGroup(student),
          }
        : null;
    const lead = menu.find((item) => item.tone === "primary");
    if (lead) {
      return {
        primary: {
          ...lead,
          label: inlineLabels[lead.key] ?? lead.label,
          title: lead.label,
        },
        rest: [...menu.filter((item) => item !== lead), ...(groupItem ? [groupItem] : [])],
      };
    }
    if (groupItem && !student.groupAddedAt) {
      return { primary: { ...groupItem, tone: "default" }, rest: menu };
    }
    return { primary: null, rest: [...menu, ...(groupItem ? [groupItem] : [])] };
  }

  const groupCell = (student: Student) => (
    <>
      <span
        className={`ga-admin-status is-${student.groupAddedAt ? "completed" : "neutral"}`}
      >
        {student.groupAddedAt ? "Added" : "Not added"}
      </span>
      {student.groupAddedAt && (
        <p className={styles.groupMeta}>
          {date(student.groupAddedAt)}
          {student.groupAddedBy ? ` · ${student.groupAddedBy}` : ""}
        </p>
      )}
      {canMarkGroupAdded && (
        <button
          type="button"
          className={`ga-admin-ghost-btn ${styles.groupToggle}`}
          disabled={groupBusy === student.id}
          aria-pressed={!!student.groupAddedAt}
          onClick={() => toggleGroup(student)}
        >
          {groupBusy === student.id
            ? "Saving…"
            : student.groupAddedAt
              ? "Undo"
              : "Mark added"}
        </button>
      )}
    </>
  );

  return (
    <div className={`ga-admin-shell ${styles.shell}`}>
      <section className={`ga-admin-workspace-card ${styles.headCard}`}>
        <div className={`ga-admin-workspace-head ${styles.head}`}>
          <div>
            <p className="ga-admin-kicker">Current batch</p>
            <h2>
              {view === "payments"
                ? "Payments and reviews"
                : "Sīrah | Beyond Chronology enrolments"}
            </h2>
            {view === "payments" && (
              <p>
                Registrations awaiting receipt review, a provider check or a
                retried payment. Scholarship applications are reviewed under{" "}
                <a href="/admin/sirah/scholarships">Scholarship reviews</a>.
              </p>
            )}
          </div>
          <div className="ga-admin-actions ga-admin-actions-inline">
            {view === "students" && canManageEnrolments && <button type="button" className="ga-admin-primary-btn" onClick={() => setAddRegistrationOpen(true)}>Add registration</button>}
            {view === "students" && <AdminOverduePlans open={(row) => void openAddedRegistration(row)} />}
            {!readOnly && (
              <AdminNotificationBell
                initialNotifications={initialNotifications}
                refreshKey={refreshBell}
              />
            )}
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
            <a
              className="ga-admin-outline-btn"
              href={`/api/admin/sirah?${filterQuery}&format=csv`}
            >
              Export filtered (CSV)
            </a>
            {!readOnly && <a className="ga-admin-outline-btn" href="/api/admin/sirah/legacy">
              Historical records
            </a>}
          </div>
        </div>

      </section>

      <section
        className={`ga-admin-workspace-card ${styles.recordsCard}`}
        aria-label="Records"
      >
        {/* Filter bar: one even grid (labels above fields): search and the
            paid date range, then the narrowing selects, then Clear filters in
            the last cell. Same controls, same handlers as before. */}
        <div className={`ga-admin-filter-row ${styles.toolbar}`}>
          <div className={styles.filterTop}>
            <label className={styles.searchField}>
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
            <div className={styles.dateRange} role="group" aria-label="Paid between (UTC)">
              <label>
                Paid from
                <input
                  type="date"
                  aria-label="Paid from (UTC)"
                  value={from}
                  max={to || undefined}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label>
                Paid to
                <input
                  type="date"
                  aria-label="Paid to (UTC)"
                  value={to}
                  min={from || undefined}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
            </div>
          </div>
          <div className={styles.filterGrid}>
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
                <option value="CUSTOM_LINK">Admin custom payment links</option>
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
                <option value="NEEDS_ATTENTION">
                  Needs attention (review, processing, failed)
                </option>
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
            <label>
              Group status
              <select
                aria-label="Group status"
                value={group}
                onChange={(event) => {
                  setGroup(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All</option>
                <option value="NOT_ADDED">Not added</option>
                <option value="ADDED">Added</option>
              </select>
            </label>
            {canExcludeRecords && (
              <label>
                Records
                <select
                  aria-label="Records"
                  value={recordsView}
                  onChange={(event) => {
                    setRecordsView(event.target.value as "" | "EXCLUDED" | "ARCHIVED");
                    setPage(1);
                    setRecordMessage("");
                  }}
                >
                  <option value="">Counted in analytics</option>
                  <option value="EXCLUDED">Excluded (test / junk)</option>
                  {canManageRecords && (
                    <option value="ARCHIVED">Archive (deleted, restorable for 7 days)</option>
                  )}
                </select>
              </label>
            )}
          </div>
          <button
            type="button"
            className={`ga-admin-ghost-btn ${styles.clearBtn}`}
            onClick={() => {
              setQ("");
              setFrom("");
              setTo("");
              setCountry("");
              setMethod("");
              setPayment("");
              setEnrolment("");
              setGroup("");
              setRecordsView("");
              setPage(1);
            }}
          >
            Clear filters
          </button>
        </div>
        <div className={styles.listArea}>
        {loadError && (
          <p className="ga-admin-error-banner" role="alert">
            {loadError}
          </p>
        )}
        {!data && !loadError && <p className="ga-admin-loading" role="status">Loading students…</p>}
        {data && (
          <>
            <p className={styles.resultCount}>
              <strong>{data.total}</strong>{" "}
              {archivedView
                ? "archived records"
                : recordsView === "EXCLUDED"
                  ? "excluded test records"
                  : "registrations"}{" "}
              · Page{" "}
              {data.page}
            </p>
            {canExcludeRecords && recordMessage && (
              <p className={styles.recordMessage} role="status">
                {recordMessage}
              </p>
            )}
            {canExcludeRecords && !archivedView && (() => {
              // Select-all and the bulk bar drive ONLY exclude / un-exclude.
              // No delete or archive is reachable from the selection.
              const selectable = data.rows.filter((row) => !row.archivedAt);
              const allChecked =
                selectable.length > 0 &&
                selectable.every((row) => checkedIds.has(row.id));
              const someChecked = selectable.some((row) => checkedIds.has(row.id));
              return (
                <div
                  className={styles.bulkBar}
                  role="toolbar"
                  aria-label="Selected records: analytics exclusion"
                >
                  <label className={styles.bulkSelectAll}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(element) => {
                        if (element) element.indeterminate = someChecked && !allChecked;
                      }}
                      disabled={!selectable.length || bulkBusy}
                      onChange={(event) =>
                        setCheckedIds(
                          event.target.checked
                            ? new Set(selectable.map((row) => row.id))
                            : new Set(),
                        )
                      }
                    />
                    Select all on this page
                  </label>
                  <span className={styles.bulkCount}>
                    {checkedIds.size} selected
                  </span>
                  <button
                    type="button"
                    className="ga-admin-outline-btn"
                    disabled={!checkedIds.size || bulkBusy}
                    onClick={() => void runBulkExclusion("EXCLUDE")}
                  >
                    {bulkBusy ? "Saving…" : "Mark as test / exclude from analytics"}
                  </button>
                  <button
                    type="button"
                    className="ga-admin-outline-btn"
                    disabled={!checkedIds.size || bulkBusy}
                    onClick={() => void runBulkExclusion("INCLUDE")}
                  >
                    Un-exclude
                  </button>
                  {bulkError && (
                    <p className="ga-admin-error-banner" role="alert">
                      {bulkError}
                    </p>
                  )}
                </div>
              );
            })()}
            {/* Records: one white card per registration under a row of column
                labels (Order, Customer, Amount, Payment, Course access, Group,
                Date, Actions); every card uses the labels' column grid, so the
                fields line up down the list. Each cell also carries its column
                name: visually hidden while the labels show, visible on phones,
                where the card stacks. */}
            <div className={styles.dataTable} aria-label="Registrations">
              <div className={`${styles.tableGrid} ${styles.head}`} aria-hidden="true">
                <span className={styles.cOrder}>Order</span>
                <span className={styles.cCustomer}>Customer</span>
                <span className={styles.cAmount}>Agreed fee</span>
                <span className={styles.cPayment}>Payment</span>
                <span className={styles.cAccess}>Course access</span>
                <span className={styles.cGroup}>Group</span>
                <span className={styles.cDate}>Date</span>
                <span className={`${styles.cActions} ${styles.actionsHead}`}>Actions</span>
              </div>
              {data.rows.map((student) => {
                const actions = rowActions(student);
                const checked = checkedIds.has(student.id);
                // "Mark added" sits in the Group column (same item and handler
                // as before); Undo stays in the "..." menu.
                const markAdded: (RowMenuItem & { disabled?: boolean; pressed?: boolean }) | null =
                  !student.groupAddedAt
                    ? [actions.primary, ...actions.rest].find((item) => item?.key === "GROUP") ?? null
                    : null;
                const primary = actions.primary?.key === "GROUP" && markAdded ? null : actions.primary;
                const rest = markAdded ? actions.rest.filter((item) => item.key !== "GROUP") : actions.rest;
                return (
                  <article
                    key={student.id}
                    className={`${styles.tableGrid} ${styles.row}${checked ? ` ${styles.rowChecked}` : ""}`}
                  >
                    <div className={styles.cSelect}>
                      {canExcludeRecords && !student.archivedAt && (
                        <label className={styles.rowSelect}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${student.reference} for analytics exclusion`}
                            checked={checked}
                            disabled={bulkBusy}
                            onChange={(event) =>
                              toggleChecked(student.id, event.target.checked)
                            }
                          />
                        </label>
                      )}
                    </div>
                    <div className={`${styles.cOrder} ${styles.orderCell}`}>
                      <span className={styles.cellLabel}>Order</span>
                      <div className={styles.refLine}>
                        <span className={styles.ref} title={student.reference}>
                          {student.reference}
                        </span>
                      </div>
                      <p className={styles.course}>
                        <span>
                          {student.archivedAt
                            ? `Archived ${date(student.archivedAt)}`
                            : student.excludedAt
                              ? `Excluded ${date(student.excludedAt)}${student.excludedBy ? ` by ${student.excludedBy}` : ""}`
                              : "Sīrah · Beyond Chronology"}
                        </span>
                      </p>
                      {(student.archivedAt || student.excludedAt) && (
                        <p className={styles.flags}>
                          {student.archivedAt ? (
                            <span className={`ga-admin-pill ${styles.archivedPill}`}>Archived</span>
                          ) : (
                            <span className={`ga-admin-pill ${styles.excludedPill}`}>Excluded (test)</span>
                          )}
                        </p>
                      )}
                      {student.purgeAt && (
                        <p className={styles.purgeNote}>{purgeLabel(student.purgeAt)}</p>
                      )}
                    </div>
                    <div className={`${styles.cCustomer} ${styles.customerCell}`}>
                      <span className={styles.cellLabel}>Customer</span>
                      <strong>{student.user.fullName}</strong>
                      <p className={styles.email} title={student.user.email}>{student.user.email}</p>
                      <p>{student.phoneE164}</p>
                    </div>
                    <div className={styles.cAmount}>
                      <span className={styles.cellLabel}>Agreed fee</span>
                      <strong className={styles.amount}>
                        {displayAgreedFee(student)}
                      </strong>
                      <p>{student.countryName}</p>
                      {student.customLink && (
                        <p>
                          <span className="ga-admin-pill">Custom link</span>{" "}
                          Catalog{" "}
                          {formatSirahMoney(
                            student.customLink.catalogAmountMinor,
                            student.customLink.catalogCurrency,
                          )}
                          {student.customLink.sponsorLabel
                            ? ` · ${student.customLink.sponsorLabel}`
                            : ""}
                        </p>
                      )}
                    </div>
                    <div className={`${styles.cPayment} ${styles.pillCell}`}>
                      <span className={styles.cellLabel}>Payment</span>
                      <strong className={styles.method}>
                        {student.method ? label(student.method) : "No method selected"}
                      </strong>
                      <p className={styles.plan}>{student.hasMonthlyPlan ? "Monthly plan" : "No monthly plan"}</p>
                      <PaymentStatus order={student} />
                    </div>
                    <div className={`${styles.cAccess} ${styles.pillCell}`}>
                      <span className={styles.cellLabel}>Course access</span>
                      <Status value={student.enrolmentState} />
                      {student.cancelledAt &&
                        student.enrolmentState === "ACTIVE" && (
                          <p>Cancellation scheduled</p>
                        )}
                    </div>
                    <div className={`${styles.cGroup} ${styles.pillCell}`}>
                      <span className={styles.cellLabel}>Group</span>
                      <span
                        className={`ga-admin-status is-${student.groupAddedAt ? "completed" : "neutral"}`}
                      >
                        {student.groupAddedAt ? "Added" : "Not added"}
                      </span>
                      {student.groupAddedAt && (
                        <p>
                          {date(student.groupAddedAt)}
                          {student.groupAddedBy ? ` · ${student.groupAddedBy}` : ""}
                        </p>
                      )}
                      {markAdded && (
                        <button
                          type="button"
                          className={`ga-admin-ghost-btn ${styles.markAdded}`}
                          disabled={markAdded.disabled}
                          aria-pressed={markAdded.pressed}
                          onClick={markAdded.onSelect}
                        >
                          {markAdded.label}
                        </button>
                      )}
                    </div>
                    <div className={`${styles.cDate} ${styles.dateCell}`}>
                      <span className={styles.cellLabel}>Date</span>
                      <time dateTime={new Date(student.createdAt).toISOString()}>
                        {date(student.createdAt)}
                      </time>
                    </div>
                    <div className={`ga-admin-actions ${styles.cActions} ${styles.actionsCell}`}>
                      <div className={styles.primarySlot}>
                      {primary && (
                        <button
                          type="button"
                          className={
                            primary.tone === "primary"
                              ? "ga-admin-primary-btn"
                              : "ga-admin-outline-btn"
                          }
                          title={primary.title}
                          disabled={primary.disabled}
                          aria-pressed={primary.pressed}
                          onClick={primary.onSelect}
                        >
                          {primary.label}
                        </button>
                      )}
                      </div>
                      <div className={styles.actionsPair}>
                        <button
                          type="button"
                          className="ga-admin-outline-btn"
                          onClick={() => open(student)}
                        >
                          View Details
                        </button>
                        <RowMenu
                          label={`More actions for ${student.reference}`}
                          items={rest}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {data.rows.length === 0 && (
              <p className="ga-admin-empty-state">
                {archivedView
                  ? "The archive is empty."
                  : recordsView === "EXCLUDED"
                    ? "No records are excluded."
                    : "No registrations match these filters."}
              </p>
            )}
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
        </div>
      </section>

      {canExcludeRecords && (
        <dialog
          ref={recordDialog}
          className="ga-admin-donation-dialog"
          aria-labelledby="sirah-record-title"
          onClose={() => setRecordAction(null)}
          onCancel={(event) => {
            if (recordBusy) event.preventDefault();
          }}
        >
          <section className={`ga-admin-modal ${styles.modal}`}>
            <div className="ga-admin-modal-head">
              <div>
                <p className="ga-admin-kicker">Record housekeeping</p>
                <h3 id="sirah-record-title">
                  {recordAction ? recordActionTitles[recordAction.kind] : ""}
                </h3>
              </div>
            </div>
            {recordAction && (
              <section className="ga-admin-modal-section">
                <p className={styles.recordSummary}>
                  <strong>{recordAction.student.reference}</strong> ·{" "}
                  {recordAction.student.user.fullName} ·{" "}
                  {recordAction.student.user.email}
                </p>
                {recordAction.kind === "EXCLUDE" && (
                  <p>
                    This record will be hidden from the Students and Payments
                    lists, the CSV export and the Overview counts. Nothing is
                    deleted, the student is not affected, and you can un-exclude
                    it from the &quot;Excluded&quot; view.
                  </p>
                )}
                {recordAction.kind === "INCLUDE" && (
                  <p>
                    This record will show in the lists, CSV export and Overview
                    counts again.
                  </p>
                )}
                {recordAction.kind === "ARCHIVE" && (
                  <p>
                    This payment-free record moves to the Archive and is hidden
                    everywhere else, including from the student. You can restore
                    it from the Archive for 7 days.{" "}
                    <strong>
                      After 7 days the maintenance job deletes it permanently.
                    </strong>{" "}
                    The student&apos;s account is kept.
                  </p>
                )}
                {recordAction.kind === "RESTORE" && (
                  <p>
                    This record returns to the Students list (and to the
                    student&apos;s dashboard) and will not be deleted.
                  </p>
                )}
                {recordError && (
                  <p className="ga-admin-error-banner" role="alert">
                    {recordError}
                  </p>
                )}
                <div className="ga-admin-actions">
                  <button
                    type="button"
                    className="ga-admin-outline-btn"
                    disabled={recordBusy}
                    onClick={() => recordDialog.current?.close()}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={
                      recordAction.kind === "ARCHIVE"
                        ? "ga-admin-outline-btn is-danger"
                        : "ga-admin-primary-btn"
                    }
                    disabled={recordBusy}
                    onClick={() => void runRecordAction()}
                  >
                    {recordBusy ? "Working…" : recordActionButtons[recordAction.kind]}
                  </button>
                </div>
              </section>
            )}
          </section>
        </dialog>
      )}
      {addRegistrationOpen && <AdminAddRegistration onClose={() => setAddRegistrationOpen(false)} onCreated={(record) => void openAddedRegistration(record, record.newAccount)} onExisting={(record) => void openAddedRegistration(record)} />}
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
                <p className={styles.agreedFee}>Current agreed fee: <strong>{displayAgreedFee(selected)}</strong></p>
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
                  <PaymentStatus order={selected} />
                </p>
                <p>
                  <strong>Enrolment:</strong>{" "}
                  <Status value={selected.enrolmentState} />
                </p>
                <p>
                  <strong>Plan:</strong> {selected.hasMonthlyPlan ? "Monthly plan" : "No monthly plan"} ·{" "}
                  {selected.method
                    ? label(selected.method)
                    : "No method selected"}
                </p>
                <p>
                  <strong>Paid:</strong>{" "}
                  {formatSirahMoney(selected.paidMinor, selected.currency)} (
                  {selected.paidCount})
                </p>
                <p>
                  <strong>Refunded:</strong>{" "}
                  {formatSirahMoney(selected.refundedMinor + sirahPendingRefundMinor(selected), selected.currency)}
                  {sirahPendingRefundMinor(selected) > 0 && <> (refund pending: {formatSirahMoney(sirahPendingRefundMinor(selected), selected.currency)})</>}
                </p>
                <p>
                  <strong>Net received:</strong>{" "}
                  {formatSirahMoney(sirahNetReceivedMinor(selected), selected.currency)}
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
                <div className={styles.groupDetail}>
                  <strong>Course group:</strong> {groupCell(selected)}
                </div>
                {selected.customLink && (
                  <>
                    <p>
                      <strong>Source:</strong> Admin custom payment link
                    </p>
                    <p>
                      <strong>Catalog price:</strong>{" "}
                      {formatSirahMoney(
                        selected.customLink.catalogAmountMinor,
                        selected.customLink.catalogCurrency,
                      )}{" "}
                      · <strong>Original custom link price:</strong>{" "}
                      {formatSirahMoney(
                        selected.customLink.amountMinor,
                        selected.currency,
                      )}
                    </p>
                    {selected.customLink.sponsorLabel && (
                      <p>
                        <strong>Sponsor:</strong>{" "}
                        {selected.customLink.sponsorLabel}
                      </p>
                    )}
                    <p>
                      <strong>Link created by:</strong>{" "}
                      {selected.customLink.createdBy} ·{" "}
                      {date(selected.customLink.createdAt)}
                    </p>
                  </>
                )}
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
                        {!selected.method && (
                          <label>Verified payment method
                            <select name="manualMethod" required defaultValue="">
                              <option value="" disabled>Select the account that received the funds</option>
                              <option value="BANK_TRANSFER">Meezan Bank transfer</option>
                              <option value="JAZZCASH">JazzCash</option>
                            </select>
                          </label>
                        )}
                        {canRecoverSirahManualPayment(selected) && <p>No uploaded receipt is required for this staff review. Record how you checked the received funds in the review note below.</p>}
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
                          (selected.enrolmentState === "CANCELLED" || canRecoverSirahManualPayment(selected)))
                          ? "Reason / review note"
                          : "Review note (optional)"}
                        <textarea
                          name="note"
                          maxLength={1500}
                          required={
                            action === "REFUND" ||
                            (action === "APPROVE" &&
                              (selected.enrolmentState === "CANCELLED" || canRecoverSirahManualPayment(selected)))
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
              <AdminLedger key={selected.id} id={selected.id} canEdit={canManageEnrolments} canRemovePayment={canManageRecords} onPaymentRemoved={() => {
                const { id, reference } = selected;
                setReload((current) => current + 1);
                void readSnapshot(new URLSearchParams({ q: reference }).toString()).then((detail) => {
                  const fresh = detail.rows.find((entry) => entry.id === id);
                  if (fresh) setSelected((current) => current?.id === id ? fresh : current);
                }).catch(() => {});
              }} onPlanSaved={() => {
                const id = selected.id;
                setSelected((current) => current?.id === id ? { ...current, hasMonthlyPlan: true } : current);
                setData((current) => current ? { ...current, rows: current.rows.map((row) => row.id === id ? { ...row, hasMonthlyPlan: true } : row) } : current);
                setReload((current) => current + 1);
              }} onFeeSaved={(fee) => {
                const id = selected.id;
                setSelected((current) => current?.id === id ? { ...current, ...fee } : current);
                setData((current) => current ? { ...current, rows: current.rows.map((row) => row.id === id ? { ...row, ...fee } : row) } : current);
                setReload((current) => current + 1);
              }} />
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
