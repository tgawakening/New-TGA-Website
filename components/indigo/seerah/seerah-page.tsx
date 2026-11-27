"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import { saveResidence, useResidenceSelection } from "@/lib/sirah/use-residence";
import { Footer } from "../footer";
import { Experience } from "../motion/experience";
import { Nav } from "../nav";
import { liveLinks, type SiteLinks } from "../site-links";
import { SiteLinksProvider } from "../site-links-context";
import { Eyebrow, SectionHeading } from "../section-heading";
import { activeCampaign, copy, courseConfig, learningOutcomes, sectionLinks } from "./content";
import { Fees } from "./fees";
import { SeerahHero } from "./hero";
import { Method } from "./method";
import { PaymentBanner } from "./payment-banner";
import { CoursePreview } from "./preview";
import { RegisterButton, registerHref } from "./register";
import { Topics } from "./topics";
import s from "./seerah.module.css";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

export type SeerahPageProps = {
  initialCampaign: "orientation" | "enrolment";
  pakistanOnlineAvailable?: boolean;
  visitorCountry?: string;
  availability?: Record<string, Record<string, boolean>>;
  paymentReceived?: { reference: string | null };
  /** [code, name] for the residence select, sorted; built on the server. */
  countryOptions: [string, string][];
  /** Live routes by default. */
  site?: SiteLinks;
};

