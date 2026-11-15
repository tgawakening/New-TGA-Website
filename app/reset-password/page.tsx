import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { RESET_COOKIE } from "@/lib/auth/password-reset-cookie";
import { findUsableResetToken } from "@/services/password-reset.service";
import { resetPasswordAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Choose a new password · Global Awakening",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const ERRORS: Record<string, string> = {
  short: "Use at least 8 characters.",
  long: "Use 72 characters or fewer.",
  mismatch: "The two passwords do not match.",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const token = (await cookies()).get(RESET_COOKIE)?.value;
  const usable = await findUsableResetToken(token);
  const error = ERRORS[(await searchParams).error || ""];

  return (
    <main className="ga-page">
      <section className="ga-section">
        <div className="ga-container ga-login-shell">
          <article className="ga-login-copy">
            <p className="ga-dashboard-kicker">Student access</p>
            <h1 className="ga-heading">Choose a new password</h1>
            <p className="ga-copy" style={{ marginTop: "0.8rem" }}>
              After this you will be signed out everywhere, and you can sign in with the new password.
            </p>
          </article>

          <article className="ga-dashboard-card">
            {usable ? (
              <>
                <h2 className="ga-dashboard-card-title">New password</h2>
                <form action={resetPasswordAction} style={{ marginTop: "1.2rem", display: "grid", gap: "0.9rem" }}>
                  <div style={{ display: "grid", gap: "0.55rem" }}>
                    <label htmlFor="reset-password">New password</label>
                    <input
                      className="ga-auth-input"
                      id="reset-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={72}
                      aria-describedby="reset-password-help"
                    />
                    <span id="reset-password-help" className="ga-dashboard-muted">
                      8 to 72 characters.
                    </span>
                  </div>
                  <div style={{ display: "grid", gap: "0.55rem" }}>
                    <label htmlFor="reset-confirm">Confirm new password</label>
                    <input
                      className="ga-auth-input"
                      id="reset-confirm"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={72}
                    />
                  </div>
                  {error ? (
                    <p role="alert" style={{ color: "#fca5a5", margin: 0 }}>
                      {error}
                    </p>
                  ) : null}
                  <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
                    <button type="submit" className="ga-btn ga-btn-primary">
                      Save new password
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div role="status">
                <h2 className="ga-dashboard-card-title">This link has expired</h2>
                <p className="ga-dashboard-muted" style={{ marginTop: "0.9rem" }}>
                  Reset links work once and expire after an hour. Ask for a new one and use the latest email.
                </p>
                <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", marginTop: "1.1rem" }}>
                  <Link href="/forgot-password" className="ga-btn ga-btn-primary">
                    Send a new link
                  </Link>
                  <Link href="/login" className="ga-btn ga-btn-outline">
                    Sign in
                  </Link>
                </div>
              </div>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}
