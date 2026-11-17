import type { CSSProperties } from "react";
import { Button } from "../button";
import { Card } from "../card";
import { Rosette } from "../ornaments";
import { Eyebrow } from "../section-heading";
import { flagship } from "./content";
import s from "./landing.module.css";

const numerals = ["I", "II", "III", "IV"];

/* The method: the course's four movements on one path. When the section
 * arrives the track draws and the seals ignite in order (CSS, keyed on .is-in). */
function Journey() {
  return (
    <ol
      className={s.journey}
      data-reveal=""
      aria-label="The four movements of the course"
    >
      <span className={s.journeyTrack} aria-hidden="true">
        <span className={s.journeyFill} />
      </span>
      {flagship.pillars.map((p, k) => (
        <li key={p} className={s.station} style={{ "--k": k } as CSSProperties}>
          <span className={s.stationSeal} aria-hidden="true">
            <svg viewBox="0 0 100 100">
              <g fill="none" stroke="currentColor" strokeWidth="4">
                <rect x="22" y="22" width="56" height="56" />
                <rect
                  x="22"
                  y="22"
                  width="56"
                  height="56"
                  transform="rotate(45 50 50)"
                />
              </g>
              <circle cx="50" cy="50" r="9" className={s.stationCore} />
            </svg>
          </span>
          <span className={s.stationN}>{numerals[k]}</span>
          <span className={s.stationName}>{p}</span>
        </li>
      ))}
    </ol>
  );
}

export function Flagship({ seerahHref = flagship.href }: { seerahHref?: string }) {
  return (
    <section id="sirah" className={s.section} aria-labelledby="flagship-title">
      <div className={s.wrap}>
        <Card variant="feature" className={s.flagship} data-reveal="">
          <div className={s.flagGlow} aria-hidden="true" />
          <div className={s.flagGrid}>
            <div>
              <Eyebrow>{flagship.eyebrow}</Eyebrow>
              <h2 id="flagship-title" className={s.flagTitle}>
                {flagship.title}
              </h2>
              <p className={s.flagSub}>
                {flagship.pillars.map((p) => p.replace("The ", "")).join(" · ")}
              </p>
              <p className={s.flagBody}>{flagship.body}</p>
              {flagship.instructor ? (
                <p className={s.flagInstructor}>
                  Taught by <b>{flagship.instructor}</b>
                </p>
              ) : null}
              <ul className={s.essentials} aria-label="Course format">
                {flagship.essentials.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <Button href={seerahHref} arrow>
                Explore the Sīrah course
              </Button>
            </div>
            {/* The course's own poster, set into the card: its warm paper edges
             * fade into the indigo ground, the geometry frames it. */}
            <figure className={s.flagArt}>
              <Rosette
                className={s.flagRosette}
                accentClassName={s.rosetteAccentGold}
              />
              <span className={s.posterWrap}>
                <span className={s.posterFrame} aria-hidden="true" />
                <span className={s.poster}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static files; the optimizer is bypassed on purpose */}
                  <img
                    src="/redesign/seerah-poster-640.webp"
                    srcSet="/redesign/seerah-poster-420.webp 420w, /redesign/seerah-poster-640.webp 640w, /redesign/seerah-poster-792.webp 792w"
                    sizes="(min-width: 54rem) 360px, (min-width: 30rem) 22rem, calc(100vw - 5rem)"
                    width={792}
                    height={941}
                    loading="lazy"
                    decoding="async"
                    alt="Sīrah, from narrative to method: the Sīrah as a study of leadership, power, institutions, alliances, resources and strategy under changing conditions."
                  />
                </span>
              </span>
            </figure>
          </div>
          <Journey />
        </Card>
      </div>
    </section>
  );
}
