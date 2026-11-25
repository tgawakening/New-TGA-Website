"use client";
import { useEffect, useState, type FormEvent } from "react";
import { formatSirahMoney, minorToDecimal } from "@/lib/sirah/catalog";
import { ScholarshipApplicationForm } from "./scholarship-application-form";

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
  return <section className="ga-admin-workspace-card" style={{ marginBottom: "2rem" }}>
    <h1>Scholarship and reduced-fee applications</h1><p>New applications are reviewed here. Historical scholarship applications remain below.</p>
    {canEdit && <details><summary>Manually add an application</summary><ScholarshipApplicationForm admin onSaved={() => setReload(n => n + 1)} /></details>}
    <label>Status <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="">All</option></select></label>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {rows.map(row => <article key={row.id} style={{ borderTop: "1px solid #ccd2d8", marginTop: "1rem", paddingTop: "1rem" }}>
      <h2>{row.fullName} - {row.status}</h2><p>{row.email} | {row.phone} | {row.countryCode}</p>
      <p>{row.courseSlug} | {row.batchCode} | {new Date(row.createdAt).toLocaleDateString()}</p>
      <p>Requested: {row.arrangementType}{row.requestedAmountMinor !== null && ` - ${formatSirahMoney(row.requestedAmountMinor, row.currency)}${row.arrangementType === "PLAN" ? " per month" : ""}`}</p>
      <p>Reason: {row.reason}</p>{row.documentName && <p><a href={`/api/admin/sirah/scholarship-applications/document?id=${encodeURIComponent(row.id)}`}>Download {row.documentName}</a></p>}
      {row.status !== "PENDING" && <p>Reviewed by {row.reviewedBy} | {row.reviewNotes || "No review notes"}{row.approvedFeeMinor !== null && ` | Agreed total: ${formatSirahMoney(row.approvedFeeMinor, row.currency)}`}{row.approvedMonthlyMinor !== null && ` | Monthly: ${formatSirahMoney(row.approvedMonthlyMinor, row.currency)}`}</p>}
      <p>Email: {row.notificationState || "Unknown"} {canEdit && row.notificationState !== "SENT" && <button type="button" disabled={busy} onClick={() => void retry(row)}>Retry email</button>}</p>
      {canEdit && row.status === "PENDING" && <form onSubmit={event => void action(event, row, "APPROVED")}>
        <label>Agreed total fee ({row.currency}; 0 for full scholarship) <input name="fee" type="number" min="0" step="any" defaultValue={row.arrangementType === "FULL" ? "0" : row.arrangementType === "PARTIAL" && row.requestedAmountMinor !== null ? minorToDecimal(row.requestedAmountMinor, row.currency) : ""} required /></label>{" "}
        <label>Agreed monthly amount ({row.currency}; optional) <input name="monthly" type="number" min="0" step="any" defaultValue={row.arrangementType === "PLAN" && row.requestedAmountMinor !== null ? minorToDecimal(row.requestedAmountMinor, row.currency) : ""} /></label>{" "}
        <label>Review notes <textarea name="notes" maxLength={2000} /></label>
        <p>Approval activates course access and sets the ledger fee. For a payment plan, enter the agreed monthly amount when generating each link in the student ledger.</p>
        <button disabled={busy}>Approve</button>{" "}<button type="button" disabled={busy} onClick={event => { const form = event.currentTarget.form; if (form) void action({ preventDefault() {}, currentTarget: form } as FormEvent<HTMLFormElement>, row, "REJECTED"); }}>Disapprove</button>
      </form>}
    </article>)}
    {rows.length === 0 && <p>No applications found.</p>}
    <div><button disabled={page <= 1} onClick={() => setPage(n => n - 1)}>Previous</button> Page {page} | {total} applications <button disabled={page * 50 >= total} onClick={() => setPage(n => n + 1)}>Next</button></div>
  </section>;
}
