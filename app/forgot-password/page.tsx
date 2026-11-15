import type { Metadata } from "next";
import Link from "next/link";
import { RESET_TOKEN_MINUTES } from "@/services/password-reset.service";
import { requestResetAction } from "./actions";

export const metadata: Metadata = {
  title: "Forgot password · Global Awakening",
  robots: { index: false, follow: false },
};

/** Same look as /login. Whatever is entered, the result is the one neutral
 * confirmation below: the page never says whether an account exists. */
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const sent = (await searchParams).sent === "1";
  return (
    <main className="ga-page">
      <section className="ga-section">
        <div className="ga-container ga-login-shell">
          <article className="ga-login-copy">
            <p className="ga-dashboard-kicker">Student access</p>
            <h1 className="ga-heading">Reset your password</h1>
            <p className="ga-copy" style={{ marginTop: "0.8rem" }}>
              Enter the email you registered with. We will send you a link to choose a new password. The link works once and
              expires in {RESET_TOKEN_MINUTES} minutes.
            </p>
          </article>

          <article className="ga-dashboard-card">
            {sent ? (
              <div role="status">
                <h2 className="ga-dashboard-card-title">Check your email</h2>
                <p className="ga-dashboard-muted" style={{ marginTop: "0.9rem" }}>
                  If an account exists for that email, a link to reset the password is on its way. It can take a few
                  minutes; check your spam folder too.
                </p>
                <p className="ga-dashboard-muted" style={{ marginTop: "1rem" }}>
                  <Link href="/login">Back to sign in</Link> · <Link href="/forgot-password">Send another link</Link>
                </p>
              </div>
            ) : (
              <>
                <h2 className="ga-dashboard-card-title">Send a reset link</h2>
                <form action={requestResetAction} style={{ marginTop: "1.2rem", display: "grid", gap: "0.9rem" }}>
                  <div style={{ display: "grid", gap: "0.55rem" }}>
                    <label htmlFor="reset-email">Email</label>
                    <input className="ga-auth-input" id="reset-email" name="email" type="email" autoComplete="email" required maxLength={191} />
                  </div>
                  <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
                    <button type="submit" className="ga-btn ga-btn-primary">
                      Send reset link
                    </button>
                  </div>
                </form>
                <p className="ga-dashboard-muted" style={{ marginTop: "1rem" }}>
                  Remembered it? <Link href="/login">Sign in</Link>
                </p>
              </>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}
