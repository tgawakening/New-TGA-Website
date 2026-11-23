import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/indigo/auth/auth-shell";
import s from "@/components/indigo/auth/login.module.css";
import { RESET_TOKEN_MINUTES } from "@/services/password-reset.service";
import { requestResetAction } from "./actions";

export const metadata: Metadata = {
  title: "Forgot password · Global Awakening",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#141d33" };

/** Same look as /login. Whatever is entered, the result is the one neutral
 * confirmation below: the page never says whether an account exists. */
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const sent = (await searchParams).sent === "1";
  return (
    <AuthShell labelledBy="forgot-title">
      {sent ? (
        <div role="status">
          <span className={s.stateIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18v12H3zM3 7l9 6 9-6" />
            </svg>
          </span>
          <h1 id="forgot-title" className={s.cardTitle}>
            Check your email
          </h1>
          <p className={s.cardLede}>
            If that email is registered, we&rsquo;ve sent a reset link. It can take a few minutes to arrive; check your spam folder
            too. The link works once and expires in {RESET_TOKEN_MINUTES} minutes.
          </p>
          <div className={s.buttons}>
            <Link href="/login" className={s.primary}>
              Back to sign in
            </Link>
            <Link href="/forgot-password" className={s.ghost}>
              Send another link
            </Link>
          </div>
        </div>
      ) : (
        <>
          <h1 id="forgot-title" className={s.cardTitle}>
            Reset your password
          </h1>
          <p className={s.cardLede}>
            Enter the email you registered with. We will send you a link to choose a new password. The link works once and expires
            in {RESET_TOKEN_MINUTES} minutes.
          </p>
          <form action={requestResetAction} className={s.form}>
            <div className={s.field}>
              <label htmlFor="reset-email">Email</label>
              <input className={s.input} id="reset-email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={191} />
            </div>
            <button type="submit" className={s.primary}>
              Send reset link
            </button>
          </form>
          <div className={s.altRow}>
            <span className={s.help}>Remembered it?</span>
            <Link href="/login" className={s.ghost}>
              Sign in
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
