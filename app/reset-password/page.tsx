import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { AuthShell } from "@/components/indigo/auth/auth-shell";
import { PasswordField } from "@/components/indigo/auth/password-field";
import s from "@/components/indigo/auth/login.module.css";
import { RESET_COOKIE } from "@/lib/auth/password-reset-cookie";
import { findUsableResetToken, RESET_TOKEN_MINUTES } from "@/services/password-reset.service";
import { resetPasswordAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Choose a new password · Global Awakening",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const viewport: Viewport = { themeColor: "#141d33" };

const ERRORS: Record<string, string> = {
  short: "Use at least 8 characters.",
  long: "Use 72 characters or fewer.",
  mismatch: "The two passwords do not match.",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const token = (await cookies()).get(RESET_COOKIE)?.value;
  const usable = await findUsableResetToken(token);
  const error = ERRORS[(await searchParams).error || ""];

  if (!usable)
    return (
      <AuthShell labelledBy="reset-title">
        <div role="status">
          <span className={`${s.stateIcon} ${s.stateIconWarn}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
          <h1 id="reset-title" className={s.cardTitle}>
            {token ? "This link has expired" : "Open the link from your email"}
          </h1>
          <p className={s.cardLede}>
            {token
              ? `Reset links work once and expire after ${RESET_TOKEN_MINUTES} minutes, and only the newest one works. Ask for a new link and use the latest email.`
              : "To choose a new password, open the reset link we emailed you. If you no longer have it, ask for a new one."}
          </p>
          <div className={s.buttons}>
            <Link href="/forgot-password" className={s.primary}>
              Send a new link
            </Link>
            <Link href="/login" className={s.ghost}>
              Back to sign in
            </Link>
          </div>
        </div>
      </AuthShell>
    );

  return (
    <AuthShell labelledBy="reset-title">
      <h1 id="reset-title" className={s.cardTitle}>
        Choose a new password
      </h1>
      <p className={s.cardLede}>After this you will be signed out everywhere, and you can sign in with the new password.</p>
      <form action={resetPasswordAction} className={s.form}>
        <PasswordField
          id="reset-password"
          name="password"
          label="New password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          help="8 to 72 characters."
          describedBy={error ? "reset-error" : undefined}
          invalid={Boolean(error)}
        />
        <PasswordField
          id="reset-confirm"
          name="confirmPassword"
          label="Confirm new password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          describedBy={error ? "reset-error" : undefined}
          invalid={Boolean(error)}
        />
        {error ? (
          <p id="reset-error" className={s.error} role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className={s.primary}>
          Save new password
        </button>
      </form>
      <div className={s.altRow}>
        <span className={s.help}>Remembered it?</span>
        <Link href="/login" className={s.ghost}>
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
