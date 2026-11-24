"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "../ornaments";
import s from "./login.module.css";

export function IndigoLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Presentation only: switches the field between hidden and visible text.
  const [showPassword, setShowPassword] = useState(false);

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
        <div className={s.passwordWrap}>
          <input
            className={`${s.input} ${s.passwordInput}`}
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
            required
          />
          <button
            type="button"
            className={s.reveal}
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            aria-controls="login-password"
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.9 17.9A10.4 10.4 0 0 1 12 19.5C5 19.5 1.5 12 1.5 12a18.6 18.6 0 0 1 4.6-5.9M9.9 4.7A9.6 9.6 0 0 1 12 4.5c7 0 10.5 7.5 10.5 7.5a18.8 18.8 0 0 1-2.2 3.3M14.1 14.1a3 3 0 1 1-4.2-4.2M1.5 1.5l21 21" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1.5 12S5 4.5 12 4.5 22.5 12 22.5 12 19 19.5 12 19.5 1.5 12 1.5 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
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
        onClick={() => router.push("/seerah/register")}
      >
        Create account
      </button>
    </form>
  );
}
