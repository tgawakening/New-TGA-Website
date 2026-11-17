"use client";

import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { CONNECT_PHASES } from "@/components/home/connect-akhira-data";
import { WaitlistButton } from "./waitlist-button";
import s from "./landing.module.css";

type Phase = (typeof CONNECT_PHASES)[number];
const numerals = ["I", "II", "III", "IV"];

/** First sentence only (phones). */
const firstSentence = (text: string) => text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;

/* Phones: the same phase, condensed so the open station stays about a
 * screen tall. One sentence, two points as chips, the stats on one line.
 * The panel beside the path (wider screens) keeps the full detail. */
function CompactDetail({ p }: { p: Phase }) {
  return (
    <div className={`${s.cfaDetail} ${s.cfaCompact}`}>
      <p className={s.phaseBody}>{firstSentence(p.description)}</p>
      <ul className={s.cfaChips}>
        {p.points.slice(0, 2).map((pt) => (
          <li key={pt}>{pt}</li>
        ))}
      </ul>
      <p className={s.cfaStatLine}>
        {p.stats.map((st) => `${st.value} ${st.label.toLowerCase()}`).join(" · ")}
      </p>
      <div className={s.phaseFoot}>
        <span className={s.phaseNext}>
          Leads to <b>{p.leadsTo}</b>
        </span>
        {p.id === "divine-bonds" ? <WaitlistButton label={p.cta} /> : <span className={s.phaseSoon}>{p.cta}</span>}
      </div>
    </div>
  );
}

function Detail({ p, id }: { p: Phase; id?: string }) {
  return (
    <div className={s.cfaDetail} id={id}>
      <p className={s.phaseArabic} lang="ar" dir="rtl">
        {p.arabic}
      </p>
      <p className={s.phaseBody}>{p.description}</p>
      <ul className={s.coursePoints}>
        {p.points.map((pt) => (
          <li key={pt}>{pt}</li>
        ))}
      </ul>
      <dl className={s.phaseStats}>
        {p.stats.map((st) => (
          <div key={st.label}>
            <dt>{st.label}</dt>
            <dd>{st.value}</dd>
          </div>
        ))}
      </dl>
      <div className={s.phaseFoot}>
        <span className={s.phaseNext}>
          Leads to <b>{p.leadsTo}</b>
        </span>
        {p.id === "divine-bonds" ? <WaitlistButton label={p.cta} /> : <span className={s.phaseSoon}>{p.cta}</span>}
      </div>
    </div>
  );
}

/* Stations on a path. Phones: tap a station to open its detail beneath it.
 * Wider screens: hovering, focusing or clicking a station shows its detail
 * in the panel beside the path. The first station starts open.
 *
 * The scroll reveal (data-reveal → .is-in, added once by the motion observer)
 * lives on elements whose className React never changes. The active state is
 * kept on the inner button only, so switching stations can't strip .is-in
 * from a marker and hide it. */
export function CfaPath({ phases }: { phases: readonly Phase[] }) {
  const [active, setActive] = useState(0);
  const base = useId();
  const panelId = `${base}-panel`;
  // Phones: closing the detail above the tapped station would pull it upward.
  // Remember where the station was and hold it there after the switch.
  const anchor = useRef<{ el: HTMLElement; top: number } | null>(null);

  const activate = (k: number, el: HTMLElement) => {
    if (k === active) return;
    anchor.current = { el, top: el.getBoundingClientRect().top };
    setActive(k);
  };

  useLayoutEffect(() => {
    const a = anchor.current;
    anchor.current = null;
    if (!a) return;
    const shift = a.el.getBoundingClientRect().top - a.top;
    if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: "instant" as ScrollBehavior });
  }, [active]);

  return (
    <div className={s.cfa}>
      <ol className={s.cfaPath} data-reveal="">
        <span className={s.cfaLine} aria-hidden="true" />
        {phases.map((p, k) => {
          const on = k === active;
          return (
            <li key={p.id} className={s.cfaStop} data-reveal="" style={{ "--i": k } as CSSProperties}>
              <button
                type="button"
                className={`${s.cfaStation} ${on ? s.cfaOn : ""}`}
                aria-expanded={on}
                aria-controls={`${base}-${k} ${panelId}`}
                onClick={(e) => activate(k, e.currentTarget)}
                onMouseEnter={(e) => activate(k, e.currentTarget)}
                onFocus={(e) => activate(k, e.currentTarget)}
              >
                <span className={s.phaseSeal} aria-hidden="true">
                  <svg viewBox="0 0 100 100">
                    <g fill="none" stroke="currentColor" strokeWidth="3">
                      <rect x="20" y="20" width="60" height="60" />
                      <rect x="20" y="20" width="60" height="60" transform="rotate(45 50 50)" />
                    </g>
                  </svg>
                  <span>{numerals[k]}</span>
                </span>
                <span className={s.cfaText}>
                  <span className={s.phaseLabel}>
                    Phase {k + 1} · {p.status}
                  </span>
                  <span className={s.phaseTitle}>{p.title}</span>
                  <span className={s.phaseSub}>{p.subtitle}</span>
                </span>
                <span className={s.cfaChevron} aria-hidden="true">
                  →
                </span>
              </button>
              {/* Phones: detail inline under the open station */}
              {on ? (
                <div className={s.cfaInline} id={`${base}-${k}`}>
                  <CompactDetail p={p} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {/* Wider screens: one panel beside the path. Every station's detail sits
       * in the same grid cell, so the panel is always as tall as the tallest
       * one and switching never changes its size; only the active one shows. */}
      <div className={s.cfaPanel} id={panelId} data-reveal="">
        <div className={s.cfaStack}>
          {phases.map((p, k) => {
            const on = k === active;
            return (
              <div key={p.id} className={s.cfaSwap} data-on={on ? "" : undefined} aria-hidden={!on} inert={!on}>
                <p className={s.cfaPanelHead}>
                  <span className={s.phaseLabel}>Phase {k + 1}</span>
                  <span className={`${s.badge} ${s.bGold}`}>{p.status}</span>
                </p>
                <h3 className={s.cfaPanelTitle}>{p.title}</h3>
                <p className={s.phaseSub}>{p.subtitle}</p>
                <Detail p={p} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
