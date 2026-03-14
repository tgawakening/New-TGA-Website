"use client";

import { useState } from "react";

type ApplicationRow = {
  id: string;
  fullName: string;
  email: string;
  whatsapp: string;
  age: number | null;
  cityCountry: string;
  occupation: string;
  knowledgeLevel: string;
  previousSeerahStudy: string | null;
  currentInvolvement: string | null;
  whatDrawsYou: string;
  howItBenefits: string;
  mostInterestingTopic: string;
  whyThisTopic: string;
  canAttendRegularly: string;
  attendedOrientation: boolean;
  reasonForWaiver: string;
  howHeard: string | null;
  adabCommitment: boolean;
  genuineFinancialNeed: boolean;
  status: string;
  reviewNote: string | null;
  createdAt: string;
};

export default function AdminFreeWarriorPage() {
  const [token, setToken] = useState("");
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function loadRows() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/free-warrior", {
        headers: { "x-admin-token": token },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load applications.");
      }
      setRows(data.rows ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Admin load error.");
    } finally {
      setLoading(false);
    }
  }

  async function review(applicationId: string, approve: boolean) {
    setError(null);
    const response = await fetch("/api/admin/free-warrior/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({
        applicationId,
        approve,
        note: notes[applicationId] ?? "",
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
          <h1 className="ga-heading">Admin Free Warrior Review</h1>
          <p className="ga-copy" style={{ marginTop: "0.7rem" }}>
            Load scholarship applications, review the applicant details, then approve or reject them.
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
              {loading ? "Loading..." : "Load Applications"}
            </button>
          </div>

          {error ? <p style={{ color: "#b42318", marginTop: "0.8rem" }}>{error}</p> : null}

          <div style={{ marginTop: "1.1rem", display: "grid", gap: "0.9rem" }}>
            {rows.map((row) => (
              <article key={row.id} className="ga-chip" style={{ display: "grid", gap: "0.5rem", padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <p style={{ margin: 0 }}>
                    <strong>{row.fullName}</strong> ({row.email})
                  </p>
                  <p style={{ margin: 0, fontWeight: 700 }}>{row.status}</p>
                </div>
                <p style={{ margin: 0 }}>WhatsApp: {row.whatsapp}</p>
                <p style={{ margin: 0 }}>Age: {row.age ?? "-"}</p>
                <p style={{ margin: 0 }}>City & Country: {row.cityCountry}</p>
                <p style={{ margin: 0 }}>Occupation: {row.occupation}</p>
                <p style={{ margin: 0 }}>Knowledge Level: {row.knowledgeLevel}</p>
                <p style={{ margin: 0 }}>Previous Seerah Study: {row.previousSeerahStudy || "-"}</p>
                <p style={{ margin: 0 }}>Current Involvement: {row.currentInvolvement || "-"}</p>
                <p style={{ margin: 0 }}>What draws you: {row.whatDrawsYou}</p>
                <p style={{ margin: 0 }}>How it benefits: {row.howItBenefits}</p>
                <p style={{ margin: 0 }}>Most interesting topic: {row.mostInterestingTopic}</p>
                <p style={{ margin: 0 }}>Why this topic: {row.whyThisTopic}</p>
                <p style={{ margin: 0 }}>Can attend regularly: {row.canAttendRegularly}</p>
                <p style={{ margin: 0 }}>Attended orientation: {row.attendedOrientation ? "Yes" : "No"}</p>
                <p style={{ margin: 0 }}>Reason for waiver: {row.reasonForWaiver}</p>
                <p style={{ margin: 0 }}>How heard: {row.howHeard || "-"}</p>
                <p style={{ margin: 0 }}>Adab commitment: {row.adabCommitment ? "Yes" : "No"}</p>
                <p style={{ margin: 0 }}>Genuine financial need: {row.genuineFinancialNeed ? "Yes" : "No"}</p>

                <textarea
                  value={notes[row.id] ?? row.reviewNote ?? ""}
                  onChange={(event) => setNotes((prev) => ({ ...prev, [row.id]: event.target.value }))}
                  placeholder="Optional admin note"
                  rows={3}
                  style={{ width: "100%", borderRadius: 8, border: "1px solid #bcd0e1", padding: "0.65rem", resize: "vertical" }}
                />

                {row.status === "PENDING" ? (
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                    <button type="button" className="ga-btn ga-btn-primary" onClick={() => void review(row.id, true)}>
                      Approve Application
                    </button>
                    <button type="button" className="ga-btn ga-btn-outline" onClick={() => void review(row.id, false)}>
                      Reject Application
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
