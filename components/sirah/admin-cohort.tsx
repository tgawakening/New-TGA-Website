"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { publicSirahCohort } from "@/services/sirah-cohort.service";
import styles from "./registration.module.css";
type Cohort = Awaited<ReturnType<typeof publicSirahCohort>>;
export function SirahAdminCohort() {
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/sirah/cohort", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw Error(result.error);
        setCohort(result);
        setDate(result.commencementDate || "");
      })
      .catch((cause) => {
        if (cause.name !== "AbortError") setError(cause.message);
      });
    return () => controller.abort();
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cohort) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/sirah/cohort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: cohort.revision,
          commencementDate: date || null,
          ownerConfirmed: form.get("ownerConfirmed") === "on",
          sourceReference:
            String(form.get("sourceReference") || "") || undefined,
          reason: String(form.get("reason") || ""),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setCohort(result);
      setMessage(
        "Cohort date saved. Payment approval flags and student payment records were not changed.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save the cohort date.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className={styles.notice}>
      <summary>
        Paid teaching commencement:{" "}
        {cohort?.commencementDate || "Pending confirmation"}
      </summary>
      <p>
        This is the first paid class, not the free orientation. Dates and the
        additional refund window use the Pakistan calendar. Existing paid
        agreements retain their recorded commencement protection; correcting a
        date must not shorten it.
      </p>
      {cohort && !cohort.schemaAvailable && (
        <p role="alert">
          Apply the additive Sīrah cohort migration before saving. Pending
          registration remains available.
        </p>
      )}
      <form onSubmit={save}>
        <label>
          First paid class date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label className={styles.check}>
          <input type="checkbox" name="ownerConfirmed" required={!!date} />
          The course owner has confirmed this paid teaching date.
        </label>
        <label>
          Owner confirmation reference
          <input
            name="sourceReference"
            required={!!date}
            minLength={3}
            maxLength={190}
          />
        </label>
        <label>
          Reason for confirming or correcting this setting
          <textarea name="reason" required minLength={10} maxLength={1000} />
        </label>
        <button type="submit" disabled={busy || !cohort?.schemaAvailable}>
          {busy ? "Saving…" : "Save confirmed cohort date"}
        </button>
      </form>
      {cohort?.courseStartFullRefundThrough && (
        <p>
          Additional full-refund protection through{" "}
          {cohort.courseStartFullRefundThrough} inclusive. Statutory rights are
          assessed separately.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
