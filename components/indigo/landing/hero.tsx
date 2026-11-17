import { Fragment, type CSSProperties } from "react";
import { Button } from "../button";
import { Rig } from "../rig";
import { Eyebrow } from "../section-heading";
import { heroAyah, statByLabel } from "./content";
import s from "./landing.module.css";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

export function Hero({ seerahHref = "/seerah" }: { seerahHref?: string }) {
  const students = statByLabel("Students");
  const countries = statByLabel("Countries");
  const words = heroAyah.arabic.split(" ");

  return (
    <section className={s.hero} aria-labelledby="hero-title">
      <div className={s.stars} aria-hidden="true" />
      <div className={`${s.wrap} ${s.heroGrid}`}>
        <div className={s.heroCopy}>
          <div data-rise="" style={i(0)}>
            <Eyebrow>Uniting minds · inspiring change</Eyebrow>
          </div>
          <h1 id="hero-title" className={s.heroTitle} data-rise="" style={i(1)}>
            Raising <em>Akhira-ready</em> leaders
          </h1>
          <p className={s.heroLede} data-rise="" style={i(2)}>
            Grounded in revelation and equipped to lead. A global platform awakening and empowering intellectual
            and concerned Muslims to inspire meaningful change.
          </p>

          <figure className={s.heroAyah} data-rise="" style={i(3)}>
            <p className={s.arabic} lang="ar" dir="rtl" data-words="">
              {/* Spaces sit between the word spans: trailing space inside an
               * inline-block collapses, which would run the words together. */}
              {words.map((w, k) => (
                <Fragment key={k}>
                  <span style={{ "--w": k } as CSSProperties}>{w}</span>
                  {k < words.length - 1 ? " " : null}
                </Fragment>
              ))}
            </p>
            <figcaption>
              <p className={s.translation}>&ldquo;{heroAyah.translation}&rdquo;</p>
              <cite className={s.cite}>{heroAyah.reference}</cite>
            </figcaption>
          </figure>

          <div className={s.ctaRow} data-rise="" style={i(4)}>
            <Button href={seerahHref} arrow>
              Explore the Sīrah course
            </Button>
            <Button href="#mission" variant="ghost">
              Our mission
            </Button>
          </div>
        </div>

        <div className={s.heroArt} data-rig-scope="">
          <div className={s.rigStage} data-rise="" style={i(1)}>
            <Rig />
          </div>
          <div className={`${s.heroBadge} ${s.hbTop}`} data-rise="" style={i(5)}>
            <div data-depth="2.2">
              <span className={s.hbLabel}>Sīrah flagship</span>
              <span className={s.hbValue}>Beyond Chronology</span>
              <span className={s.hbSub}>12-month live programme</span>
            </div>
          </div>
          {students && countries ? (
            <div className={`${s.heroBadge} ${s.hbBottom}`} data-rise="" style={i(6)}>
              <div data-depth="1.9">
                <span className={s.hbLabel}>Our community</span>
                <span className={s.hbValue}>
                  {students.n}
                  {students.suffix} students
                </span>
                <span className={s.hbSub}>
                  across {countries.n}
                  {countries.suffix} countries
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <a href="#sirah" className={s.cue} data-rise="" style={i(7)}>
        <span>Scroll</span>
        <i aria-hidden="true" />
      </a>
    </section>
  );
}
