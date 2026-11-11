"use client";
import { useState, type FormEvent } from "react";
import styles from "./admin-students.module.css";

/** Admin-only tool: create a PK monthly manual-payment discount code. The code
 * is stored as a hash; the plaintext is shown once here to share with students. */
export function SirahAdminDiscount() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ code: string; message: string } | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rupees = Number(form.get("amountPkr"));
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setError("Enter the discounted monthly fee in PKR.");
      return;
    }
    const maxRaw = Number(form.get("maxRedemptions"));
    setBusy(true);
    setError("");
    setCreated(null);
    try {
      const response = await fetch("/api/admin/sirah/discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: String(form.get("code") || "").trim() || undefined,
          amountMinor: Math.round(rupees * 100),
          email: String(form.get("email") || "").trim() || undefined,
          maxRedemptions:
            Number.isFinite(maxRaw) && maxRaw >= 1 ? Math.floor(maxRaw) : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Could not create the code.");
      setCreated({ code: result.code, message: result.message });
      event.currentTarget.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className={styles.filters}>
      <summary>Create a discount code</summary>
      <form className="ga-admin-filter-row" onSubmit={create} aria-busy={busy}>
        <label>
          Code (optional — blank generates one)
          <input name="code" maxLength={64} autoComplete="off" placeholder="SIRAH-XXXX-XXXX" />
        </label>
        <label>
          Discounted monthly fee (PKR)
          <input name="amountPkr" type="number" min="1" step="1" required placeholder="3000" />
        </label>
        <label>
          Lock to email (optional)
          <input name="email" type="email" maxLength={254} autoComplete="off" placeholder="student@example.com" />
        </label>
        <label>
          Max redemptions
          <input name="maxRedemptions" type="number" min="1" step="1" defaultValue={1} />
        </label>
        <button className="ga-admin-outline-btn" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create code"}
        </button>
      </form>
      <p>
        PK monthly manual payments only. Blank email = redeemable by any student
        up to the redemption limit (then it stops working). Set an email to lock
        it to one person.
      </p>
      {created && (
        <p role="status">
          <strong>{created.message}</strong> Share this code: <code>{created.code}</code>
          <br />
          It is stored hashed and will not be shown again.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
