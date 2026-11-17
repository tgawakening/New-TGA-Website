"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { ProgramIcon } from "@/components/gen-mumin/program-icon";
import { programmes } from "./content";
import s from "./projects.module.css";

const N = programmes.length; // five
/* One petal: a lens from the centre to the rim, pointing up. */
const PETAL = "M100 100 C 80 78, 80 44, 100 18 C 120 44, 120 78, 100 100 Z";
const tip = (k: number) => {
  const a = ((k * 360) / N - 90) * (Math.PI / 180);
  return [100 + 82 * Math.cos(a), 100 + 82 * Math.sin(a)];
};

/* Signature moment two: the five-fold path. "Five connected areas" drawn
 * as one figure, a five-fold rosette whose petals are the programmes, each
 * in its own accent from programs.ts. Choosing a programme turns the figure
 * so its petal stands at the top (always the short way round), and the panel
 * ends with where it leads, following the data's own chain from Arabic &
 * Tajweed through to Parental Sessions. Accessible tabs: arrow keys, Home /
 * End. Transform and opacity only. */
export function Programmes() {
  const [active, setActive] = useState(0);
  const [turn, setTurn] = useState(0); // cumulative steps, so rotation never unwinds
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (k: number, focus = false) => {
    const next = ((k % N) + N) % N;
    let delta = next - active;
    if (delta > N / 2) delta -= N;
    if (delta < -N / 2) delta += N;
    setTurn((t) => t + delta);
    setActive(next);
    if (focus) tabs.current[next]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, number> = { ArrowRight: active + 1, ArrowDown: active + 1, ArrowLeft: active - 1, ArrowUp: active - 1, Home: 0, End: N - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    select(map[e.key], true);
  };
  const p = programmes[active];

  return (
    <div className={s.path}>
      <div className={s.flowerStage} aria-hidden="true">
        <div className={s.flower} style={{ "--turn": turn } as CSSProperties}>
          <svg viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="96" className={s.rim} />
            {Array.from({ length: N * 2 }, (_, k) => (
              <line key={k} x1="100" y1="4" x2="100" y2={k % 2 ? "8" : "11"} className={s.tick} transform={`rotate(${k * 36} 100 100)`} />
            ))}
            {/* The pentagon that joins the five areas */}
            <polygon points={programmes.map((_, k) => tip(k).map((v) => ((v - 100) * 0.42 + 100).toFixed(2)).join(",")).join(" ")} className={s.join} />
            {programmes.map((prog, k) => (
              <g key={prog.id} transform={`rotate(${(k * 360) / N} 100 100)`} style={{ "--accent": prog.accent } as CSSProperties}>
                <path d={PETAL} className={s.petalFill} data-on={k === active ? "" : undefined} />
                <path d={PETAL} className={s.petal} data-on={k === active ? "" : undefined} />
                <circle cx="100" cy="14" r="3" className={s.petalTip} />
              </g>
            ))}
            <circle cx="100" cy="100" r="7" className={s.core} />
          </svg>
        </div>
        <span className={s.pointer} />
      </div>

      <div className={s.pathBody}>
        <div className={s.tabs} role="tablist" aria-label="Gen Mumin programmes">
          {programmes.map((prog, k) => (
            <button
              key={prog.id}
              ref={(el) => {
                tabs.current[k] = el;
              }}
              type="button"
              role="tab"
              id={`gm-tab-${prog.id}`}
              aria-selected={k === active}
              aria-controls="gm-panel"
              tabIndex={k === active ? 0 : -1}
              className={s.tab}
              style={{ "--accent": prog.accent } as CSSProperties}
              onClick={() => select(k)}
              onKeyDown={onKey}
            >
              <span className={s.tabIcon}>
                <ProgramIcon program={prog.id} />
              </span>
              <span className={s.tabText}>{prog.tab}</span>
            </button>
          ))}
        </div>

        <div
          id="gm-panel"
          role="tabpanel"
          aria-labelledby={`gm-tab-${p.id}`}
          className={s.panel}
          style={{ "--accent": p.accent } as CSSProperties}
        >
          {/* Keyed: a new programme replays the rise-in */}
          <div key={p.id} className={s.panelSwap}>
            <div className={s.panelHead}>
              <p className={s.panelNo}>
                Area {active + 1} of {N}
              </p>
              <p className={s.panelArabic} lang="ar" dir="rtl">
                {p.arabic}
              </p>
            </div>
            <h3 className={s.panelTitle}>{p.title}</h3>
            <p className={s.panelSub}>{p.subtitle}</p>
            <p className={s.panelText}>{p.description}</p>
            <ul className={s.points}>
              {p.points.map((pt) => (
                <li key={pt}>{pt}</li>
              ))}
            </ul>
            <dl className={s.stats}>
              {p.stats.map((st) => (
                <div key={st.label}>
                  <dt>{st.label}</dt>
                  <dd>{st.value}</dd>
                </div>
              ))}
            </dl>
            {active < N - 1 ? (
              <button type="button" className={s.leads} onClick={() => select(active + 1)}>
                <span className={s.leadsLabel}>Leads to</span>
                <span className={s.leadsName}>{p.leadsTo}</span>
                <span aria-hidden="true">→</span>
              </button>
            ) : (
              <p className={s.leads}>
                <span className={s.leadsLabel}>Leads to</span>
                <span className={s.leadsName}>{p.leadsTo}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
