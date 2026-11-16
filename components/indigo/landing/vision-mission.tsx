"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Eyebrow } from "../section-heading";
import type { VisionMissionKey } from "./content";
import s from "./landing.module.css";

type Panel = {
  tab: string;
  titleA: string;
  titleB: string;
  lead: string;
  motto: string;
  focusTitle: string;
  points: readonly string[];
  ayah: { arabic: string; translation: string; reference: string };
};

type Props = {
  panels: Record<VisionMissionKey, Panel>;
  stats: { label: string; value: number; n: string; suffix: string }[];
};

const order: VisionMissionKey[] = ["vision", "mission"];

/* Accessible tabs (WAI-ARIA pattern; arrows move between tabs). The reader
 * chooses: no auto-rotation. A swap is a short cross-fade (CSS on the panel
 * that becomes visible). Stats count up once, on view (motion layer). */
export function VisionMission({ panels, stats }: Props) {
  const [active, setActive] = useState<VisionMissionKey>("vision");
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = order[(order.indexOf(active) + 1) % order.length];
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <section id="mission" className={`${s.section} ${s.patterned}`} aria-label="Our vision and mission">
      <div className={s.wrap}>
        <div className={s.vmHead} data-reveal="">
          <Eyebrow>Who we are</Eyebrow>
          <div className={s.vmToggle} role="tablist" aria-label="Vision or mission">
            <span
              className={`${s.vmThumb} ${active === "mission" ? s.vmThumbRight : ""}`}
              aria-hidden="true"
            />
            {order.map((key) => (
              <button
                key={key}
                ref={(el) => {
                  tabs.current[key] = el;
                }}
                type="button"
                role="tab"
                id={`vm-tab-${key}`}
                aria-selected={active === key}
                aria-controls={`vm-panel-${key}`}
                tabIndex={active === key ? 0 : -1}
                className={active === key ? s.vmOn : undefined}
                onClick={() => setActive(key)}
                onKeyDown={onKey}
              >
                {panels[key].tab}
              </button>
            ))}
          </div>
        </div>

        <div data-reveal="">
        {order.map((key) => {
          const p = panels[key];
          return (
            <div
              key={key}
              role="tabpanel"
              id={`vm-panel-${key}`}
              aria-labelledby={`vm-tab-${key}`}
              hidden={active !== key}
              className={s.vmBody}
            >
              <div className={s.vmGrid}>
                <div>
                  <h2 className={s.vmTitle}>
                    {p.titleA} <em>{p.titleB}</em>
                  </h2>
                  <p className={s.vmLead}>{p.lead}</p>
                  <p className={s.vmMotto}>{p.motto}</p>
                  <p className={s.vmFocusTitle}>{p.focusTitle}</p>
                  <ul className={s.foci}>
                    {p.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                </div>
                <figure className={s.vmAyah}>
                  <p className={s.arabic} lang="ar" dir="rtl">
                    {p.ayah.arabic}
                  </p>
                  <figcaption>
                    <p className={s.translation}>&ldquo;{p.ayah.translation}&rdquo;</p>
                    <cite className={s.cite}>{p.ayah.reference}</cite>
                  </figcaption>
                </figure>
              </div>
            </div>
          );
        })}
        </div>

        <dl className={s.stats}>
          {stats.map((st, k) => (
            <div key={st.label} className={s.stat} data-reveal="" style={{ "--i": k } as React.CSSProperties}>
              <dt>{st.label}</dt>
              <dd>
                <span data-count={st.value}>{st.n}</span>
                <span data-suffix="">{st.suffix}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
