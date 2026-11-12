"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin-login.module.css";

/** One login card for both entry points. `workspace="sirah"` is used by the
 * installable Sīrah app's /admin/sirah/login route: Sīrah wording, and a
 * successful sign-in always lands in the Sīrah workspace. */
export default function AdminLogin({ workspace = "all" }: { workspace?: "all" | "sirah" }) {
  const sirah = workspace === "sirah";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

      router.push(sirah ? "/admin/sirah" : data.next || "/admin");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Admin login error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.shell}>
      <article className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">TGA</span>
          <span className={styles.brandName}>
            {sirah ? "Sīrah team access" : "The Global Awakening"}
          </span>
        </div>
        <div>
          <h1 className={styles.title}>
            {sirah ? "Sign in to Sīrah Admin" : "Sign in to the admin workspace"}
          </h1>
          <p className={styles.lead}>
            {sirah
              ? "Open enrolments, scholarships and the course tools your account is authorised to use."
              : "Manage registrations, payments and enrolments."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label htmlFor="admin-email" className={styles.field}>
            Email
            <input
              id="admin-email"
              className={styles.input}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <div className={styles.field}>
            <label htmlFor="admin-password">Password</label>
            <div className={styles.passwordWrap}>
              <input
                id="admin-password"
                className={styles.input}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className={styles.eye}
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                aria-controls="admin-password"
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.2 2.3-2.4 3.5M6.6 6.6C4.5 8 3.1 10 2 12c1 2.5 5 7 10 7 1.7 0 3.2-.5 4.6-1.3" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error ? <p className={styles.error} role="alert">{error}</p> : null}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className={styles.roles}>
          Access is role-based: Super Admin, Manager or Community Lead.
        </p>
      </article>
    </div>
  );
}
