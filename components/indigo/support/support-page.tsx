import type { CSSProperties } from "react";
import type { MissionSupportConfig } from "@/lib/mission-support-config";
import { missionAllocationNotice, missionContributionPolicyPath } from "@/lib/mission-contribution-policy";
import { Button } from "../button";
import { Card } from "../card";
import { Footer } from "../footer";
import { Experience } from "../motion/experience";
import { Nav } from "../nav";
import { liveLinks, type SiteLinks } from "../site-links";
import { Rosette, SealMark, Star8 } from "../ornaments";
import { Eyebrow, SectionHeading } from "../section-heading";
import { CauseMark, CausePick, GiveButton, ReturnStatus, StickyGive } from "./actions";
import { companyRegisterUrl, faqs, fundingAreas, hero, impactCopy, learningPrinciples, missionContactEmail, purposeCopy } from "./content";
import { GivingForm, type Country, type ManualAccounts } from "./giving-form";
import { GivingProvider, type ReturnParams } from "./giving-state";
import { Journey } from "./journey";
import s from "./support.module.css";

const i = (n: number) => ({ "--i": n }) as CSSProperties;
const areaGlyph = [Star8, Rosette, SealMark];

/** `site`: live routes by default. Every giving link, policy link and API
 * call is the live one. */
export function SupportPage({
  config,
  params,
  countries,
  accounts,
  site = liveLinks,
}: {
  config: MissionSupportConfig;
  params: ReturnParams;
  countries: Country[];
  accounts: ManualAccounts;
  site?: SiteLinks;
}) {
  const contributionTermsUrl = config.policyUrl || missionContributionPolicyPath;
  const allocationSummary = config.allocationNotice || missionAllocationNotice;

  return (
    <GivingProvider params={params}>
      <div className={s.page} data-experience="">
        <span data-progress="" aria-hidden="true" />
        <a href="#mission-giving" className={s.skip}>
          Skip to contribution form
        </a>

        <Nav site={site} support={{ href: "#mission-giving", label: "Give now" }} />

        <main id="main">
          <ReturnStatus />

          {/* Hero, with the form beside it (below it on phones) as on live */}
          <section className={s.hero} aria-labelledby="mission-title">
            <Rosette className={s.heroRosette} accentClassName={s.heroRosetteAccent} />
            <div className={`${s.wrap} ${s.heroGrid}`}>
              <div className={s.heroCopy}>
                <div data-rise="" style={i(0)}>
                  <Eyebrow>{hero.kicker}</Eyebrow>
                </div>
                <h1 id="mission-title" className={s.heroTitle} data-rise="" style={i(1)}>
                  Help shape the <em>next generation.</em>
                </h1>
                <p className={s.heroLede} data-rise="" style={i(2)}>
                  {hero.lede}
                </p>
                <div className={s.actions} data-rise="" style={i(3)}>
                  <GiveButton>Support meaningful learning</GiveButton>
                </div>
                <div className={s.foundation} data-rise="" style={i(4)}>
                  <p>
                    Rooted in knowledge. <em>Guided by purpose.</em>
                  </p>
                  <span>{hero.foundation}</span>
                  <a href="#mission-programmes">Explore the learning behind the mission</a>
                </div>
              </div>
              <GivingForm config={config} countries={countries} accounts={accounts} />
            </div>
          </section>

          {/* More than a course */}
          <section className={`${s.section} ${s.patterned}`} aria-labelledby="purpose-title">
            <div className={s.wrap}>
              <SectionHeading
                id="purpose-title"
                eyebrow={purposeCopy.kicker}
                title={
                  <>
                    More than a course. <em className={s.accentEm}>An investment in generations.</em>
                  </>
                }
                lede={purposeCopy.lede}
              />
              <ol className={s.principles}>
                {learningPrinciples.map((p, k) => (
                  <li key={p.title} data-reveal="" style={{ "--d": k } as CSSProperties}>
                    <span className={s.principleNo}>0{k + 1}</span>
                    <h3>{p.title}</h3>
                    <p>{p.copy}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Funding areas */}
          <section id="mission-purposes" className={s.section} aria-labelledby="purposes-title">
            <div className={s.wrap}>
              <SectionHeading id="purposes-title" eyebrow="Three ways to support purposeful education" title="Choose where your support matters." />
              <div className={s.causes}>
                {fundingAreas.map((area, k) => {
                  const Glyph = areaGlyph[k];
                  return (
                    <Card key={area.id} className={s.cause} data-reveal="">
                      <CauseMark id={area.id}>
                        <span className={s.causeGlyph} aria-hidden="true">
                          <Glyph className={s.causeGlyphSvg} />
                        </span>
                        <span className={s.causeNo}>0{k + 1}</span>
                        <h3>{area.title}</h3>
                        <p>{area.copy}</p>
                        <CausePick id={area.id} />
                      </CauseMark>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>

          {/* The thread */}
          <section className={s.section} aria-labelledby="impact-title">
            <div className={s.wrap}>
              <SectionHeading id="impact-title" eyebrow={impactCopy.kicker} title={impactCopy.title} lede={impactCopy.lede} />
              <Journey />
              <p className={s.caption}>{impactCopy.caption}</p>
            </div>
          </section>

          {/* The learning behind the mission */}
          <section id="mission-programmes" className={`${s.section} ${s.patterned}`} aria-labelledby="programmes-title">
            <div className={s.wrap}>
              <SectionHeading
                id="programmes-title"
                eyebrow="Guidance that reaches beyond a lesson"
                title={
                  <>
                    Online education. <em className={s.accentEm}>Purpose beyond the screen.</em>
                  </>
                }
                lede="Guided online learning that connects Islamic knowledge with everyday character and service."
              />
              <div className={s.programmes}>
                <Card variant="feature" className={s.programme} data-reveal="">
                  <Eyebrow>Gen-Mu’min</Eyebrow>
                  <h3>Knowledge, character and community.</h3>
                  <p>Arabic-Tajweed, Seerah, life skills and leadership sit alongside community building and parental sessions. The programme brings purposeful learning into family life.</p>
                  <Button href={site.projects} variant="ghost" arrow>
                    Explore Gen-Mu’min
                  </Button>
                </Card>
                <Card variant="feature" className={s.programme} data-reveal="">
                  <Eyebrow>Seerah &amp; Prophetic leadership</Eyebrow>
                  <h3>Guidance for thoughtful action.</h3>
                  <p>Study the Prophetic example and reflect on responsibility, relationships and leadership through TGA’s online educational work.</p>
                  <Button href={site.seerah} variant="ghost" arrow>
                    Explore Seerah
                  </Button>
                </Card>
              </div>
              <p className={s.caption}>Future initiatives will build on TGA’s educational mission. Contact the team about current plans and funding needs.</p>
            </div>
          </section>

          {/* Trust & transparency */}
          <section className={s.section} aria-labelledby="accountability-title">
            <div className={`${s.wrap} ${s.trust}`}>
              <div data-reveal="">
                <Eyebrow>Trust &amp; transparency</Eyebrow>
                <h2 id="accountability-title" className={s.h2}>
                  Know where your contribution goes.
                </h2>
                <p className={s.body}>{allocationSummary}</p>
                <ul className={s.trustLinks}>
                  <li><a href={contributionTermsUrl} target="_blank" rel="noopener noreferrer">Contribution &amp; Donation Policy <span aria-hidden="true">↗</span></a></li>
                  <li><a href={companyRegisterUrl + "/filing-history"} target="_blank" rel="noopener noreferrer">Public company filings <span aria-hidden="true">↗</span></a></li>
                  {config.impactReportUrl && <li><a href={config.impactReportUrl} target="_blank" rel="noopener noreferrer">Verified impact report <span aria-hidden="true">↗</span></a></li>}
                  <li><a href={"mailto:" + missionContactEmail}>Ask about funding <span aria-hidden="true">→</span></a></li>
                </ul>
              </div>
              <aside className={s.record} aria-label="Organisation details" data-reveal="">
                <div className={s.recordHead}>
                  <SealMark className={s.recordMark} />
                  <span>Organisation record</span>
                </div>
                <h3>GLOBAL AWAKENING CIC</h3>
                <p>Community Interest Company<br />Registered in England and Wales<br />Company number <strong>15523255</strong></p>
                <p>Registered office<br />128 City Road, London, EC1V 2NX</p>
                <a href={companyRegisterUrl} target="_blank" rel="noopener noreferrer">View company record <span aria-hidden="true">↗</span></a>
                <small>Gift Aid is not offered on this page.</small>
              </aside>
            </div>
          </section>

          {/* Monthly */}
          <section className={s.section} aria-labelledby="monthly-title">
            <div className={s.wrap}>
              <Card variant="feature" className={s.monthly} data-reveal="">
                <div>
                  <Eyebrow>Steady support for ongoing learning</Eyebrow>
                  <h2 id="monthly-title" className={s.h2}>Help good work continue.</h2>
                  <p className={s.body}>Give monthly to help sustain scholarships and online learning. Cancel future automatic payments at any time.</p>
                </div>
                <GiveButton monthly>Choose monthly support</GiveButton>
              </Card>
            </div>
          </section>

          {/* Closing */}
          <section className={s.section} aria-labelledby="closing-title">
            <div className={`${s.wrap} ${s.closing}`} data-reveal="">
              <Eyebrow>Knowledge shared. Character nurtured. Community served.</Eyebrow>
              <h2 id="closing-title" className={s.closingTitle}>Be part of what comes next.</h2>
              <p className={s.body}>Help a student in need access Islamic education, wherever they live.</p>
              <div className={`${s.actions} ${s.center}`}>
                <GiveButton>Support the Mission</GiveButton>
                <a className={s.btnGhost} href="#mission-programmes"><span>Explore Our Work</span></a>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className={s.section} aria-labelledby="faq-title">
            <div className={`${s.wrap} ${s.faq}`}>
              <div>
                <Eyebrow>A clear path to giving</Eyebrow>
                <h2 id="faq-title" className={s.h2}>Before you contribute</h2>
              </div>
              <div className={s.faqList}>
                {faqs.map(([q, a]) => (
                  <details key={q}>
                    <summary>
                      {q}
                      <span className={s.faqPlus} aria-hidden="true" />
                    </summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        </main>

        <Footer site={site} legalName="GLOBAL AWAKENING CIC" />
        <StickyGive />
        <Experience />
      </div>
    </GivingProvider>
  );
}
