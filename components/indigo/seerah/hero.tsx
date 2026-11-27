import type { CSSProperties } from "react";
import { Eyebrow } from "../section-heading";
import { copy, courseConfig, pillars } from "./content";
import { RegisterButton } from "./register";
import s from "./seerah.module.css";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/* Pillars sit at the four points of the seal: top, right, bottom, left. */
const placement = [s.pTop, s.pRight, s.pBottom, s.pLeft];

/* Signature moment one: beyond chronology. The page opens on a ruler, a plain
 * line of evenly spaced ticks, the shape of a timeline. It draws out, then
 * gives way: the ticks fall away and the same centre turns into the seal
 * whose four points are the course's four pillars. The course title, told in
 * geometry: from a sequence of events to the structure beneath them.
 * Pure CSS on first paint; transform and opacity only. */
function ChronologySeal() {
  return (
    <div className={s.sealStage} aria-hidden="true">
      <div className={s.ruler}>
        <span className={s.rulerLine} />
        <span className={s.rulerTicks} />
      </div>
      <div className={s.seal}>
        <span className={s.sealGlow} />
        <svg viewBox="0 0 200 200" className={s.sealA}>
          <rect x="44" y="44" width="112" height="112" fill="none" stroke="currentColor" strokeWidth="1.1" />
        </svg>
        <svg viewBox="0 0 200 200" className={s.sealB}>
          <rect x="44" y="44" width="112" height="112" fill="none" stroke="currentColor" strokeWidth="1.1" />
        </svg>
        <svg viewBox="0 0 200 200" className={s.sealRing}>
          <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth=".6" opacity=".5" />
          <circle cx="100" cy="100" r="30" fill="none" stroke="currentColor" strokeWidth=".8" />
          {Array.from({ length: 12 }, (_, k) => (
            <line
              key={k}
              x1="100"
              y1="8"
              x2="100"
              y2="14"
              stroke="currentColor"
              strokeWidth=".8"
              transform={`rotate(${k * 30} 100 100)`}
            />
          ))}
        </svg>
        <span className={s.sealCore} />
        {pillars.map((p, k) => (
          <span key={p} className={`${s.pillar} ${placement[k]}`} style={{ "--k": k } as CSSProperties}>
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SeerahHero({
  heroCountry,
  needsCountryChoice,
}: {
  heroCountry?: string;
  needsCountryChoice: boolean;
}) {
  return (
    <section id="overview" className={s.hero} aria-labelledby="course-title">
      <div className={`${s.wrap} ${s.heroGrid}`}>
        <div className={s.heroCopy}>
          <div data-rise="" style={i(0)}>
            <Eyebrow>12-month live programme</Eyebrow>
          </div>
          <h1 id="course-title" className={s.heroTitle} data-rise="" style={i(1)}>
            <span className={s.heroKicker}>Sīrah</span>
            <span className={s.heroName}>
              Beyond <em>Chronology</em>
            </span>
          </h1>
          <p className={s.heroLede} data-rise="" style={i(2)}>
            {copy.heroIntro}
          </p>
          <div className={s.heroActions} data-rise="" style={i(3)}>
            <RegisterButton placement="hero" country={heroCountry} requireBillingCountry={needsCountryChoice} />
          </div>
          <ul className={s.essentials} data-rise="" style={i(4)} aria-label="Course essentials">
            {courseConfig.essentials.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
        <ChronologySeal />
      </div>
    </section>
  );
}
