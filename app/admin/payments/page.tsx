"use client";

import { useState } from "react";

type ManualRow = {
  id: string;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  registration: {
    paymentReference: string;
    user: {
      fullName: string;
      email: string;
    };
  };
  manualSubmission: {
    senderName: string;
    senderNumber: string;
    referenceKey: string;
    notes?: string | null;
  } | null;
};

export default function AdminPaymentsPage() {
  const [token, setToken] = useState("");
  const [rows, setRows] = useState<ManualRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadRows() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/payments/manual", {
        headers: {
          "x-admin-token": token,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load manual payments.");
      }
      setRows(data.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin load error.");
    } finally {
      setLoading(false);
    }
  }

  async function review(paymentId: string, approve: boolean) {
    setError(null);
    const response = await fetch("/api/admin/payments/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({
        paymentId,
        approve,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Review failed.");
      return;
    }
    await loadRows();
  }

  return (
    <main className="ga-page">
      <section className="ga-section">
        <div className="ga-container">
          <h1 className="ga-heading">Admin Manual Payment Review</h1>
          <p className="ga-copy" style={{ marginTop: "0.7rem" }}>
            Enter admin token, load under-review payments, then confirm or reject.
          </p>

          <div style={{ marginTop: "1rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="ADMIN_API_TOKEN"
              style={{ minWidth: 280, padding: "0.55rem", borderRadius: 6, border: "1px solid #9cb6cc" }}
            />
            <button type="button" className="ga-btn ga-btn-primary" onClick={() => void loadRows()} disabled={loading}>
              {loading ? "Loading..." : "Load Manual Payments"}
            </button>
          </div>

          {error ? <p style={{ color: "#fca5a5", marginTop: "0.7rem" }}>{error}</p> : null}

          <div style={{ marginTop: "1rem", display: "grid", gap: "0.7rem" }}>
            {rows.map((row) => (
              <div key={row.id} className="ga-chip" style={{ display: "grid", gap: "0.35rem" }}>
                <p style={{ margin: 0 }}>
                  <strong>{row.registration.user.fullName}</strong> ({row.registration.user.email})
                </p>
                <p style={{ margin: 0 }}>Amount: {row.amount} {row.currency}</p>
                <p style={{ margin: 0 }}>Provider: {row.provider}</p>
                <p style={{ margin: 0 }}>Platform Ref: {row.registration.paymentReference}</p>
                <p style={{ margin: 0 }}>Sender: {row.manualSubmission?.senderName} ({row.manualSubmission?.senderNumber})</p>
                <p style={{ margin: 0 }}>Transfer Ref: {row.manualSubmission?.referenceKey}</p>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
                  <button type="button" className="ga-btn ga-btn-primary" onClick={() => void review(row.id, true)}>
                    Confirm Payment
                  </button>
                  <button type="button" className="ga-btn ga-btn-outline" onClick={() => void review(row.id, false)}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
