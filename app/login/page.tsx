import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IndigoLoginForm } from "@/components/indigo/auth/login-form";
import s from "@/components/indigo/auth/login.module.css";
import { Experience } from "@/components/indigo/motion/experience";
import { Wordmark } from "@/components/indigo/nav";
import { Rig } from "@/components/indigo/rig";
import { Eyebrow } from "@/components/indigo/section-heading";
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
        <Wordmark href="/" />
        <Link href="/" className={s.back}>
          ← Back to the site
        </Link>
      </header>

      <main className={s.split}>
        <section className={s.intro} aria-labelledby="login-title">
          <div className={s.introRig} aria-hidden="true">
            <Rig />
          </div>
          <div className={s.introCopy}>
            <div data-rise="" style={i(0)}>
              <Eyebrow>{finishing ? "Finish your registration" : "Student access"}</Eyebrow>
            </div>
            <h1 id="login-title" className={s.title} data-rise="" style={i(1)}>
              {finishing ? (
                <>
                  Sign in to <em>complete your payment</em>
                </>
              ) : (
                <>
                  Sign in to your <em>Sīrah dashboard</em>
                </>
              )}
            </h1>
            <p className={s.lede} data-rise="" style={i(2)}>
              {finishing
                ? "Your booking is saved. Sign in with the email and password you used when you registered, and you will go straight back to it to complete your payment."
                : "Use the same email and password you created during registration. Once your payment is approved, your dashboard and LMS access open automatically."}
            </p>
            {finishing ? null : (
              <ul className={s.notes} data-rise="" style={i(3)}>
                <li>
                  <b>Pending manual payment?</b>
                  <span>You will receive an email once admin confirms it from the backend.</span>
                </li>
                <li>
                  <b>Need a new registration?</b>
                  <span>Open the course registration flow again and choose your payment method.</span>
                </li>
              </ul>
            )}
          </div>
        </section>

        <section className={s.panel} aria-labelledby="signin-title" data-rise="" style={i(2)}>
          <div className={s.card}>
            <h2 id="signin-title" className={s.cardTitle}>
              {finishing ? "Sign in to continue" : "Sign in"}
            </h2>
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
