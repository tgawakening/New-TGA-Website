"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Eyebrow } from "../section-heading";
import { story } from "./content";
import s from "./about.module.css";

const numerals = ["I", "II", "III", "IV"];

/* The four layers of one figure, innermost first. Stroke-only inline SVG on
 * a 200 grid; each layer is its own box so it can turn about its centre. */
const layers: ReactNode[] = [
  // I · Revelation: the seed. A still gold centre inside one ring.
  <g key="seed">
    <circle cx="100" cy="100" r="22" fill="none" stroke="var(--tealb)" strokeWidth="1.2" />
    <circle cx="100" cy="100" r="7" fill="var(--gold)" />
  </g>,
  // II · Leadership: the rub el hizb, the mark in the TGA seal.
  <g key="seal" fill="none" stroke="var(--teal)" strokeWidth="1.2">
    <rect x="62" y="62" width="76" height="76" />
    <rect x="62" y="62" width="76" height="76" transform="rotate(45 100 100)" />
  </g>,
  // III · Action: the rosette, three squares at 30°, with twelve beads.
  <g key="rosette">
    <g fill="none" stroke="var(--terra)" strokeWidth="1">
      <rect x="40" y="40" width="120" height="120" />
      <rect x="40" y="40" width="120" height="120" transform="rotate(30 100 100)" />
      <rect x="40" y="40" width="120" height="120" transform="rotate(60 100 100)" />
    </g>
    <g fill="var(--terrab)">
      {Array.from({ length: 12 }, (_, k) => {
        const a = (k * Math.PI) / 6;
        return <circle key={k} cx={100 + 84.85 * Math.cos(a + Math.PI / 12)} cy={100 + 84.85 * Math.sin(a + Math.PI / 12)} r="1.6" />;
      })}
    </g>
  </g>,
  // IV · One direction: the outer ring that holds it all, with its ticks.
  <g key="ring" fill="none" stroke="var(--sand)">
    <circle cx="100" cy="100" r="93" strokeWidth="0.8" opacity=".55" />
    <circle cx="100" cy="100" r="98" strokeWidth="0.5" opacity=".3" />
    {Array.from({ length: 24 }, (_, k) => (
      <line
        key={k}
        x1="100"
        y1="2"
        x2="100"
        y2={k % 2 ? "6" : "9"}
        strokeWidth="0.8"
        opacity=".5"
        transform={`rotate(${k * 15} 100 100)`}
      />
    ))}
  </g>,
];

function Layer({ n }: { n: number }) {
  return (
    <svg viewBox="0 0 200 200" className={s.layerSvg} focusable="false" aria-hidden="true">
      {layers[n]}
    </svg>
  );
}

/* Chapter marker: the figure as it stands after that chapter, in miniature
 * (strokes stay 1px at any size). On phones this is how the story builds. */
function Mini({ upTo }: { upTo: number }) {
  return (
    <svg viewBox="0 0 200 200" className={s.mini} focusable="false" aria-hidden="true">
      {layers.slice(0, upTo + 1)}
    </svg>
  );
}

/* Signature moment two: the pattern grows. The live page's three pillars and
 * its "what we are building" paragraph become four chapters; each one adds a
 * layer to the same figure, so the brand's geometry is told as the story.
 *
 * Wide screens: the figure is sticky beside the chapters and follows the one
 * at the middle of the viewport (scroll back and it unbuilds). Phones: the
 * figure assembles layer by layer when it scrolls into view, and each chapter
 * carries its own layer as its marker.
 *
 * Reveal (.is-in, from the motion layer) lives only on wrappers whose
 * className never changes; the stage lives on data attributes React owns. */
export function Story() {
  const [stage, setStage] = useState(0);
  const chapters = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const k = chapters.current.indexOf(e.target as HTMLElement);
          if (k >= 0) setStage(k);
        }
      },
      { rootMargin: "-48% 0px -48% 0px" },
    );
    chapters.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section id="story" className={`${s.section} ${s.patterned}`} aria-labelledby="story-title">
      <div className={s.wrap}>
        <div className={s.storyHead} data-reveal="">
          <Eyebrow>{story.eyebrow}</Eyebrow>
          <h2 id="story-title" className={s.h2}>
            {story.titleA} <em>{story.titleB}</em>
          </h2>
        </div>

        <div className={s.storyGrid}>
          <div className={s.figCol}>
            <div className={s.figWrap} data-reveal="">
              <div className={s.fig} data-stage={stage} data-complete={stage === 3 ? "" : undefined}>
                <span className={s.figGlow} aria-hidden="true" />
                {layers.map((_, n) => (
                  <div
                    key={n}
                    className={s.layer}
                    data-off={n > stage ? "" : undefined}
                    style={{ "--n": n } as CSSProperties}
                  >
                    <Layer n={n} />
                  </div>
                ))}
              </div>
              <p className={s.figCaption} aria-hidden="true">
                <span className={s.figNum}>{numerals[stage]}</span>
                <span key={stage} className={s.figLabel}>
                  {story.chapters[stage].label}
                </span>
              </p>
            </div>
          </div>

          <ol className={s.chapters}>
            {story.chapters.map((c, k) => (
              <li
                key={c.key}
                ref={(el) => {
                  chapters.current[k] = el;
                }}
                className={s.chapter}
                data-active={k === stage ? "" : undefined}
              >
                <div className={s.chapterInner} data-reveal="">
                  <span className={s.chapterMark} aria-hidden="true">
                    <Mini upTo={k} />
                  </span>
                  <p className={s.chapterLabel}>
                    <span>{numerals[k]}</span> {c.label}
                  </p>
                  <p className={k === 3 ? s.chapterTextLong : s.chapterText}>{c.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
