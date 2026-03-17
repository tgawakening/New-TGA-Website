"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Admin login failed.");
      }

      router.push("/admin");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Admin login error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ga-admin-login-shell">
      <article className="ga-admin-login-card">
        <div className="ga-admin-login-badge">Admin access</div>
        <h1 className="ga-admin-title" style={{ marginTop: "1rem" }}>
          Sign in to the Global Awakening admin panel
        </h1>
        <p className="ga-admin-subtitle" style={{ marginTop: "0.85rem" }}>
          Review live registrations, fee waiver applications, payment states, and enrollments from one place.
        </p>

        <form onSubmit={handleSubmit} className="ga-admin-login-form" style={{ marginTop: "1.6rem" }}>
          <label htmlFor="admin-email">
            Admin email
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label htmlFor="admin-password">
            Password
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <p className="ga-admin-error-banner" style={{ marginTop: 0 }}>{error}</p> : null}

          <div className="ga-admin-actions">
            <button type="submit" className="ga-admin-primary-btn" disabled={loading}>
              {loading ? "Signing in..." : "Open Admin Dashboard"}
            </button>
          </div>
        </form>
      </article>
    </div>
  );
}
