"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type TeamRow = {
  id: string;
  email: string;
  fullName: string;
  role: "SIRAH_VIEWER" | "SIRAH_REVIEWER";
  roleLabel: string;
  status: string;
  createdAt: string;
};
type Change = "PROMOTE" | "DEMOTE" | "REVOKE";
type AccessLogRow = {
  id: string;
  actor: string;
  action: "ADD_LEAD" | "PROMOTE" | "DEMOTE" | "REVOKE";
  targetEmail: string;
  fromRole: string | null;
  toRole: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: string;
};
const roleName = (role: string | null) =>
  role === "SIRAH_REVIEWER" ? "Manager" : role === "SIRAH_VIEWER" ? "Community Lead" : role || "none";
function describeChange(row: AccessLogRow) {
  if (row.action === "ADD_LEAD")
    return row.fromRole
      ? `Re-added (${roleName(row.toRole)}, ${row.fromStatus === "ACTIVE" ? "password reset" : "access restored"})`
      : "Added as Community Lead";
  if (row.action === "PROMOTE") return "Promoted: Community Lead → Manager";
  if (row.action === "DEMOTE") return "Demoted: Manager → Community Lead";
  return `Access revoked (${roleName(row.fromRole)})`;
}

const ROLE_SUMMARY = [
  {
    role: "Super Admin",
    who: "Environment admin login",
    can: "Everything, including refunds and managing access. Cannot be demoted or revoked.",
  },
  {
    role: "Manager",
    who: "SIRAH_REVIEWER",
    can: "Approve payments, complete courses, discount codes, custom payment links, scholarships, course group.",
  },
  {
    role: "Community Lead",
    who: "SIRAH_VIEWER",
    can: "Read-only students and enrolments, CSV export, and the “added to group” toggle.",
  },
];

const confirmText: Record<Change, (row: TeamRow) => string> = {
  PROMOTE: (row) =>
    `Promote ${row.fullName} (${row.email}) to Manager? They will be able to approve payments, create discount codes and payment links.`,
  DEMOTE: (row) =>
    `Demote ${row.fullName} (${row.email}) from Manager to Community Lead? This applies immediately.`,
  REVOKE: (row) =>
    `Revoke all workspace access for ${row.fullName} (${row.email})? The account is suspended and signed out everywhere.`,
};

