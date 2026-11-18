"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { SirahPlan } from "@/lib/sirah/catalog";
import { RegistrationStylesProvider } from "@/components/sirah/registration-styles";
import { Wordmark } from "../nav";
import { liveLinks, type SiteLinks } from "../site-links";
import form from "./register-form.module.css";
import s from "./register.module.css";

/* The live registration form, loaded exactly as /seerah/register loads it
 * (client only, same props). Only its class map is the Indigo one. */
const SirahRegistrationForm = dynamic(
  () => import("@/components/sirah/registration-form").then((m) => m.SirahRegistrationForm),
  {
    ssr: false,
    loading: () => (
      <p className={s.loading} role="status">
        Loading registration…
      </p>
    ),
  },
);

/* The sundial arc the sun climbs behind, on a 200 x 100 half-circle whose base
 * is the top edge of the form card. */
const onArc = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(100 + r * Math.cos(a)).toFixed(2)} ${(100 - r * Math.sin(a)).toFixed(2)}`;
};
const ticks = Array.from({ length: 11 }, (_, k) => {
  const deg = (k + 1) * 15;
  return `M${onArc(96, deg)}L${onArc(k % 2 ? 88 : 91, deg)}`;
}).join("");

function Node({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 100)`}>
      <rect x="-3" y="-3" width="6" height="6" />
      <rect x="-3" y="-3" width="6" height="6" transform="rotate(45)" />
    </g>
  );
}

/* Signature moment: the sun rises over the form. The card's top edge is the
 * horizon, and the sun climbs with the form's own step state (CSS reads it, so
 * no logic is added). Decorative only: it takes no input and carries no text. */
function Dawn() {
  return (
    <div className={form.dawn} aria-hidden="true">
      <div className={form.dawnLight} />
      <div className={form.dawnClip}>
        <div className={form.sunEnter}>
          <div className={form.sun} />
        </div>
      </div>
      <svg viewBox="0 0 200 100" className={form.dawnArc}>
        <path d="M4 100A96 96 0 0 1 196 100" fill="none" stroke="#f2c66b" opacity=".6" />
        <path d={ticks} fill="none" stroke="#f2c66b" opacity=".42" />
        <g fill="#f2c66b">
          <Node x={4} />
          <Node x={196} />
        </g>
      </svg>
    </div>
  );
}

/** /seerah/register in Indigo Geometry: a compact header, then the form.
 * Same three props as the live page; `site` maps the header links and tells
 * the form which page it is on. */
export function RegisterPage({
  initialCountry,
  initialPlan,
  requireBillingCountry,
  site = liveLinks,
}: {
  initialCountry?: string;
  initialPlan?: SirahPlan;
  requireBillingCountry?: boolean;
  site?: SiteLinks;
}) {
  return (
    <div className={s.page}>
      <header className={s.header}>
        <Wordmark href={site.home} />
        <Link href={site.seerah} className={s.back}>
          <span aria-hidden="true">←</span> Back to course
        </Link>
      </header>
      <main className={`${s.main} ${form.dawnScope}`}>
        <Dawn />
        <RegistrationStylesProvider value={form}>
          <SirahRegistrationForm
            initialCountry={initialCountry}
            initialPlan={initialPlan}
            requireBillingCountry={requireBillingCountry}
            registerPath={site.register}
          />
        </RegistrationStylesProvider>
      </main>
    </div>
  );
}
