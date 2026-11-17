import type { CSSProperties } from "react";
import Link from "next/link";
import { Button } from "../button";
import { Card } from "../card";
import { Footer } from "../footer";
import { Experience } from "../motion/experience";
import { Nav } from "../nav";
import { liveLinks, type SiteLinks } from "../site-links";
import { ArrowRight, Rosette } from "../ornaments";
import { Eyebrow, SectionHeading } from "../section-heading";
import { aboutCta, pathways, visionMission } from "./content";
import { DawnHero } from "./dawn-hero";
import { Story } from "./story";
import s from "./about.module.css";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/** `site`: live routes by default; the hidden preview passes its own so
 * its links stay inside the preview. */
export function AboutPage({ site = liveLinks }: { site?: SiteLinks }) {
  const homeHref = site.home;

  return (
    <div className={s.page} data-experience="">
      <span data-progress="" aria-hidden="true" />
      <a href="#main" className={s.skip}>
        Skip to content
      </a>
      <Nav site={site} />
      <main id="main">
        <DawnHero homeHref={homeHref} />
        <Story />

        {/* Vision and mission, side by side: the two halves of one intent. */}
        <section id="mission" className={s.section} aria-labelledby="vm-title">
          <div className={s.wrap}>
            <SectionHeading id="vm-title" eyebrow="Who we are" title="Vision and mission" />
            <div className={s.vmGrid}>
              {(["vision", "mission"] as const).map((key, k) => {
                const p = visionMission[key];
                return (
                  <div key={key} className={s.vmCell} data-reveal="" style={i(k)}>
                    <Card accentEdge className={s.vmCard}>
                      <p className={s.vmTab}>{p.tab}</p>
                      <h3 className={s.vmTitle}>
                        {p.titleA} <em>{p.titleB}</em>
                      </h3>
                      <p className={s.vmLead}>{p.lead}</p>
                      <p className={s.vmMotto}>{p.motto}</p>
                      <p className={s.vmFocus}>{p.focusTitle}</p>
                      <ul className={s.points}>
                        {p.points.map((pt) => (
                          <li key={pt}>{pt}</li>
                        ))}
                      </ul>
                      <figure className={s.ayah}>
                        <p className={s.arabic} lang="ar" dir="rtl">
                          {p.ayah.arabic}
                        </p>
                        <figcaption>
                          <p className={s.translation}>&ldquo;{p.ayah.translation}&rdquo;</p>
                          <cite className={s.cite}>{p.ayah.reference}</cite>
                        </figcaption>
                      </figure>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="pathways" className={`${s.section} ${s.patterned}`} aria-labelledby="pathways-title">
          <div className={s.wrap}>
            <SectionHeading id="pathways-title" eyebrow="Pathways" title="Current learning and project directions." />
            <ol className={s.pathways}>
              {pathways.map((p, k) => (
                <li key={p.id} data-reveal="" style={i(k)}>
                  <Card as={Link} href={p.href === "/seerah" ? site.seerah : (p.href ?? `${homeHref}#courses`)} interactive className={s.pathway}>
                    <span className={s.pathNum} aria-hidden="true">
                      {String(k + 1).padStart(2, "0")}
                    </span>
                    <span className={s.pathCat}>{p.category}</span>
                    <span className={s.pathTitle}>{p.title}</span>
                    <ArrowRight className={s.pathArrow} />
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={s.section} aria-labelledby="about-cta-title">
          <div className={s.wrap}>
            <Card variant="feature" className={s.cta} data-reveal="">
              <Rosette className={s.ctaRosette} accentClassName={s.ctaAccent} />
              <Eyebrow>Uniting minds · inspiring change</Eyebrow>
              <h2 id="about-cta-title" className={s.ctaTitle}>
                {aboutCta.title}
              </h2>
              <p className={s.ctaBody}>{aboutCta.body}</p>
              <div className={`${s.ctaRow} ${s.ctaCenter}`}>
                <Button href={`${homeHref}#courses`} arrow>
                  Explore courses
                </Button>
                <Button href={site.support} variant="ghost">
                  Support our mission
                </Button>
              </div>
            </Card>
          </div>
        </section>
      </main>
      <Footer site={site} />
      <Experience />
    </div>
  );
}