/** Super Admin only (the API enforces this): manage Sīrah team access. */
export function SirahAdminAccess() {
  const [rows, setRows] = useState<TeamRow[] | null>(null);
  const [changes, setChanges] = useState<AccessLogRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/sirah/access", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Could not load team accounts.");
      setRows(result.rows);
      setChanges(result.changes || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load team accounts.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function send(body: object) {
    const response = await fetch("/api/admin/sirah/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "The access change was refused.");
    return result;
  }

  async function change(row: TeamRow, action: Change) {
    if (!window.confirm(confirmText[action](row))) return;
    setPending(`${row.id}:${action}`);
    setError("");
    setNotice("");
    try {
      await send({ action, userId: row.id });
      setNotice(
        action === "PROMOTE"
          ? `${row.fullName} is now a Manager.`
          : action === "DEMOTE"
            ? `${row.fullName} is now a Community Lead.`
            : `${row.fullName}'s access was revoked and their sessions ended.`,
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The access change was refused.");
    } finally {
      setPending("");
    }
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const email = String(form.get("email") || "").trim();
    const fullName = String(form.get("fullName") || "").trim();
    if (!window.confirm(`Create a Community Lead login for ${fullName} (${email})? If the account exists, its password is replaced and access restored.`))
      return;
    setBusy(true);
    setError("");
    setNotice("");
    setIssued(null);
    setCopied(false);
    try {
      const result = await send({ action: "ADD_LEAD", email, fullName });
      setIssued({ email: result.email, password: result.password });
      formEl.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add the account.");
    } finally {
      setBusy(false);
    }
  }

  const labelStyle = { color: "#3d668f" };
  return (
    <div className="ga-admin-shell">
      <section className="ga-admin-workspace-card">
        <div className="ga-admin-workspace-head">
          <div>
            <p className="ga-admin-kicker">Super Admin only</p>
            <h2>Access and roles</h2>
            <p>Who can use the Sīrah workspace, and what each role can do.</p>
          </div>
        </div>

        <div className="ga-admin-data-table">
          {ROLE_SUMMARY.map((item) => (
            <div key={item.role} className="ga-admin-table-row" style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 1.5rem" }}>
              <div style={{ minWidth: "9rem" }}>
                <strong>{item.role}</strong>
                <p>{item.who}</p>
              </div>
              <div style={{ flex: "1 1 18rem", minWidth: 0 }}>
                <p>{item.can}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="ga-admin-workspace-head" style={{ marginTop: "2rem" }}>
          <div>
            <p className="ga-admin-kicker">Add a team member</p>
            <h2 style={{ fontSize: "1.2rem" }}>New Community Lead</h2>
            <p>New logins start as Community Lead; promote to Manager below.</p>
          </div>
        </div>
        <form className="ga-admin-filter-row ga-admin-field-grid" onSubmit={add} aria-busy={busy}>
          <label>
            <span className="ga-admin-label" style={labelStyle}>Full name</span>
            <input className="ga-admin-search" name="fullName" required minLength={2} maxLength={190} autoComplete="off" />
          </label>
          <label>
            <span className="ga-admin-label" style={labelStyle}>Login email</span>
            <input className="ga-admin-search" name="email" type="email" required maxLength={254} autoComplete="off" />
          </label>
          <div className="ga-admin-actions">
            <button className="ga-admin-primary-btn" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create login"}
            </button>
          </div>
        </form>

        {issued && (
          <div className="ga-admin-row" role="status" style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr", gap: "0.6rem" }}>
            <strong style={{ color: "#17324d" }}>Login ready for {issued.email}. Share this password privately; it is shown only once.</strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
              <code style={{ fontSize: "1rem", wordBreak: "break-all" }}>{issued.password}</code>
              <button
                type="button"
                className="ga-admin-outline-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(issued.password);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? "Copied" : "Copy password"}
              </button>
            </div>
          </div>
        )}
        {notice && <p className="ga-admin-row" role="status" style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr" }}>{notice}</p>}
        {error && <p className="ga-admin-error-banner" role="alert" style={{ marginTop: "1rem" }}>{error}</p>}

        <div className="ga-admin-workspace-head" style={{ marginTop: "2rem" }}>
          <div>
            <p className="ga-admin-kicker">Team accounts</p>
            <h2 style={{ fontSize: "1.2rem" }}>Managers and Community Leads</h2>
          </div>
        </div>
        {rows === null && !error && <p role="status">Loading team accounts…</p>}
        {rows?.length === 0 && <p className="ga-admin-empty-state">No team accounts yet.</p>}
        {rows && rows.length > 0 && (
          <div className="ga-admin-data-table">
            {rows.map((row) => {
              const active = row.status === "ACTIVE";
              return (
                <article key={row.id} className="ga-admin-table-row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem 1.25rem" }}>
                  <div style={{ flex: "1 1 14rem", minWidth: 0, overflowWrap: "anywhere" }}>
                    <strong>{row.fullName}</strong>
                    <p>{row.email}</p>
                  </div>
                  <div>
                    <span className={`ga-admin-status is-${active ? (row.role === "SIRAH_REVIEWER" ? "completed" : "pending") : "cancelled"}`}>
                      {active ? row.roleLabel : `${row.roleLabel} · revoked`}
                    </span>
                  </div>
                  <div className="ga-admin-actions ga-admin-actions-inline">
                    {active && row.role === "SIRAH_VIEWER" && (
                      <button type="button" className="ga-admin-outline-btn" disabled={!!pending} onClick={() => change(row, "PROMOTE")}>
                        {pending === `${row.id}:PROMOTE` ? "Promoting…" : "Promote to Manager"}
                      </button>
                    )}
                    {active && row.role === "SIRAH_REVIEWER" && (
                      <button type="button" className="ga-admin-outline-btn" disabled={!!pending} onClick={() => change(row, "DEMOTE")}>
                        {pending === `${row.id}:DEMOTE` ? "Demoting…" : "Demote to Community Lead"}
                      </button>
                    )}
                    {active && (
                      <button type="button" className="ga-admin-ghost-btn" style={{ color: "#a3332b" }} disabled={!!pending} onClick={() => change(row, "REVOKE")}>
                        {pending === `${row.id}:REVOKE` ? "Revoking…" : "Revoke access"}
                      </button>
                    )}
                    {!active && <span style={{ color: "#667c92" }}>Re-add as Community Lead to restore.</span>}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="ga-admin-workspace-head" style={{ marginTop: "2rem" }}>
          <div>
            <p className="ga-admin-kicker">Audit log</p>
            <h2 style={{ fontSize: "1.2rem" }}>Recent access changes</h2>
            <p>Who changed whose access, and when. Newest first; this record cannot be edited.</p>
          </div>
        </div>
        {rows !== null && changes.length === 0 && (
          <p className="ga-admin-empty-state">No access changes recorded yet.</p>
        )}
        {changes.length > 0 && (
          <div className="ga-admin-data-table">
            {changes.map((entry) => (
              <article
                key={entry.id}
                className="ga-admin-table-row"
                style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "0.4rem 1.25rem" }}
              >
                <div style={{ flex: "1 1 16rem", minWidth: 0, overflowWrap: "anywhere" }}>
                  <strong>{describeChange(entry)}</strong>
                  <p>{entry.targetEmail}</p>
                </div>
                <div style={{ flex: "0 1 14rem", minWidth: 0, overflowWrap: "anywhere" }}>
                  <p>By {entry.actor}</p>
                  <p>
                    {new Date(entry.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
