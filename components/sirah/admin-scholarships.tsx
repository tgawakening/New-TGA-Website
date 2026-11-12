"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { scholarshipQuestions, SIRAH_SCHOLARSHIP_LIMIT } from "@/lib/sirah/scholarship";
import type { listSirahScholarships } from "@/services/sirah-scholarship-admin.service";
import styles from "./admin-scholarships.module.css";

type Snapshot = Awaited<ReturnType<typeof listSirahScholarships>>;
const labels: Record<string, string> = {
  fullName: "Applicant name", email: "Email", whatsapp: "WhatsApp", age: "Age", cityCountry: "City / country", occupation: "Occupation", knowledgeLevel: "Prior Sīrah knowledge", previousSeerahStudy: "Previous Sīrah study", currentInvolvement: "Current community involvement", whatDrawsYou: "Why this course", howItBenefits: "Expected benefit", mostInterestingTopic: "Topic of interest", whyThisTopic: "Why this topic", canAttendRegularly: "Attendance commitment", attendedOrientation: "Attended orientation", howHeard: "How they heard about TGA", adabCommitment: "Learning conduct commitment", genuineFinancialNeed: "Financial need confirmed", reviewNote: "Review note", ...scholarshipQuestions,
  arabicLevel: "Arabic level", skillsStatus: "Current skills / learning pathway", skillsLearningCommitment: "Commitment to learn useful skills", weeklyHours: "Hours available each week", missionCommitment: "Commitment to the mission", selectionAcknowledgement: "Understands selection is not guaranteed",
};
function answer(value: unknown) { return value === null || value === undefined || value === "" ? "Not provided" : typeof value === "boolean" ? value ? "Yes" : "No" : String(value); }