/* Section sub-nav: marks the section under the upper third of the viewport. */
function useActiveSection() {
  const [active, setActive] = useState("overview");
  useEffect(() => {
    const els = sectionLinks.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-25% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return active;
}

/** The Sīrah course page in Indigo Geometry. Data wiring mirrors
 * components/seerah/seerah-page.tsx exactly: residence (GeoIP + saved
 * choice), the hero region rule, campaign switch, plan availability,
 * Pakistan online-payment flag, payment-received banner, consultation
 * routing and every analytics event. Only the presentation is new. */
export function SeerahPage({
  initialCampaign,
  pakistanOnlineAvailable,
  visitorCountry,
  availability,
  paymentReceived,
  countryOptions,
  site = liveLinks,
}: SeerahPageProps) {
  const { country, hasResidence } = useResidenceSelection(visitorCountry);
  // Without a known residence, registration asks for the billing country.
  const needsCountryChoice = !hasResidence;
  const heroCountry = hasResidence ? country : undefined;
  const [orientation, setOrientation] = useState(initialCampaign === "orientation");
  useEffect(() => {
    const update = () => setOrientation(activeCampaign() === "orientation");
    update();
    const t = window.setInterval(update, 30000);
    return () => window.clearInterval(t);
  }, []);
  const active = useActiveSection();
  const cfg = courseConfig;

  return (
    <SiteLinksProvider value={site}>
      <div className={s.page} data-experience="">
        <span data-progress="" aria-hidden="true" />
        <a href="#overview" className={s.skip}>
          Skip to course content
        </a>
        <Nav
          site={site}
          support={{ ...copy.sponsor, href: copy.sponsor.href.replace("/support-our-mission", site.support) }}
          enrol={{
            href: registerHref({ country: heroCountry, requireBillingCountry: needsCountryChoice, base: site.register }),
            label: "Register for the course",
          }}
        />
        {paymentReceived ? <PaymentBanner reference={paymentReceived.reference} /> : null}

        <nav className={s.subnav} aria-label="Course sections">
          <div className={s.subnavInner}>
            <a className={s.subnavBrand} href="#overview">
              Sīrah <span>/ Beyond Chronology</span>
            </a>
            <div className={s.subnavLinks}>
              {sectionLinks.map(([id, label]) => (
                <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined}>
                  {label}
                </a>
              ))}
            </div>
          </div>
        </nav>

        <main id="main">
          <SeerahHero heroCountry={heroCountry} needsCountryChoice={needsCountryChoice} />

          {orientation ? (
            <aside className={s.orientation} aria-label="Free orientation schedule">
              <div className={s.wrap}>
                <div className={s.orientationCard}>
                  <div>
                    <p className={s.kicker}>Your first step</p>
                    <p className={s.orientationTitle}>Free Orientation</p>
                  </div>
                  <p className={s.orientationWhen}>
                    <strong>{cfg.orientation.date}</strong>
                    <span>{cfg.orientation.duration} · Separate from the weekly class schedule</span>
                  </p>
                  <ul className={s.times}>
                    {cfg.orientation.times.map((t) => (
                      <li key={t.region}>
                        <strong>{t.time}</strong>
                        <span>{t.region}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </aside>
          ) : null}

          {/* 02 · The learning */}
          <section className={s.section} aria-labelledby="learning-title">
            <div className={`${s.wrap} ${s.learnGrid}`}>
              <div data-reveal="">
                <CoursePreview country={country} />
              </div>
              <div>
                <div data-reveal="">
                  <Eyebrow>{copy.learning.eyebrow}</Eyebrow>
                  <h2 id="learning-title" className={s.h2}>
                    {copy.learning.titleA} <em>{copy.learning.titleB}</em>
                  </h2>
                  <p className={s.lead}>{copy.learning.lead}</p>
                  <p className={s.body}>{copy.learning.body}</p>
                </div>
                <ol className={s.outcomes}>
                  {learningOutcomes.map((o, k) => (
                    <li key={o.title} data-reveal="" style={i(k)}>
                      <span className={s.outcomeNo}>0{k + 1}</span>
                      <h3>{o.title}</h3>
                      <p>{o.text}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          {/* 03 · Topics */}
          <section id="topics" className={`${s.section} ${s.patterned}`} aria-labelledby="topics-title">
            <div className={s.wrap}>
              <SectionHeading
                id="topics-title"
                eyebrow={copy.topics.eyebrow}
                title={
                  <>
                    {copy.topics.titleA} <em>{copy.topics.titleB}</em>
                  </>
                }
                lede={copy.topics.intro}
              />
              <div data-reveal="">
                <Topics />
              </div>
            </div>
          </section>

          {/* 04 · Course details: the method, then the essentials */}
          <section id="course-details" className={s.section} aria-labelledby="details-title">
            <div className={s.wrap}>
              <SectionHeading
                id="details-title"
                eyebrow={copy.details.eyebrow}
                title={
                  <>
                    {copy.details.titleA} <em>{copy.details.titleB}</em>
                  </>
                }
                lede={copy.details.intro}
              />
              <div data-reveal="">
                <Method />
              </div>
              {cfg.curriculum.length > 0 ? (
                <div className={s.curriculum}>
                  <h3>The curriculum</h3>
                  {cfg.curriculum.map((panel, k) => (
                    <details key={panel.title} open={k === 0}>
                      <summary>{panel.title}</summary>
                      <ul>
                        {panel.topics.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              ) : null}
              {cfg.instructor ? (
                <article className={s.instructor}>
                  <Image
                    src={cfg.instructor.portrait.src}
                    alt={cfg.instructor.portrait.alt}
                    width={cfg.instructor.portrait.width}
                    height={cfg.instructor.portrait.height}
                    className={s.portrait}
                  />
                  <p className={s.kicker}>Your instructor</p>
                  <h3>{cfg.instructor.name}</h3>
                  <p>{cfg.instructor.bio}</p>
                </article>
              ) : null}
              {cfg.features.length > 0 ? (
                <ul className={s.features} data-reveal="">
                  {cfg.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>

          <Fees
            country={country}
            onCountryChange={saveResidence}
            countryOptions={countryOptions}
            availability={availability}
            pakistanOnlineAvailable={pakistanOnlineAvailable}
          />

          {/* 06 · FAQs */}
          <section id="faqs" className={s.section} aria-labelledby="faq-title">
            <div className={`${s.wrap} ${s.faqGrid}`}>
              <div data-reveal="">
                <Eyebrow>{copy.faqs.eyebrow}</Eyebrow>
                <h2 id="faq-title" className={s.h2}>
                  {copy.faqs.titleA} <em>{copy.faqs.titleB}</em>
                </h2>
                <p className={s.body}>
                  Have another question? <a href="mailto:admin@tgaawakening.com">Contact the team ↗</a>
                </p>
              </div>
              <div className={s.faqs} data-reveal="">
                {orientation ? (
                  <details>
                    <summary>When is the free orientation?</summary>
                    <p>
                      {cfg.orientation.date}. {cfg.orientation.times.map((t) => `${t.time} ${t.region}`).join(" · ")}. Duration:{" "}
                      {cfg.orientation.duration.toLowerCase()}. This is separate from the weekly course schedule.
                    </p>
                  </details>
                ) : null}
                <details>
                  <summary>What will I study?</summary>
                  <p>{copy.faqs.study}</p>
                </details>
                {cfg.faqs.map((f) => (
                  <details key={f.question}>
                    <summary>{f.question}</summary>
                    <p>{f.answer}</p>
                  </details>
                ))}
                <details>
                  <summary>Can I request fee support?</summary>
                  <p>
                    Yes. Use the <a href={cfg.feeSupportUrl}>confidential fee-support application</a> to contact the team
                    about your circumstances.
                  </p>
                </details>
              </div>
            </div>
          </section>

          {/* Closing */}
          <section className={s.section} aria-labelledby="closing-title">
            <div className={s.wrap}>
              <div className={s.closing} data-reveal="">
                <span className={s.closingSeal} aria-hidden="true" />
                <Eyebrow>{copy.closing.eyebrow}</Eyebrow>
                <h2 id="closing-title" className={s.closingTitle}>
                  {copy.closing.titleA} <em>{copy.closing.titleB}</em>
                </h2>
                <div className={s.closingActions}>
                  <RegisterButton placement="closing" country={heroCountry} requireBillingCountry={needsCountryChoice} />
                </div>
              </div>
            </div>
          </section>
        </main>

        <Footer site={site} />

        {/* Phones: the register action stays in reach. */}
        <div className={s.mobileBar}>
          <RegisterButton placement="mobile-sticky" country={heroCountry} requireBillingCountry={needsCountryChoice} block />
        </div>
        <Experience />
      </div>
    </SiteLinksProvider>
  );
}
