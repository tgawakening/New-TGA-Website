import { Fragment, type CSSProperties } from "react";
import { Button } from "../button";
import { Rig } from "../rig";
import { Eyebrow } from "../section-heading";
import { CelestialBodies, CelestialSky, GeometrySwitch } from "./celestial";
import c from "./celestial.module.css";
import { heroAyah, statByLabel } from "./content";
import s from "./landing.module.css";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

export function Hero({
  seerahHref = "/seerah",
  geometryPreview = false,
}: {
  seerahHref?: string;
  /** Adds the celestial variants and their dev toggle. /redesign only. */
  geometryPreview?: boolean;
}) {
  const students = statByLabel("Students");
  const countries = statByLabel("Countries");
  const words = heroAyah.arabic.split(" ");
  /** A variant hook, present only on the preview. */
  const v = (name: string) => (geometryPreview ? ` ${name}` : "");

  const flagship = (
    <>
      <span className={s.hbLabel}>Sīrah flagship</span>
      <span className={s.hbValue}>Beyond Chronology</span>
      <span className={s.hbSub}>12-month live programme</span>
    </>
  );
  const community =
    students && countries ? (
      <>
        <span className={s.hbLabel}>Our community</span>
        <span className={s.hbValue}>
          {students.n}
          {students.suffix} students
        </span>
        <span className={s.hbSub}>
          across {countries.n}
          {countries.suffix} countries
        </span>
      </>
    ) : null;

  return (
    <section className={`${s.hero}${v(c.scope)}`} aria-labelledby="hero-title">
      {geometryPreview ? <CelestialSky /> : null}
      <div className={s.stars} aria-hidden="true" />
      <div className={`${s.wrap} ${s.heroGrid}${v(c.grid)}`}>
        <div className={`${s.heroCopy}${v(c.copy)}`}>
          <div data-rise="" style={i(0)}>
            <Eyebrow>Uniting minds · inspiring change</Eyebrow>
          </div>
          <h1 id="hero-title" className={s.heroTitle} data-rise="" style={i(1)}>
            Raising <em>Akhira-ready</em> leaders
          </h1>
          <p className={`${s.heroLede}${v(c.splitOnly)}`} data-rise="" style={i(2)}>
            Grounded in revelation and equipped to lead. A global platform awakening and empowering intellectual
            and concerned Muslims to inspire meaningful change.
          </p>
          {geometryPreview ? (
            <p className={`${c.centeredOnly} ${c.shortLede}`} data-rise="" style={i(2)}>
              Grounded in revelation. Equipped to lead.
            </p>
          ) : null}

          <figure className={`${s.heroAyah}${v(c.ayah)}`} data-rise="" style={i(3)}>
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
              <p className={`${s.translation}${v(c.splitOnly)}`}>&ldquo;{heroAyah.translation}&rdquo;</p>
              {geometryPreview ? (
                <p className={`${s.translation} ${c.centeredOnly}`}>&ldquo;{heroAyah.concise}&rdquo;</p>
              ) : null}
              <cite className={s.cite}>{heroAyah.reference}</cite>
            </figcaption>
          </figure>

          <div className={`${s.ctaRow}${v(c.cta)}`} data-rise="" style={i(4)}>
            <Button href={seerahHref} arrow>
              Explore the Sīrah course
            </Button>
            <Button href="#mission" variant="ghost">
              Our mission
            </Button>
          </div>
        </div>

        <div className={`${s.heroArt}${v(c.art)}`} data-rig-scope="">
          <div className={`${s.rigStage}${v(c.stage)}`} data-rise="" style={i(1)}>
            <Rig>{geometryPreview ? <CelestialBodies /> : null}</Rig>
          </div>
          <div className={`${s.heroBadge} ${s.hbTop}${v(c.splitOnly)}`} data-rise="" style={i(5)}>
            <div data-depth="2.2">{flagship}</div>
          </div>
          {community ? (
            <div className={`${s.heroBadge} ${s.hbBottom}${v(c.splitOnly)}`} data-rise="" style={i(6)}>
              <div data-depth="1.9">{community}</div>
            </div>
          ) : null}
        </div>
      </div>

      <a href="#sirah" className={`${s.cue}${v(c.splitOnly)}`} data-rise="" style={i(7)}>
        <span>Scroll</span>
        <i aria-hidden="true" />
      </a>
      {geometryPreview ? (
        <div className={c.strip}>
          <div className={c.stripInner}>
            <div className={c.stripItem}>{flagship}</div>
            {community ? <div className={c.stripItem}>{community}</div> : null}
          </div>
        </div>
      ) : null}
      {geometryPreview ? <GeometrySwitch /> : null}
    </section>
  );
}
