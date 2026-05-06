import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/home/sections";
import { muminsSteps } from "@/components/home/data";

type IconKind = "mission" | "method" | "journey" | "seerah" | "arabic" | "tajweed" | "leadership";

const heroCards = [
  {
    title: "Faith-first confidence",
    copy: "A warm path that helps children love their Muslim identity and practise adab with clarity.",
    icon: "mission" as const,
    tone: "navy",
  },
  {
    title: "Orientation access",
    copy: "Join the WhatsApp community now. Orientation session links and updates will be shared there.",
    icon: "method" as const,
    tone: "orange",
  },
  {
    title: "Clear growth journey",
    copy: "Arabic, Tajweed, Seerah, character, and life skills are introduced as one connected journey.",
    icon: "journey" as const,
    tone: "amber",
  },
];

const programAccents: Record<string, string> = {
  seerah: "Stories, identity, prophetic love",
  arabic: "Language, reading, Qur'an connection",
  tajweed: "Recitation, beauty, precision",
  leadership: "Character, courage, responsibility",
};

const iconMap: Record<string, IconKind> = {
  seerah: "seerah",
  arabic: "arabic",
  tajweed: "tajweed",
  leadership: "leadership",
};

const whatsappHref = "https://chat.whatsapp.com/EX6fgdY6b4T9XRwpGNkfoU";
const youtubeEmbedHref = "https://www.youtube.com/embed/dDoOINvjVoQ";

const orientationStats = [
  { value: "4", label: "Learning areas" },
  { value: "6-12", label: "Age focus" },
  { value: "Live", label: "Orientation" },
  { value: "Open", label: "Registrations" },
];

const orientationHighlights = [
  "Arabic and Tajweed foundations",
  "Seerah stories and prophetic love",
  "Character building with Islamic values",
  "Life skills for confident young Muslims",
];

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
            <Link href="#gen-mumin-about">Overview</Link>
            <Link href="#gen-mumin-programs">Programs</Link>
            <Link href="#gen-mumin-video">Intro</Link>
          </nav>

          <Link href={whatsappHref} className="ga-gen-header-cta" target="_blank" rel="noreferrer">
            Join WhatsApp
          </Link>
        </div>
        <div className="ga-container ga-gen-header-note">
          <span>Orientation session links will be shared inside the Gen-M community.</span>
          <Link href={whatsappHref} target="_blank" rel="noreferrer">
            Join the community
          </Link>
        </div>
      </header>

      <main>
        <section className="ga-gen-hero-wrap">
          <div className="ga-container">
            <div className="ga-gen-hero-panel">
              <div className="ga-gen-hero-copy">
                <span className="ga-gen-badge">Gen-Mumin Orientation - Registrations Open</span>
                <h1 className="ga-gen-title">Go Beyond Ordinary Education</h1>
                <p className="ga-gen-lead">
                  A child-focused journey for confident Muslim identity, Qur&apos;an connection, Seerah love, character,
                  and practical life skills. Join the WhatsApp community to receive the orientation session link.
                </p>
                <div className="ga-gen-hero-proof" aria-label="Gen-Mumin highlights">
                  <span>Arabic & Tajweed</span>
                  <span>Seerah</span>
                  <span>Character</span>
                  <span>Life Skills</span>
                </div>

                <div className="ga-gen-hero-actions">
                  <Link href={whatsappHref} className="ga-gen-primary-cta" target="_blank" rel="noreferrer">
                    Join Gen-M Community
                  </Link>
                  <Link href={whatsappHref} className="ga-gen-secondary-cta" target="_blank" rel="noreferrer">
                    Get Orientation Updates
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

        <section id="gen-mumin-about" className="ga-section ga-gen-about-section">
          <div className="ga-container ga-gen-about-grid">
            <div className="ga-gen-about-poster">
              <Image
                src="/gen-mumin-orientation.jpeg"
                alt="Gen-Mumin orientation poster"
                width={1080}
                height={1350}
                className="ga-gen-about-image"
              />
            </div>
            <div className="ga-gen-about-copy">
              <span className="ga-gen-section-kicker">Orientation Invite</span>
              <h2>Reserve attention now. The session link is shared in WhatsApp.</h2>
              <p>
                Gen-Mumin introduces children to a guided Islamic development pathway that blends learning, confidence,
                values, and practical habits families can continue at home.
              </p>
              <div className="ga-gen-stat-grid">
                {orientationStats.map((item) => (
                  <div key={item.label} className="ga-gen-stat-card">
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="ga-gen-highlight-list">
                {orientationHighlights.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
              <Link href={whatsappHref} className="ga-gen-primary-cta" target="_blank" rel="noreferrer">
                Join WhatsApp for Orientation
              </Link>
            </div>
          </div>
        </section>

        <section id="gen-mumin-programs" className="ga-section ga-gen-program-section">
          <div className="ga-container ga-gen-section-head ga-gen-section-head-centered">
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
                  <span className="ga-gen-program-aura" aria-hidden />
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
                  <p className="ga-gen-program-accent-copy">{programAccents[step.id] ?? step.next}</p>

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

        <section id="gen-mumin-video" className="ga-section ga-gen-video-section">
          <div className="ga-container">
            <div className="ga-gen-section-head ga-gen-section-head-centered">
              <span className="ga-gen-section-kicker">Channel Intro</span>
              <h2>Meet the Gen-Mumin learning vision.</h2>
              <p>
                Watch the intro and get a quick feel for the project, its energy, and the learning journey families can
                now join.
              </p>
            </div>

            <div className="ga-gen-video-card">
              <div className="ga-gen-video-frame">
                <iframe
                  src={youtubeEmbedHref}
                  title="Gen-Mumin YouTube channel intro"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </section>

        <section className="ga-section ga-gen-cta-section">
          <div className="ga-container">
            <article className="ga-gen-banner-card">
              <div>
                <span className="ga-gen-section-kicker">Next Step</span>
                <h2>Join the Gen-M community for orientation access.</h2>
                <p>
                  The orientation session link and important updates will be shared in the WhatsApp community. Join now
                  so your family does not miss the announcement.
                </p>
              </div>
              <div className="ga-gen-banner-actions">
                <Link href={whatsappHref} className="ga-gen-primary-cta" target="_blank" rel="noreferrer">
                  Join Our Gen-M Community
                </Link>
                <Link href={whatsappHref} className="ga-gen-secondary-cta" target="_blank" rel="noreferrer">
                  Get Session Link Updates
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
