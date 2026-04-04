import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/home/sections";
import { muminsSteps } from "@/components/home/data";

type IconKind = "mission" | "method" | "journey" | "seerah" | "arabic" | "tajweed" | "leadership";

const heroCards = [
  {
    title: "Mission-led learning",
    copy: "A child-focused Islamic journey that builds identity, adab, and confidence with clarity.",
    icon: "mission" as const,
    tone: "warm",
  },
  {
    title: "Gentle teaching method",
    copy: "Interactive delivery, memorable visuals, and practical lessons designed for young minds.",
    icon: "method" as const,
    tone: "sky",
  },
  {
    title: "Structured growth path",
    copy: "Seerah, Arabic, Tajweed, and leadership are introduced as one connected development journey.",
    icon: "journey" as const,
    tone: "lilac",
  },
];

const iconMap: Record<string, IconKind> = {
  seerah: "seerah",
  arabic: "arabic",
  tajweed: "tajweed",
  leadership: "leadership",
};

function GenMuminIcon({ kind }: { kind: IconKind }) {
  if (kind === "mission") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="14" fill="none" />
        <path d="M24 10v10" fill="none" />
        <path d="M24 24l8-6" fill="none" />
        <circle cx="24" cy="24" r="3" />
      </svg>
    );
  }

  if (kind === "method") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="10" y="12" width="28" height="22" rx="5" fill="none" />
        <path d="M16 22h16" fill="none" />
        <path d="M16 28h10" fill="none" />
        <path d="M20 34l-2 6" fill="none" />
        <path d="M28 34l2 6" fill="none" />
      </svg>
    );
  }

  if (kind === "journey") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M10 32c4-12 10-16 18-16 5 0 8 2 10 4" fill="none" />
        <path d="M28 16h10v10" fill="none" />
        <circle cx="12" cy="32" r="2.5" />
        <circle cx="24" cy="20" r="2.5" />
        <circle cx="38" cy="20" r="2.5" />
      </svg>
    );
  }

  if (kind === "seerah") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M13 34V16c0-2 1.5-3 3.5-3H35v18c0 2-1.5 3-3.5 3H13Z" fill="none" />
        <path d="M18 18h12" fill="none" />
        <path d="M18 24h12" fill="none" />
        <path d="M18 30h8" fill="none" />
      </svg>
    );
  }

  if (kind === "arabic") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M15 31c2-6 5-13 9-13 4 0 6 5 8 13" fill="none" />
        <path d="M16 31h16" fill="none" />
        <path d="M19 14h10" fill="none" />
      </svg>
    );
  }

  if (kind === "tajweed") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 12c6 0 11 5 11 11 0 8-11 14-11 14S13 31 13 23c0-6 5-11 11-11Z" fill="none" />
        <path d="M19 24c2 2 8 2 10 0" fill="none" />
        <path d="M20 19h8" fill="none" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="14" r="5" fill="none" />
      <path d="M16 35c1-7 5-11 8-11s7 4 8 11" fill="none" />
      <path d="M10 24l6 4" fill="none" />
      <path d="M38 24l-6 4" fill="none" />
    </svg>
  );
}

