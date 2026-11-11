"use client";
import { useState, type FormEvent } from "react";
import { SirahAdminNav } from "./admin-nav";

/** Admin tab: create a PK monthly manual-payment discount code. The code is
 * stored as a hash; the plaintext is shown once here to share with students. */
export function SirahAdminDiscount({
  readOnly,
  canApproveScholarships = false,
  canCreateDiscountCodes = false,
}: {
  readOnly: boolean;
  canApproveScholarships?: boolean;
  canCreateDiscountCodes?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ code: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

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
    setCopied(false);
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

  async function copyCode() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="ga-admin-shell">
      <SirahAdminNav
        active="discounts"
        readOnly={readOnly}
        canApproveScholarships={canApproveScholarships}
        canCreateDiscountCodes={canCreateDiscountCodes}
      />
      <section className="ga-admin-workspace-card">
        <div className="ga-admin-workspace-head">
          <div>
            <p className="ga-admin-kicker">Current batch</p>
            <h2>Discount codes</h2>
            <p>Create a Pakistan monthly manual-payment discount code to share with a student.</p>
          </div>
        </div>

        <form className="ga-admin-filter-row" onSubmit={create} aria-busy={busy}>
          <label>
            <span className="ga-admin-label">Code (optional — blank auto-generates)</span>
            <input className="ga-admin-search" name="code" maxLength={64} autoComplete="off" placeholder="SIRAH-PK-3000-AZ7Q" />
          </label>
          <label>
            <span className="ga-admin-label">Discounted monthly fee (PKR)</span>
            <input className="ga-admin-search" name="amountPkr" type="number" min="1" step="1" required placeholder="3000" />
          </label>
          <label>
            <span className="ga-admin-label">Lock to email (optional)</span>
            <input className="ga-admin-search" name="email" type="email" maxLength={254} autoComplete="off" placeholder="student@example.com" />
          </label>
          <label>
            <span className="ga-admin-label">Max redemptions</span>
            <input className="ga-admin-search" name="maxRedemptions" type="number" min="1" step="1" defaultValue={1} />
          </label>
          <div className="ga-admin-actions">
            <button className="ga-admin-primary-btn" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create code"}
            </button>
          </div>
        </form>

        <p className="ga-admin-workspace-head" style={{ marginTop: "1rem" }}>
          PK monthly manual payments only (JazzCash / Meezan Bank). A blank email
          makes the code redeemable by any student up to the redemption limit,
          then it stops working. Set an email to lock it to one person.
        </p>

        {created && (
          <div className="ga-admin-row" role="status" style={{ marginTop: "1rem" }}>
            <strong>{created.message}</strong>
            <div className="ga-admin-actions" style={{ alignItems: "center", gap: "0.75rem" }}>
              <code style={{ fontSize: "1.1rem", letterSpacing: "0.04em" }}>{created.code}</code>
              <button type="button" className="ga-admin-outline-btn" onClick={copyCode}>
                {copied ? "Copied" : "Copy code"}
              </button>
            </div>
            <span className="ga-admin-tag">Stored hashed — it will not be shown again.</span>
          </div>
        )}
        {error && (
          <p className="ga-admin-row" role="alert" style={{ marginTop: "1rem" }}>
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
