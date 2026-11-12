"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type DiscountRow = {
  id: string;
  code: string | null;
  amountMinor: number;
  currency: string;
  binding: string;
  redeemedCount: number;
  maxRedemptions: number;
  status: "Active" | "Used up" | "Deactivated";
  createdAt: string;
};

const statusClass: Record<DiscountRow["status"], string> = {
  Active: "is-succeeded",
  "Used up": "is-under_review",
  Deactivated: "is-cancelled",
};

function formatAmount(row: DiscountRow) {
  return `${row.currency} ${(row.amountMinor / 100).toLocaleString("en-US")}`;
}

/** Admin tab: create and manage PK monthly manual-payment discount codes. The
 * code is stored as a hash for validation; the shareable plaintext is kept in
 * codePlain so the team can see and reshare it. */
export function SirahAdminDiscount() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ code: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [rows, setRows] = useState<DiscountRow[] | null>(null);
  const [listError, setListError] = useState("");
  const [pendingId, setPendingId] = useState("");

  // Match the light admin theme (page body #17324d, kicker/label #3d668f);
  // the shared ga-admin-label/-tag/-row strong rules were authored for the
  // dark card and render too faint on the light workspace card.
  const labelStyle = { color: "#3d668f" };

  const loadCodes = useCallback(async () => {
    setListError("");
    try {
      const response = await fetch("/api/admin/sirah/discount", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Could not load discount codes.");
      setRows(result.rows as DiscountRow[]);
    } catch (cause) {
      setListError(cause instanceof Error ? cause.message : "Could not load discount codes.");
    }
  }, []);

  useEffect(() => {
    void loadCodes();
  }, [loadCodes]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rupees = Number(form.get("amountPkr"));
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setError("Enter the discounted monthly fee in PKR.");
      return;
    }
    const maxRaw = Number(form.get("maxRedemptions"));
    const formEl = event.currentTarget;
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
      formEl.reset();
      void loadCodes();
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

  async function deactivate(row: DiscountRow) {
    const label = row.code || "this code";
    if (!window.confirm(`Deactivate ${label}? Students will no longer be able to redeem it.`)) return;
    setPendingId(row.id);
    setListError("");
    try {
      const response = await fetch("/api/admin/sirah/discount", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, deactivate: true }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Could not deactivate the code.");
      await loadCodes();
    } catch (cause) {
      setListError(cause instanceof Error ? cause.message : "Could not deactivate the code.");
    } finally {
      setPendingId("");
    }
  }

  return (
    <div className="ga-admin-shell">
      <section className="ga-admin-workspace-card">
        <div className="ga-admin-workspace-head">
          <div>
            <p className="ga-admin-kicker">Current batch</p>
            <h2>Discount codes</h2>
            <p>Create a Pakistan monthly manual-payment discount code to share with a student.</p>
          </div>
        </div>

        <form className="ga-admin-filter-row ga-admin-field-grid" onSubmit={create} aria-busy={busy}>
          <label>
            <span className="ga-admin-label" style={labelStyle}>Code (optional — blank auto-generates)</span>
            <input className="ga-admin-search" name="code" maxLength={64} autoComplete="off" placeholder="SIRAH-PK-3000-AZ7Q" />
          </label>
          <label>
            <span className="ga-admin-label" style={labelStyle}>Discounted monthly fee (PKR)</span>
            <input className="ga-admin-search" name="amountPkr" type="number" min="1" step="1" required placeholder="3000" />
          </label>
          <label>
            <span className="ga-admin-label" style={labelStyle}>Lock to email (optional)</span>
            <input className="ga-admin-search" name="email" type="email" maxLength={254} autoComplete="off" placeholder="student@example.com" />
          </label>
          <label>
            <span className="ga-admin-label" style={labelStyle}>Max redemptions</span>
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
          <div
            className="ga-admin-row"
            role="status"
            style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr", gap: "0.85rem", alignItems: "start" }}
          >
            <strong style={{ fontSize: "1rem", color: "#17324d" }}>{created.message}</strong>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
              <code style={{ fontSize: "1.25rem", letterSpacing: "0.06em", fontWeight: 600, wordBreak: "break-all" }}>
                {created.code}
              </code>
              <button type="button" className="ga-admin-outline-btn" onClick={copyCode}>
                {copied ? "Copied" : "Copy code"}
              </button>
            </div>
            <span className="ga-admin-tag" style={{ justifySelf: "start", color: "#17324d", background: "rgba(92, 139, 238, 0.22)" }}>
              Stored hashed — it will not be shown again.
            </span>
          </div>
        )}
        {error && (
          <p
            className="ga-admin-row"
            role="alert"
            style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr" }}
          >
            {error}
          </p>
        )}

        <div className="ga-admin-workspace-head" style={{ marginTop: "2rem" }}>
          <div>
            <p className="ga-admin-kicker">Existing codes</p>
            <h2 style={{ fontSize: "1.25rem" }}>Issued discount codes</h2>
          </div>
        </div>

        {listError && (
          <p className="ga-admin-row" role="alert" style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr" }}>
            {listError}
          </p>
        )}

        {rows === null && !listError && <p style={{ color: "#6a7f95" }}>Loading codes…</p>}

        {rows !== null && rows.length === 0 && (
          <p style={{ color: "#6a7f95" }}>No discount codes have been created yet.</p>
        )}

        {rows !== null && rows.length > 0 && (
          <div className="ga-admin-data-table">
            <div className="ga-admin-table-head ga-admin-table-head-discounts">
              <span>Code</span>
              <span>Amount</span>
              <span>Binding</span>
              <span>Redemptions</span>
              <span>Status</span>
              <span>Created</span>
              <span>Action</span>
            </div>
            {rows.map((row) => (
              <div className="ga-admin-table-row ga-admin-table-row-discounts" key={row.id}>
                <div>
                  <strong style={{ wordBreak: "break-all" }}>{row.code || "hidden"}</strong>
                </div>
                <div>{formatAmount(row)}</div>
                <div style={{ wordBreak: "break-word" }}>{row.binding}</div>
                <div>{row.redeemedCount} / {row.maxRedemptions}</div>
                <div>
                  <span className={`ga-admin-status ${statusClass[row.status]}`}>{row.status}</span>
                </div>
                <div>{new Date(row.createdAt).toLocaleDateString("en-GB")}</div>
                <div>
                  {row.status !== "Deactivated" && (
                    <button
                      type="button"
                      className="ga-admin-outline-btn"
                      onClick={() => deactivate(row)}
                      disabled={pendingId === row.id}
                    >
                      {pendingId === row.id ? "Deactivating…" : "Deactivate"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