export default function GenMuminPage() {
  return (
    <div className="ga-page ga-gen-page">
      <header className="ga-gen-header">
        <div className="ga-container ga-gen-header-row">
          <div className="ga-gen-branding">
            <Link href="/" className="ga-gen-home-link">
              <span aria-hidden>&larr;</span>
              Main Site
            </Link>
            <Link href="/projects/gen-mumin" className="ga-gen-logo-link" aria-label="Gen-Mumin project page">
              <Image
                src="/gen-mumin logo.webp"
                alt="Gen-Mumin"
                width={224}
                height={72}
                className="ga-gen-logo"
                priority
              />
            </Link>
          </div>

          <nav className="ga-gen-nav" aria-label="Gen-Mumin sections">
            <Link href="#gen-mumin-programs">Programs</Link>
            <Link href="#program-seerah">Seerah</Link>
            <Link href="#program-arabic">Arabic</Link>
            <Link href="#program-tajweed">Tajweed</Link>
            <Link href="#program-leadership">Leadership</Link>
          </nav>

          <span className="ga-gen-header-cta">Coming Soon</span>
        </div>
      </header>

      <main>
        <section className="ga-gen-hero-wrap">
          <div className="ga-container">
            <div className="ga-gen-hero-panel">
              <div className="ga-gen-hero-copy">
                <span className="ga-gen-badge">TGA Project For Young Muslim Development</span>
                <h1 className="ga-gen-title">Raising confident and thoughtful Muslim children through a beautiful, guided learning journey.</h1>
                <p className="ga-gen-lead">
                  Gen-Mumin is being designed to help children grow in love for the Prophet, confidence in their Muslim
                  identity, and skill in Qur&apos;an, Arabic, and leadership through a clear and engaging path.
                </p>

                <div className="ga-gen-hero-actions">
                  <span className="ga-gen-primary-cta">Coming Soon</span>
                  <Link href="#gen-mumin-programs" className="ga-gen-secondary-cta">
                    View Programs
                  </Link>
                </div>
              </div>

              <div className="ga-gen-hero-media">
                <div className="ga-gen-image-frame">
                  <Image
                    src="/Gen-Mumin.jpeg"
                    alt="Gen-Mumin banner"
                    width={760}
                    height={960}
                    className="ga-gen-hero-image"
                    priority
                  />
                </div>
              </div>
            </div>

            <div className="ga-gen-hero-cards">
              {heroCards.map((card, index) => (
                <article key={card.title} className={`ga-gen-hero-card ga-gen-delay-${index + 1} is-${card.tone}`}>
                  <div className={`ga-gen-icon-shell is-${card.icon}`}>
                    <GenMuminIcon kind={card.icon} />
                  </div>
                  <h2>{card.title}</h2>
                  <p>{card.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="gen-mumin-programs" className="ga-section ga-gen-program-section">
          <div className="ga-container ga-gen-section-head">
            <span className="ga-gen-section-kicker">Programs</span>
            <h2>Four connected areas that help children grow in understanding, recitation, language, and character.</h2>
            <p>
              Each part of the journey is introduced in a short, interactive, and easy-to-follow way so families can
              quickly understand the full program path.
            </p>
          </div>

          <div className="ga-container ga-gen-program-grid">
            {muminsSteps.map((step, index) => {
              const iconKind = iconMap[step.id] ?? "leadership";

              return (
                <article
                  key={step.id}
                  id={`program-${step.id}`}
                  className={`ga-gen-program-card ga-gen-delay-${(index % 3) + 1} is-${step.id}`}
                >
                  <div className="ga-gen-program-card-head">
                    <div className={`ga-gen-icon-shell is-${iconKind}`}>
                      <GenMuminIcon kind={iconKind} />
                    </div>
                    <div>
                      <span className="ga-gen-program-index">0{index + 1}</span>
                      <h3>{step.title}</h3>
                    </div>
                  </div>

                  <p className="ga-gen-program-subtitle">{step.subtitle}</p>

                  <div className="ga-gen-program-points">
                    {step.points.slice(0, 3).map((point) => (
                      <span key={point}>{point}</span>
                    ))}
                  </div>

                  <div className="ga-gen-program-stats">
                    {step.stats.map((stat) => (
                      <span key={stat}>{stat}</span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="ga-section ga-gen-cta-section">
          <div className="ga-container">
            <article className="ga-gen-banner-card">
              <div>
                <span className="ga-gen-section-kicker">Next Step</span>
                <h2>Enrollment will be opened on the full Gen-Mumin site after launch.</h2>
                <p>
                  For now, this page gives the TGA audience a polished overview of the project, its themes, and what
                  families can expect from the program pathway.
                </p>
              </div>
              <span className="ga-gen-primary-cta">Coming Soon</span>
            </article>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
