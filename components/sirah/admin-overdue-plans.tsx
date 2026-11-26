"use client";
import { useState } from "react";
import { formatSirahMoney } from "@/lib/sirah/catalog";

type Row = { id: string; reference: string; currency: string; batchCode: string; user: { fullName: string; email: string }; overdueCount: number; overdueMinor: number; oldestDueAt: string };
export function AdminOverduePlans({ open }: { open: (row: { id: string; reference: string }) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError("");
    try { const response = await fetch("/api/admin/sirah/overdue-plans", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to load overdue plans."); setRows(data.rows); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load overdue plans."); } finally { setBusy(false); }
  }
  return <div><button type="button" className="ga-admin-ghost-btn" disabled={busy} onClick={() => void load()}>Show overdue monthly plans</button>
    {error && <p role="alert">{error}</p>}
    {rows && <section><h3>Overdue monthly plans</h3>{rows.length === 0 ? <p>No overdue monthly plans.</p> : <ul>{rows.map(row => <li key={row.id}><button type="button" onClick={() => open(row)}>{row.user.fullName} ({row.user.email})</button> — {row.batchCode}: {row.overdueCount} overdue {row.overdueCount === 1 ? "period" : "periods"}, {formatSirahMoney(row.overdueMinor, row.currency)} due; oldest {row.oldestDueAt.slice(0, 10)}</li>)}</ul>}</section>}
  </div>;
}
