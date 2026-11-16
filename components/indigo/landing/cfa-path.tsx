"use client";

import { useId, useState, type CSSProperties } from "react";
import type { CONNECT_PHASES } from "@/components/home/connect-akhira-data";
import { WaitlistButton } from "./waitlist-button";
import s from "./landing.module.css";

type Phase = (typeof CONNECT_PHASES)[number];
const numerals = ["I", "II", "III", "IV"];

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
 * Wider screens: hovering, focusing or clicking a station slides its detail
 * into the panel beside the path. The first station starts open. */
export function CfaPath({ phases }: { phases: readonly Phase[] }) {
  const [active, setActive] = useState(0);
  const base = useId();
  const panelId = `${base}-panel`;

  return (
    <div className={s.cfa}>
      <ol className={s.cfaPath} data-reveal="">
        <span className={s.cfaLine} aria-hidden="true" />
        {phases.map((p, k) => {
          const on = k === active;
          return (
            <li key={p.id} className={`${s.cfaStop} ${on ? s.cfaOn : ""}`} data-reveal="" style={{ "--i": k } as CSSProperties}>
              <button
                type="button"
                className={s.cfaStation}
                aria-expanded={on}
                aria-controls={`${base}-${k} ${panelId}`}
                onClick={() => setActive(k)}
                onMouseEnter={() => setActive(k)}
                onFocus={() => setActive(k)}
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
                  <Detail p={p} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {/* Wider screens: one panel beside the path */}
      <div className={s.cfaPanel} id={panelId} data-reveal="">
        {/* Keyed: a new station remounts the block, so its slide-in replays. */}
        <div key={phases[active].id} className={s.cfaSwap}>
          <p className={s.cfaPanelHead}>
            <span className={s.phaseLabel}>Phase {active + 1}</span>
            <span className={`${s.badge} ${s.bGold}`}>{phases[active].status}</span>
          </p>
          <h3 className={s.cfaPanelTitle}>{phases[active].title}</h3>
          <p className={s.phaseSub}>{phases[active].subtitle}</p>
          <Detail p={phases[active]} />
        </div>
      </div>
    </div>
  );
}
