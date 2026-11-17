"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "../ornaments";
import s from "./login.module.css";

/* The live sign-in form (app/login/page.tsx): POST /api/login,
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
      let response: Response;
      try {
        response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
      } catch {
        throw new Error("We couldn't reach the server. Check your connection and try again.");
      }
      // A crashed or unreachable backend may not answer with JSON at all.
      const data: { error?: string } = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.error ||
            (response.status >= 500
              ? "We can't sign you in right now because our system is temporarily unavailable. Please try again in a few minutes."
              : "Login failed."),
        );
      }
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
