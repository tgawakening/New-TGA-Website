"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "../ornaments";
import s from "./login.module.css";

/* Same behaviour as components/auth/login-form.tsx (live): POST /api/login,
 * then go to ?next= or /dashboard and refresh; "Create account" goes to ?next=
 * or the registration flow. Only the presentation differs. */
export function IndigoLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      if (!response.ok) throw new Error(data.error || "Login failed.");
      const nextPath = searchParams.get("next");
      router.push(nextPath || "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={s.form} aria-busy={loading}>
      <div className={s.field}>
        <label htmlFor="login-email">Email</label>
        <input
          className={s.input}
          id="login-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
          required
        />
      </div>
      <div className={s.field}>
        <label htmlFor="login-password">Password</label>
        <input
          className={s.input}
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
          required
        />
      </div>
      {error ? (
        <p id="login-error" className={s.error} role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className={s.primary} disabled={loading}>
        {loading ? (
          <>
            <span className={s.spinner} aria-hidden="true" />
            Signing in…
          </>
        ) : (
          <>
            Sign in <ArrowRight className={s.arrow} />
          </>
        )}
      </button>
      <button
        type="button"
        className={s.ghost}
        onClick={() => router.push(searchParams.get("next") || "/seerah/register")}
      >
        Create account
      </button>
    </form>
  );
}
