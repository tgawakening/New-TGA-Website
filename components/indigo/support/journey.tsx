"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { contributionStages } from "./content";
import s from "./support.module.css";

type IconName = (typeof contributionStages)[number]["icon"];
function StageIcon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {name === "heart" && <path d="M12 20 4 12a5 5 0 0 1 8-6 5 5 0 0 1 8 6Z" />}
        {name === "book" && <path d="M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2ZM12 6v15" />}
        {name === "people" && <><circle cx="9" cy="7" r="3" /><path d="M3 20v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2" /></>}
        {name === "spark" && <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />}
      </g>
    </svg>
  );
}

/* Signature moment one: the thread. The live page's four funding stages as a
 * single gold thread that runs from "Your contribution" to "Scholarship access".
 * As each stage comes into view the thread reaches it (scale on one axis) and
 * the station lights; at the last one the star opens. It only ever moves
 * forward. Down the page on phones, across it on wide screens. With reduced
 * motion, or before JavaScript, the thread is simply complete. */
export function Journey() {
  const list = useRef<HTMLOListElement>(null);
  const N = contributionStages.length;

  // Driven straight on the DOM (attributes React never renders), so the
  // list never re-renders while you scroll. The thread is drawn by each
  // stage's ::before (track) and ::after (fill), so the <ol> holds only <li>s.
  useEffect(() => {
    const ol = list.current;
    if (!ol || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ol.dataset.ready = "";
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          // Reaching a stage lights every stage before it, so a jump never leaves a gap.
          const k = Number((e.target as HTMLElement).dataset.stage);
          ol.querySelectorAll<HTMLElement>("li").forEach(li => {
            if (Number(li.dataset.stage) <= k && li.dataset.lit === undefined) {
              li.dataset.lit = "";
              io.unobserve(li);
            }
          });
        }
      },
      { threshold: 0.6, rootMargin: "0px 0px -12% 0px" },
    );
    ol.querySelectorAll("li").forEach(li => io.observe(li));
    return () => io.disconnect();
  }, []);

  return (
    <ol ref={list} className={s.journey} aria-label="How contributions support learning">
      {contributionStages.map((stage, k) => (
        <li key={stage.title} data-stage={k} className={s.stage} style={{ "--k": k } as CSSProperties}>
          <span className={s.station} aria-hidden="true">
            {k === N - 1 ? <span className={s.burst} /> : null}
            <span className={s.stationIcon}>
              <StageIcon name={stage.icon} />
            </span>
          </span>
          <div className={s.stageCopy}>
            <span className={s.stageNo}>0{k + 1}</span>
            <h3>{stage.title}</h3>
            <p>{stage.copy}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
