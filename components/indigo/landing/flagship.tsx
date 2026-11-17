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
    <ol className={s.journey} data-reveal="" aria-label="The four movements of the course">
      <span className={s.journeyTrack} aria-hidden="true">
        <span className={s.journeyFill} />
      </span>
      {flagship.pillars.map((p, k) => (
        <li key={p} className={s.station} style={{ "--k": k } as CSSProperties}>
          <span className={s.stationSeal} aria-hidden="true">
            <svg viewBox="0 0 100 100">
              <g fill="none" stroke="currentColor" strokeWidth="4">
                <rect x="22" y="22" width="56" height="56" />
                <rect x="22" y="22" width="56" height="56" transform="rotate(45 50 50)" />
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

export function Flagship() {
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
              <p className={s.flagSub}>{flagship.pillars.map((p) => p.replace("The ", "")).join(" · ")}</p>
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
              <Button href={flagship.href} arrow>
                Explore the Sīrah course
              </Button>
            </div>
            <div className={s.flagArt} aria-hidden="true">
              <Rosette className={s.flagRosette} accentClassName={s.rosetteAccentGold} />
            </div>
          </div>
          <Journey />
        </Card>
      </div>
    </section>
  );
}
