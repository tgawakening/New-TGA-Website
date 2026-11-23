import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Experience } from "@/components/indigo/motion/experience";
import { Wordmark } from "@/components/indigo/nav";
import { indigoFontVariables } from "@/lib/fonts";
import s from "./login.module.css";
import "@/styles/indigo-motion.css";

/** The frame of the auth screens other than sign-in (forgot password, reset
 * password): the sign-in page's navy ground, top bar with the wordmark and a
 * Back to the site button, and one card centred in the viewport. */
export function AuthShell({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  return (
    <div className={`${s.page} ${s.solo} ${indigoFontVariables}`} data-experience="">
      <header className={s.top}>
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
        <section className={s.panel} aria-labelledby={labelledBy} data-rise="" style={{ "--i": 1 } as CSSProperties}>
          <div className={s.card}>{children}</div>
        </section>
      </main>
      <Experience />
    </div>
  );
}
