import { Button } from "../button";
import { Rosette } from "../ornaments";
import { Eyebrow } from "../section-heading";
import { heroAyah, statByLabel } from "./content";
import s from "./landing.module.css";

/* No video, no images, no client JS: text, one inline SVG and CSS.
 * The starfield is CSS gradients; the rosette turns once every 120s. */
export function Hero() {
  const students = statByLabel("Students");
  const countries = statByLabel("Countries");

  return (
    <section className={s.hero} aria-labelledby="hero-title">
      <div className={s.stars} aria-hidden="true" />
      <div className={`${s.wrap} ${s.heroGrid}`}>
        <div className={s.heroCopy}>
          <Eyebrow star>Uniting minds · inspiring change</Eyebrow>
          <h1 id="hero-title" className={s.heroTitle}>
            Raising <em>Akhira-ready</em> leaders
          </h1>
          <p className={s.heroLede}>
            Grounded in revelation and equipped to lead. A global platform awakening and empowering
            intellectual and concerned Muslims to inspire meaningful change.
          </p>

          <figure className={s.heroAyah}>
            <p className={s.arabic} lang="ar" dir="rtl">
              {heroAyah.arabic}
            </p>
            <figcaption>
              <p className={s.translation}>&ldquo;{heroAyah.translation}&rdquo;</p>
              <cite className={s.cite}>{heroAyah.reference}</cite>
            </figcaption>
          </figure>

          <div className={s.ctaRow}>
            <Button href="/seerah" arrow>
              Explore the Sīrah course
            </Button>
            <Button href="#mission" variant="ghost">
              Our mission
            </Button>
          </div>
        </div>

        <div className={s.heroArt}>
          <div className={s.rosetteWrap} aria-hidden="true">
            <Rosette className={s.rosette} accentClassName={s.rosetteAccent} />
          </div>
          <div className={`${s.heroBadge} ${s.hbTop}`}>
            <span className={s.hbLabel}>Sīrah flagship</span>
            <span className={s.hbValue}>Beyond Chronology</span>
            <span className={s.hbSub}>12-month live programme</span>
          </div>
          {students && countries ? (
            <div className={`${s.heroBadge} ${s.hbBottom}`}>
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
          ) : null}
        </div>
      </div>
    </section>
  );
}
