"use client";
import { useState, type FormEvent } from "react";
import styles from "./admin-ledger.module.css";
import { DirectUpload } from "./uploads/direct-upload";

/** Staff attach a receipt the student sent by WhatsApp or email (super admin or manager). */
export function AdminReceiptUpload({ id, onUploaded }: { id: string; onUploaded?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  // A fresh upload control after each attach, so the previous file is cleared.
  const [round, setRound] = useState(0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form);
    setBusy(true); setError(""); setDone("");
    try {
      const response = await fetch("/api/admin/sirah/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, uploadToken: values.get("uploadToken"), note: values.get("note") || undefined }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to attach the receipt.");
      form.reset(); setRound((current) => current + 1);
      setDone(`Receipt attached as evidence version ${result.revision}.`);
      onUploaded?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to attach the receipt."); } finally { setBusy(false); }
  }
  return (
    <form className={styles.agreementForm} onSubmit={(event) => void submit(event)}>
      <h5>Upload receipt for student</h5>
      <p className={styles.hint}>For a receipt the student sent by WhatsApp or email. PNG, JPG or PDF. It is recorded as staff-uploaded and does not change the payment status.</p>
      <DirectUpload key={round} purpose="admin-evidence" scope={id} required />
      <label>Note <input name="note" maxLength={500} placeholder="e.g. Received on WhatsApp" /></label>{" "}
      <button disabled={busy}>{busy ? "Attaching…" : "Attach receipt"}</button>
      {error && <p role="alert">{error}</p>}
      {done && <p role="status">{done}</p>}
    </form>
  );
}
