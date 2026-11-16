"use client";

import { useRef, useState, type KeyboardEvent } from "react";
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
  stats: { label: string; n: string; suffix: string }[];
};

const order: VisionMissionKey[] = ["vision", "mission"];

/* Accessible tabs (WAI-ARIA pattern): arrow keys move between tabs.
 * No auto-rotation: the reader chooses. Stats sit outside the panels because
 * they describe the organisation, not one tab. */
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
    <section id="mission" className={s.section} aria-label="Our vision and mission">
      <div className={s.wrap}>
        <div className={s.vmToggle} role="tablist" aria-label="Vision or mission">
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

        <dl className={s.stats}>
          {stats.map((st) => (
            <div key={st.label} className={s.stat}>
              <dt>{st.label}</dt>
              <dd>
                {st.n}
                <span>{st.suffix}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
