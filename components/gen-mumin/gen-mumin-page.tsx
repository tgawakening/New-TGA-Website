import Image from "next/image";
import Link from "next/link";
import { Header, Footer } from "@/components/home/sections";
import { muminsSteps } from "@/components/home/data";

const promisePoints = [
  {
    title: "Faith-rooted confidence",
    copy: "Children learn to love the Prophet, the Qur'an, and their Muslim identity with warmth, joy, and clarity.",
  },
  {
    title: "Beautiful learning habits",
    copy: "Every program is built around steady routines, engaging activities, and age-appropriate understanding.",
  },
  {
    title: "Leadership with adab",
    copy: "The journey is designed to nurture courage, communication, service, and responsibility from an Islamic lens.",
  },
];

const featureCards = [
  {
    title: "Mission & Vision",
    copy: "Gen-Mumin is being built to raise a generation of thoughtful, grounded, and purpose-driven young Muslims who can lead with ihsan.",
  },
  {
    title: "Teaching Philosophy",
    copy: "We combine Islamic knowledge, storytelling, reflective practice, and practical skill-building so learning feels alive and relevant.",
  },
  {
    title: "Program Journey",
    copy: "From Seerah to Arabic, Tajweed, and leadership, each stage helps children grow in understanding, expression, and confidence.",
  },
];

const highlights = [
  "Interactive classes with clear age-appropriate delivery",
  "Seerah-inspired identity building and love for the Prophet",
  "Arabic and Qur'an foundations connected to daily practice",
  "Leadership and life-skill nurturing for future Muslim contributors",
];

export default function GenMuminPage() {
  return (
    <div className="ga-page ga-gen-page">
      <Header />
      <main>
        <section className="ga-section ga-gen-hero-section">
          <div className="ga-container ga-gen-shell">
            <div className="ga-gen-topbar">
              <span className="ga-gen-kicker">Projects / Gen-Mumin</span>
              <Link href="/projects/gen-mumin" className="ga-gen-top-cta">
                Coming Soon
              </Link>
            </div>

            <div className="ga-gen-hero-grid">
              <div className="ga-gen-copy">
                <span className="ga-gen-badge">A TGA Project For Young Muslim Growth</span>
                <h1 className="ga-gen-title">
                  Raising confident and thoughtful Muslim children through a beautiful, guided learning journey.
                </h1>
                <p className="ga-gen-lead">
                  Gen-Mumin is a child-focused pathway that introduces Seerah, Arabic, Tajweed, and leadership in a
                  warm, structured, and inspiring format. This page gives your family a clear overview of what the
                  program is building before full enrolment opens.
                </p>

                <div className="ga-gen-actions">
                  <span className="ga-gen-primary-cta">Coming Soon</span>
                  <Link href="#gen-mumin-programs" className="ga-gen-secondary-cta">
                    Explore Program Overview
                  </Link>
                </div>

                <div className="ga-gen-promise-grid">
                  {promisePoints.map((item) => (
                    <article key={item.title} className="ga-gen-promise-card">
                      <strong>{item.title}</strong>
                      <p>{item.copy}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="ga-gen-visual-card">
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
                <div className="ga-gen-visual-note">
                  <span>Program Status</span>
                  <strong>Launching Soon</strong>
                  <p>Overview page is live now so TGA families can understand the direction, benefits, and journey.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ga-section ga-gen-story-section">
          <div className="ga-container ga-gen-shell">
            <div className="ga-gen-section-head">
              <span className="ga-gen-section-kicker">Why Gen-Mumin</span>
              <h2>Built to give children a purposeful start in deen, character, and expression.</h2>
              <p>
                This project is designed as a summarized but meaningful entry point for parents who want an
                integrated Islamic learning experience instead of isolated subjects.
              </p>
            </div>

            <div className="ga-gen-feature-grid">
              {featureCards.map((card) => (
                <article key={card.title} className="ga-gen-feature-card">
                  <h3>{card.title}</h3>
                  <p>{card.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="gen-mumin-programs" className="ga-section ga-gen-program-section">
          <div className="ga-container ga-gen-shell">
            <div className="ga-gen-section-head">
              <span className="ga-gen-section-kicker">Program Overview</span>
              <h2>A child-friendly roadmap from identity to skill-building.</h2>
              <p>
                The Gen-Mumin journey introduces children to the Prophet&apos;s example, Arabic foundations, Qur&apos;an
                recitation, and leadership habits in a connected and easy-to-follow progression.
              </p>
            </div>

            <div className="ga-gen-program-grid">
              {muminsSteps.map((step, index) => (
                <article key={step.id} className="ga-gen-program-card">
                  <div className="ga-gen-program-top">
                    <span className="ga-gen-program-index">0{index + 1}</span>
                    <span className="ga-gen-program-next">Next: {step.next}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p className="ga-gen-program-subtitle">{step.subtitle}</p>
                  <div className="ga-gen-program-points">
                    {step.points.map((point) => (
                      <span key={point}>{point}</span>
                    ))}
                  </div>
                  <div className="ga-gen-program-stats">
                    {step.stats.map((stat) => (
                      <span key={stat}>{stat}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ga-section ga-gen-philosophy-section">
          <div className="ga-container ga-gen-shell ga-gen-philosophy-grid">
            <div className="ga-gen-philosophy-card ga-gen-philosophy-main">
              <span className="ga-gen-section-kicker">Teaching Style</span>
              <h2>Gentle, engaging, and centered on understanding rather than information overload.</h2>
              <p>
                Gen-Mumin aims to make young learners feel seen and inspired. Lessons are intended to be visual,
                encouraging, and rooted in practical takeaways that families can continue beyond class time.
              </p>
              <div className="ga-gen-highlight-list">
                {highlights.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>

            <div className="ga-gen-philosophy-card ga-gen-philosophy-side">
              <span className="ga-gen-section-kicker">For Families</span>
              <h3>A clear preview before enrollment opens</h3>
              <p>
                Full registrations will later connect to the dedicated Gen-Mumin site. For now, this overview helps
                TGA families understand the purpose, tone, and expected learning journey.
              </p>
              <span className="ga-gen-inline-cta">Coming Soon</span>
            </div>
          </div>
        </section>

        <section className="ga-section ga-gen-cta-section">
          <div className="ga-container ga-gen-shell">
            <article className="ga-gen-banner-card">
              <div>
                <span className="ga-gen-section-kicker">Join The Next Phase</span>
                <h2>Gen-Mumin enrollment will open soon.</h2>
                <p>
                  Until the full Gen-Mumin site is ready, this page serves as the main summary for TGA families who
                  want to understand the vision and future learning path.
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
