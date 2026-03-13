"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: "1.2rem", display: "grid", gap: "0.9rem" }}>
      <div style={{ display: "grid", gap: "0.55rem" }}>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div style={{ display: "grid", gap: "0.55rem" }}>
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      {error ? <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p> : null}
      <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
        <button type="submit" className="ga-btn ga-btn-primary" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
        <button type="button" className="ga-btn ga-btn-outline" onClick={() => router.push("/seerah/register")}>
          Create Account
        </button>
      </div>
    </form>
  );
}
