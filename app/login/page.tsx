import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IndigoLoginForm } from "@/components/indigo/auth/login-form";
import s from "@/components/indigo/auth/login.module.css";
import { Experience } from "@/components/indigo/motion/experience";
import { Wordmark } from "@/components/indigo/nav";
import { SirahNotice } from "@/components/sirah/sirah-notice";
import { getCurrentUser } from "@/lib/auth/session";
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseUnavailable } from "@/lib/db-errors";
import { indigoFontVariables } from "@/lib/fonts";
import "@/styles/indigo-motion.css";

export const metadata: Metadata = { title: "Sign in | Global Awakening" };
export const viewport: Viewport = { themeColor: "#141d33" };

const i = (n: number) => ({ "--i": n }) as CSSProperties;

// True only for a same-site return to a saved Sirah booking (?order=...).
function isUnfinishedRegistration(next: string | string[] | undefined) {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return false;
  const url = new URL(next, "https://local.invalid");
  return url.pathname === "/seerah/register" && Boolean(url.searchParams.get("order"));
}

/* If the database is unreachable, still render the page (with a notice)
 * instead of crashing on the existing-session check. */
async function currentUserOrUnavailable() {
  try {
    return { user: await getCurrentUser(), unavailable: false };
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    console.error("[login] database unavailable", error);
    return { user: null, unavailable: true };
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; reset?: string }>;
}) {
  const { user, unavailable } = await currentUserOrUnavailable();
  if (user) redirect("/dashboard");
  const params = await searchParams;
  const finishing = isUnfinishedRegistration(params.next);
  const passwordReset = params.reset === "1";

  return (
    <div className={`${s.page} ${indigoFontVariables}`} data-experience="">
      <header className={s.top}>
        {/* The wordmark shows here only when the intro column is hidden (tablet and phone). */}
        <span className={s.topMark}>
          <Wordmark href="/" />
        </span>
        <Link href="/" className={s.back}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to the site
        </Link>
      </header>

      <main className={s.split}>
        {/* Desktop only: a short welcome beside the card. Hidden on tablet and phone. */}
        <section className={s.intro} aria-labelledby="login-title">
          <div data-rise="" style={i(0)}>
            <Wordmark href="/" />
          </div>
          <h1 id="login-title" className={s.title} data-rise="" style={i(1)}>
            {finishing ? (
              <>
                Finish your <em>registration</em>
              </>
            ) : (
              <>
                Welcome to your <em>Sīrah dashboard</em>
              </>
            )}
          </h1>
          {finishing ? null : (
            <ul className={s.notes} data-rise="" style={i(2)}>
              <li>Use the email and password from your registration.</li>
              <li>Paid manually? We email you once it is confirmed.</li>
            </ul>
          )}
        </section>

        <section className={s.panel} aria-labelledby="signin-title" data-rise="" style={i(1)}>
          <div className={s.card}>
            {/* Operational notice from SIRAH_NOTICE (renders nothing when unset). */}
            <SirahNotice />
            <h2 id="signin-title" className={s.cardTitle}>
              {finishing ? "Sign in to continue" : "Sign in"}
            </h2>
            <p className={s.cardLede}>
              {finishing
                ? "Your booking is saved. Sign in with the email and password you registered with to go straight back and complete your payment."
                : "Use the email and password you created when you registered."}
            </p>
            {unavailable ? (
              <p role="status" className={s.status}>
                {DATABASE_UNAVAILABLE_MESSAGE}
              </p>
            ) : passwordReset ? (
              <p role="status" className={s.status}>
                Your password has been changed. Sign in with the new one.
              </p>
            ) : null}
            <IndigoLoginForm />
            <div className={s.links}>
              <Link href="/forgot-password">Forgot password?</Link>
              <span>
                No account yet? <Link href="/seerah/register">Create your registration</Link>
              </span>
            </div>
          </div>
        </section>
      </main>
      <Experience />
    </div>
  );
}
