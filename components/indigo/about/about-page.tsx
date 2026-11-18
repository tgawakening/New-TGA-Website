import type { CSSProperties } from "react";
import { Button } from "../button";
import { Card } from "../card";
import { Footer } from "../footer";
import { Experience } from "../motion/experience";
import { Nav } from "../nav";
import { liveLinks, type SiteLinks } from "../site-links";
import { Eyebrow } from "../section-heading";
import { difference, invitation, whyWeExist } from "./content";
import { DawnHero } from "./dawn-hero";
import { Story } from "./story";
import s from "./about.module.css";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/** `site`: live routes by default; the hidden preview passes its own so
 * its links stay inside the preview. */
export function AboutPage({ site = liveLinks }: { site?: SiteLinks }) {
  return (
    <div className={s.page} data-experience="">
      <span data-progress="" aria-hidden="true" />
      <a href="#main" className={s.skip}>
        Skip to content
      </a>
      <Nav site={site} />
      <main id="main">
        <DawnHero />

        {/* The first light carries on down the page, into the argument. */}
        <section className={`${s.section} ${s.why}`} aria-labelledby="why-title">
          <div className={s.wrap}>
            <div className={s.whyInner} data-reveal="">
              <Eyebrow>{whyWeExist.eyebrow}</Eyebrow>
              <h2 id="why-title" className={s.whyTitle}>
                {whyWeExist.titleA} <em>{whyWeExist.titleB}</em>
              </h2>
              <p className={s.whyBody}>{whyWeExist.body}</p>
            </div>
          </div>
        </section>

        <Story />

        <section className={s.section} aria-labelledby="difference-title">
          <div className={`${s.wrap} ${s.diffGrid}`}>
            <div data-reveal="">
              <Eyebrow>{difference.eyebrow}</Eyebrow>
              <h2 id="difference-title" className={s.diffTitle}>
                {difference.titleA} <em>{difference.titleB}</em>
              </h2>
            </div>
            <ul className={s.diffList}>
              {difference.points.map((p, k) => (
                <li key={p.lead} data-reveal="" style={i(k)}>
                  <strong>{p.lead}</strong> <span>{p.rest}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={s.section} aria-labelledby="invitation-title">
          <div className={s.wrap}>
            <Card variant="feature" className={s.cta} data-reveal="">
              <h2 id="invitation-title" className={s.ctaTitle}>
                {invitation.titleA} <em>{invitation.titleB}</em> {invitation.titleC}
              </h2>
              <p className={s.ctaBody}>{invitation.body}</p>
              <div className={s.ctaRow}>
                <Button href={`${site.home}#courses`} arrow>
                  Explore courses
                </Button>
                <Button href="/seerah/register" variant="ghost">
                  Start your journey
                </Button>
              </div>
              {/* The hero's sunrise, small: the page ends where it began. */}
              <span className={s.ctaSun} aria-hidden="true" />
            </Card>
          </div>
        </section>
      </main>
      <Footer site={site} />
      <Experience />
    </div>
  );
}
