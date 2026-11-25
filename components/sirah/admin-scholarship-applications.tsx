"use client";
import { useEffect, useState, type FormEvent } from "react";
import { formatSirahMoney, minorToDecimal } from "@/lib/sirah/catalog";
import { ScholarshipApplicationForm } from "./scholarship-application-form";
import styles from "./admin-scholarship-applications.module.css";

type Row = { id: string; fullName: string; email: string; phone: string; countryCode: string; courseSlug: string; batchCode: string; arrangementType: string; requestedAmountMinor: number | null; currency: string; reason: string; documentName: string | null; status: string; reviewedBy: string | null; reviewedAt: string | null; reviewNotes: string | null; approvedFeeMinor: number | null; approvedMonthlyMinor: number | null; orderId: string | null; notificationState: string | null; createdAt: string };
export function AdminScholarshipApplications({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<Row[]>([]), [status, setStatus] = useState("PENDING"), [page, setPage] = useState(1), [total, setTotal] = useState(0), [reload, setReload] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  useEffect(() => { const controller = new AbortController(); fetch(`/api/admin/sirah/scholarship-applications?status=${status}&page=${page}`, { cache: "no-store", signal: controller.signal }).then(async response => { const data = await response.json(); if (!response.ok) throw Error(data.error); setRows(data.rows); setTotal(data.total); }).catch(cause => { if (cause.name !== "AbortError") setError(cause.message); }); return () => controller.abort(); }, [status, page, reload]);
  async function action(event: FormEvent<HTMLFormElement>, row: Row, decision: "APPROVED" | "REJECTED") {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/sirah/scholarship-applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review", id: row.id, decision, notes: String(form.get("notes") || ""), fee: String(form.get("fee") || ""), monthly: String(form.get("monthly") || "") }) });
      const data = await response.json(); if (!response.ok) throw Error(data.error || "Review failed.");
      setMessage(`Application ${decision.toLowerCase()}. Email: ${data.emailState}.`); setReload(n => n + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review failed."); } finally { setBusy(false); }
  }
  async function retry(row: Row) {
    setBusy(true); setError("");
    try { const response = await fetch("/api/admin/sirah/scholarship-applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "retry-email", id: row.id }) }); const data = await response.json(); if (!response.ok) throw Error(data.error); setMessage(`Email: ${data.emailState}.`); setReload(n => n + 1); } catch (cause) { setError(cause instanceof Error ? cause.message : "Email failed."); } finally { setBusy(false); }
  }
  return <section className={`ga-admin-workspace-card ${styles.section}`}>
    <div className="ga-admin-workspace-head"><div><p className="ga-admin-kicker">Applications &amp; review</p><h1 className={styles.title}>Scholarship and reduced-fee applications</h1><p className={styles.subtitle}>New applications are reviewed here. Historical scholarship applications remain below.</p></div></div>
    {canEdit && <details className={styles.manual}><summary>Manually add an application</summary><div className={styles.manualBody}><ScholarshipApplicationForm admin onSaved={() => setReload(n => n + 1)} /></div></details>}
    <div className={styles.filters}><label>Status <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="">All</option></select></label><span>{total} applications</span></div>
    {error && <p role="alert" className="ga-admin-error-banner">{error}</p>}{message && <p role="status" className={styles.message}>{message}</p>}
    <div className={styles.cards}>{rows.map(row => <article key={row.id} className={styles.card}>
      <div className={styles.cardHeader}><div><h2>{row.fullName}</h2><p>{row.email}</p><p>{row.phone} <span aria-hidden="true">&middot;</span> {row.countryCode}</p></div><div className={styles.cardStatus}><span className={`ga-admin-status is-${row.status.toLowerCase()}`}>{row.status}</span><span>{new Date(row.createdAt).toLocaleDateString()}</span></div></div>
      <div className={styles.metadata}><div><span>Course / cohort</span><strong>{row.courseSlug} <span aria-hidden="true">&middot;</span> {row.batchCode}</strong></div><div><span>Requested arrangement</span><strong>{row.arrangementType}{row.requestedAmountMinor !== null && ` - ${formatSirahMoney(row.requestedAmountMinor, row.currency)}${row.arrangementType === "PLAN" ? " per month" : ""}`}</strong></div></div>
      <div className={styles.reason}><span>Reason</span><p>{row.reason}</p></div>
      {row.documentName && <p className={styles.document}><a href={`/api/admin/sirah/scholarship-applications/document?id=${encodeURIComponent(row.id)}`}>Download {row.documentName}</a></p>}
      {row.status !== "PENDING" && <div className={styles.reviewed}><strong>Review</strong><p>Reviewed by {row.reviewedBy} <span aria-hidden="true">&middot;</span> {row.reviewNotes || "No review notes"}{row.approvedFeeMinor !== null && ` | Agreed total: ${formatSirahMoney(row.approvedFeeMinor, row.currency)}`}{row.approvedMonthlyMinor !== null && ` | Monthly: ${formatSirahMoney(row.approvedMonthlyMinor, row.currency)}`}</p></div>}
      <div className={styles.emailStatus}><span>Email: <strong>{row.notificationState || "Unknown"}</strong></span>{canEdit && row.notificationState !== "SENT" && <button className="ga-admin-outline-btn" type="button" disabled={busy} onClick={() => void retry(row)}>Retry email</button>}</div>
      {canEdit && row.status === "PENDING" && <form className={styles.reviewForm} onSubmit={event => void action(event, row, "APPROVED")}>
        <h3>Review application</h3><div className={styles.amounts}>
          <label>Agreed total fee ({row.currency}; 0 for full scholarship) <input name="fee" type="number" min="0" step="any" defaultValue={row.arrangementType === "FULL" ? "0" : row.arrangementType === "PARTIAL" && row.requestedAmountMinor !== null ? minorToDecimal(row.requestedAmountMinor, row.currency) : ""} required /></label>
          <label>Agreed monthly amount ({row.currency}; optional) <input name="monthly" type="number" min="0" step="any" defaultValue={row.arrangementType === "PLAN" && row.requestedAmountMinor !== null ? minorToDecimal(row.requestedAmountMinor, row.currency) : ""} /></label>
        </div><label>Review notes <textarea name="notes" maxLength={2000} /></label>
        <p className={styles.hint}>Approval activates course access and sets the ledger fee. For a payment plan, enter the agreed monthly amount when generating each link in the student ledger.</p>
        <div className="ga-admin-actions"><button className="ga-admin-primary-btn" disabled={busy}>Approve</button><button className="ga-admin-outline-btn is-danger" type="button" disabled={busy} onClick={event => { const form = event.currentTarget.form; if (form) void action({ preventDefault() {}, currentTarget: form } as FormEvent<HTMLFormElement>, row, "REJECTED"); }}>Disapprove</button></div>
      </form>}
    </article>)}</div>
    {rows.length === 0 && <p className="ga-admin-empty-state">No applications found.</p>}
    <div className={`ga-admin-actions ${styles.pagination}`}><button className="ga-admin-outline-btn" disabled={page <= 1} onClick={() => setPage(n => n - 1)}>Previous</button><span>Page {page} | {total} applications</span><button className="ga-admin-outline-btn" disabled={page * 50 >= total} onClick={() => setPage(n => n + 1)}>Next</button></div>
  </section>;
}