export function SirahAdminScholarships({ readOnly, canApproveScholarships = false }: { readOnly: boolean; canApproveScholarships?: boolean }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Snapshot["rows"][number] | null>(null);
  const [note, setNote] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (selected) dialog.current?.showModal(); }, [selected]);
  function closeReview() { dialog.current?.close(); setSelected(null); }
  async function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canApproveScholarships || busy) return;
    setBusy(true); setReviewError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/sirah/scholarships", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: selected.id, approve: true, note }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Scholarship could not be approved.");
      setMessage(selected.contribution.contributionPreference === "FULL_SCHOLARSHIP" ? "Scholarship approved. The student's scholarship access is active." : "Application approved. Contribution payments still require the main administrator's verification before access is activated.");
      closeReview(); setReload(n => n + 1);
    } catch (cause) { setReviewError(cause instanceof Error ? cause.message : "Approval failed. Please refresh and check the application status before trying again."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setError("");
      setData(null);
      const query = new URLSearchParams({ q, status, page: String(page) });
      void fetch(`/api/admin/sirah/scholarships?${query}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
        const result = await response.json();
        if (!response.ok) throw Error(result.error || "Could not load scholarships.");
        setData(result);
      }).catch(cause => { if (cause.name !== "AbortError") setError(cause.message); });
    }, 200);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [q, status, page, reload]);
  return <div className="ga-admin-shell">
    <section className="ga-admin-workspace-card">
      <div className="ga-admin-workspace-head"><div><p className="ga-admin-kicker">Batch 4</p><h1 className={styles.title}>Sīrah scholarship applications</h1><p>{data ? `${data.total} matching applications · ${data.approved} of ${SIRAH_SCHOLARSHIP_LIMIT} places awarded` : "Loading applications…"}</p></div><div className="ga-admin-actions"><button className="ga-admin-outline-btn" onClick={() => setReload(n => n + 1)}>Refresh</button>{!readOnly && <a className="ga-admin-outline-btn" href="/admin?workspace=overview&tab=scholarships">Review scholarship decisions</a>}</div></div>
      <div className={styles.filters}>
        <label>Search applicants<input className="ga-admin-search" type="search" placeholder="Name, email or WhatsApp" value={q} onChange={event => { setQ(event.target.value); setPage(1); }} /></label>
        <label>Application status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></label>
      </div>
      {error && <p role="alert" className="ga-admin-error-banner">{error}</p>}
      {message && <p role="status">{message}</p>}
      {data && <div className={styles.cards}>{data.rows.map(row => <article key={row.id} className={styles.card}>
        <div className={styles.summary}><div><h2>{row.fullName}</h2><p>{row.email}</p><p>{row.whatsapp} · {row.cityCountry}</p></div><div><span className="ga-admin-pill">{row.status}</span><p>{new Date(row.createdAt).toLocaleDateString("en-GB")}</p><p>{row.contribution.contributionLabel} · {row.contribution.amountLabel}</p></div></div>
        <details><summary>View application and answers</summary><dl className={styles.answers}>
          {Object.entries(labels).filter(([key]) => key in row && key !== "reviewNote").map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{answer(row[key as keyof typeof row])}</dd></div>)}
          <div><dt>Reason for scholarship</dt><dd>{row.contribution.applicationReason}</dd></div>
          {Object.entries({ "Contribution": row.contribution.contributionLabel, "Payment method": row.receipt?.method === "JAZZCASH" ? "JazzCash" : row.contribution.paymentLabel, "Amount": row.contribution.amountLabel, "Sender name": row.contribution.senderName, "Sender number": row.contribution.senderNumber, "Transfer reference": row.contribution.referenceKey, "Payment notes": row.contribution.manualNotes }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{answer(value)}</dd></div>)}
          {row.scholarshipDetails && typeof row.scholarshipDetails === "object" && !Array.isArray(row.scholarshipDetails) && Object.entries(row.scholarshipDetails).map(([key, value]) => <div key={key}><dt>{labels[key] || key}</dt><dd>{answer(value)}</dd></div>)}
          <div><dt>Review note</dt><dd>{answer(row.reviewNote)}</dd></div>
          <div><dt>Approved by</dt><dd>{answer(row.reviewedBy)}</dd></div>
          <div><dt>Manual payment evidence</dt><dd>{row.receipt ? <a href={`/api/admin/fee-waiver/${row.id}/receipt`} target="_blank" rel="noreferrer">View {row.receipt.method === "JAZZCASH" ? "JazzCash" : "Meezan Bank"} receipt: {row.receipt.filename}</a> : "No manual receipt attached"}</dd></div>
        </dl></details>
        {canApproveScholarships && row.status === "PENDING" && <div className="ga-admin-actions" style={{ marginTop: "1rem" }}><button type="button" className="ga-admin-primary-btn" disabled={busy || data.approved >= SIRAH_SCHOLARSHIP_LIMIT} onClick={() => { setNote(""); setReviewError(""); setSelected(row); }}>Approve scholarship</button>{data.approved >= SIRAH_SCHOLARSHIP_LIMIT && <p>All ten scholarship places have been awarded.</p>}</div>}
      </article>)}{data.rows.length === 0 && <p className="ga-admin-empty-state">No scholarship applications match these filters.</p>}</div>}
      {data && data.total > data.pageSize && <div className="ga-admin-actions"><button className="ga-admin-outline-btn" disabled={page <= 1} onClick={() => setPage(n => n - 1)}>Previous</button><span>Page {page} of {Math.ceil(data.total / data.pageSize)}</span><button className="ga-admin-outline-btn" disabled={page * data.pageSize >= data.total} onClick={() => setPage(n => n + 1)}>Next</button></div>}
    </section>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="scholarship-approval-title" onCancel={event => { if (busy) event.preventDefault(); else setSelected(null); }}>
      <form onSubmit={approve}>
        <h2 id="scholarship-approval-title">Approve this scholarship?</h2>
        <p><strong>{selected?.fullName}</strong><br />{selected?.email}</p>
        <p>{selected?.contribution.contributionLabel} · {selected?.contribution.amountLabel}</p>
        <p>{selected?.contribution.contributionPreference === "FULL_SCHOLARSHIP" ? "Confirm only after reviewing the application. Approval grants scholarship access and uses one of the ten Batch 4 places." : "This approves the application only. Contribution payments remain pending until the main administrator verifies payment."}</p>
        <label>Review note (optional)<textarea value={note} maxLength={500} onChange={event => setNote(event.target.value)} disabled={busy} /></label>
        {reviewError && <p role="alert" className="ga-admin-error-banner">{reviewError}</p>}
        <div className="ga-admin-actions"><button type="button" className="ga-admin-outline-btn" disabled={busy} onClick={closeReview}>Cancel</button><button type="submit" className="ga-admin-primary-btn" disabled={busy}>{busy ? "Approving…" : "Confirm scholarship approval"}</button></div>
      </form>
    </dialog>
  </div>;
}
