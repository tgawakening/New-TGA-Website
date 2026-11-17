import type { CSSProperties } from "react";
import { Button } from "../button";
import { Rig } from "../rig";
import { Eyebrow } from "../section-heading";
import { aboutHero, stats } from "./content";
import s from "./about.module.css";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/* Signature moment one: the dawn. "Awakening" taken literally: the living
 * geometry rises over a horizon like the sun at fajr while the night sky
 * dims. The horizon then becomes the ground the community's numbers stand on.
 * Pure CSS entrance (transform and opacity); the pointer parallax comes from
 * the shared motion layer via data-rig / data-depth. */
export function DawnHero({ homeHref }: { homeHref: string }) {
  return (
    <section className={s.hero} aria-labelledby="about-title">
      <div className={s.stars} aria-hidden="true" />
      <div className={s.sky} aria-hidden="true" />

      <div className={`${s.wrap} ${s.heroCopy}`}>
        <div data-rise="" style={i(0)}>
          <Eyebrow>{aboutHero.eyebrow}</Eyebrow>
        </div>
        <h1 id="about-title" className={s.heroTitle} data-rise="" style={i(1)}>
          {aboutHero.titleA} <em>{aboutHero.titleB}</em>
        </h1>
        <p className={s.heroLede} data-rise="" style={i(2)}>
          {aboutHero.lede}
        </p>
        <div className={s.ctaRow} data-rise="" style={i(3)}>
          <Button href={`${homeHref}#courses`} arrow>
            Explore courses
          </Button>
          <Button href="#mission" variant="ghost">
            Our mission
          </Button>
        </div>
      </div>

      <div className={s.dawn} data-rig-scope="">
        <div className={s.sun} aria-hidden="true">
          <div className={s.sunRise}>
            <Rig />
          </div>
        </div>
        <span className={s.horizon} aria-hidden="true" />
        <div className={s.note} data-rise="" style={i(5)}>
          <div data-depth="1.4">
            <span className={s.noteLabel}>{aboutHero.note.title}</span>
            <span className={s.noteBody}>{aboutHero.note.body}</span>
          </div>
        </div>
      </div>

      <div className={s.wrap}>
        <dl className={s.stats} aria-label="Global Awakening in numbers">
          {stats.map((st, k) => (
            <div key={st.label} className={s.stat} data-rise="" style={i(4 + k * 0.5)}>
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
