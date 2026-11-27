import Image from "next/image";
import type { CSSProperties } from "react";
import { Button } from "../button";
import { Card } from "../card";
import { Footer } from "../footer";
import { Experience } from "../motion/experience";
import { Nav } from "../nav";
import { liveLinks, type SiteLinks } from "../site-links";
import { Rosette } from "../ornaments";
import { Eyebrow, SectionHeading } from "../section-heading";
import { closing, hero, launch, links, offer, path, preview, programmes, transformations } from "./content";
import { Programmes } from "./programmes";
import { VideoButton } from "./video";
import s from "./projects.module.css";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/* Signature moment one: from → to. The live page's three transformations
 * as kinetic type: each "from" word steps back and is struck through, its
 * "to" word rises into place. Pure CSS on first paint, staggered line by line. */
function Transformations() {
  return (
    <figure className={s.shift} aria-label="What Gen Mumin changes">
      <ol>
        {transformations.map((t, k) => (
          <li key={t.from} className={s.shiftRow} style={{ "--k": k } as CSSProperties}>
            <span className={s.shiftFrom}>
              <span className={s.srOnly}>From </span>
              {t.from}
              <span className={s.strike} aria-hidden="true" />
            </span>
            <span className={s.shiftArrow} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 12h15M14 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className={s.shiftTo}>
              <span className={s.srOnly}> to </span>
              {t.to}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

/** `site`: live routes by default; the hidden preview passes its own. */
export function ProjectsPage({ site = liveLinks }: { site?: SiteLinks }) {
  return (
    <div className={s.page} data-experience="">
      <span data-progress="" aria-hidden="true" />
      <a href="#main" className={s.skip}>
        Skip to content
      </a>

      {/* The live offer strip, above the nav */}
      <aside className={s.offerStrip} aria-label="Launch offer">
        <div className={s.offerInner}>
          <span className={s.offerBadge}>{offer.badge}</span>
          <strong>{offer.headline}</strong>
          <span className={s.offerCode}>
            Use code <b>{offer.code}</b>: <s>{offer.was}</s> <b>{offer.now}</b>
          </span>
          <a className={s.offerLink} href={links.registration}>
            Register now <span aria-hidden="true">→</span>
          </a>
        </div>
      </aside>

      <Nav
        site={site}
        enrol={{ href: links.registration, label: "Register now" }}
      />

      <main id="main">
        {/* Hero */}
        <section className={s.hero} aria-labelledby="gm-title">
          <div className={`${s.wrap} ${s.heroGrid}`}>
            <div className={s.heroCopy}>
              <div className={s.heroBrand} data-rise="" style={i(0)}>
                <Image src="/gen-mumin logo.webp" alt="Gen Mumins" width={156} height={88} className={s.gmLogo} priority />
                <Eyebrow>{hero.badge}</Eyebrow>
              </div>
              <h1 id="gm-title" className={s.heroTitle} data-rise="" style={i(1)}>
                Empowered Muslim children, <em>not just educated children.</em>
              </h1>
              <p className={s.heroLede} data-rise="" style={i(2)}>
                {hero.lede}
              </p>
              <ul className={s.pills} data-rise="" style={i(3)}>
                {hero.pills.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <div className={s.actions} data-rise="" style={i(4)}>
                <Button href={links.registration} arrow>Register now</Button>
                <VideoButton which="orientation" label="Watch orientation session" />
              </div>
            </div>
            <Transformations />
          </div>
        </section>

        {/* Launch offer */}
        <section id="gen-mumin-overview" className={`${s.section} ${s.patterned}`} aria-labelledby="launch-title">
          <div className={s.wrap}>
            <Card variant="feature" className={s.launch} data-reveal="">
              <div className={s.launchCopy}>
                <Eyebrow>{launch.kicker}</Eyebrow>
                <h2 id="launch-title" className={s.h2}>
                  {launch.title}
                </h2>
                <p className={s.body}>{launch.body}</p>
                <ul className={s.areas} aria-label="The five programme areas">
                  {programmes.map((p) => (
                    <li key={p.id} style={{ "--accent": p.accent } as CSSProperties}>
                      {p.title}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={s.launchPrice}>
                <div className={s.priceCard}>
                  <span className={s.priceLabel}>Launch price</span>
                  <p className={s.priceLine}>
                    <s>{offer.was}</s>
                    <strong>{offer.now}</strong>
                  </p>
                </div>
                <div className={s.codeCard}>
                  <span className={s.priceLabel}>Early bird discount</span>
                  <strong className={s.codePct}>25% OFF</strong>
                  <span className={s.codeChip}>
                    Use code <b>{offer.code}</b>
                  </span>
                </div>
                <div className={s.launchActions}>
                  <Button href={links.registration} arrow block>
                    Register with {offer.code}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* The five-fold path */}
        <section id="gen-mumin-programs" className={s.section} aria-labelledby="path-title">
          <div className={s.wrap}>
            <SectionHeading id="path-title" eyebrow={path.kicker} title={path.title} lede={path.lede} />
            <div data-reveal="">
              <Programmes />
            </div>
          </div>
        </section>

        {/* Orientation preview: the film, loaded only on play */}
        <section id="gen-mumin-video" className={s.section} aria-labelledby="preview-title">
          <div className={s.wrap}>
            <div className={s.preview} data-reveal="">
              <Rosette className={s.previewRosette} accentClassName={s.previewAccent} />
              <div className={s.previewCopy}>
                <Eyebrow>{preview.kicker}</Eyebrow>
                <h2 id="preview-title" className={s.h2}>
                  {preview.title}
                </h2>
                <p className={s.body}>{preview.body}</p>
                <div className={s.actions}>
                  <VideoButton which="intro" label="Watch intro video" variant="teal" />
                  <VideoButton which="orientation" label="Orientation session" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className={s.section} aria-labelledby="closing-title">
          <div className={s.wrap}>
            <Card variant="feature" className={s.closing} data-reveal="">
              <Eyebrow>{closing.kicker}</Eyebrow>
              <h2 id="closing-title" className={s.closingTitle}>
                {closing.title}
              </h2>
              <p className={s.body}>
                Use code <b>{offer.code}</b> for the early bird launch offer. Register now to secure your
                place.
              </p>
              <div className={`${s.actions} ${s.center}`}>
                <Button href={links.registration} arrow>
                  Enroll now
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
