"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/home/sections";

const registrationHref = "https://genmumin.com/registration";
const whatsappHref = "https://chat.whatsapp.com/EX6fgdY6b4T9XRwpGNkfoU";
const heroVideoEmbed = "https://www.youtube.com/embed/g4RwUl_eSlY";
const introVideoEmbed = "https://www.youtube.com/embed/dDoOINvjVoQ";
const orientationVideoAutoplay =
  "https://www.youtube.com/embed/dDoOINvjVoQ?autoplay=1&mute=1&controls=0&loop=1&playlist=dDoOINvjVoQ&playsinline=1&rel=0";

const heroPills = ["Strong in faith", "Kind in character", "Courageous in leadership"];

const posterFeatures = [
  "Arabic spoken language",
  "Tajweed with ijazah",
  "Seerah Tun Nabawiyah",
  "Life skills",
];

const transformationCards = [
  { from: "Hollow", to: "Nurturing" },
  { from: "Shallow", to: "Deep" },
  { from: "Following", to: "Guiding" },
];

const programs = [
  {
    title: "Arabic Spoken Language",
    copy: "Build confident reading, speaking, and Qur'an-connected vocabulary.",
    points: ["Foundations", "Expression", "Qur'an connection"],
    tone: "light",
  },
  {
    title: "Tajweed With Ijazah",
    copy: "Learn recitation beauty, pronunciation, and rule-based fluency.",
    points: ["Makharij", "Rules", "Practice"],
    tone: "carrot",
  },
  {
    title: "Seerah Tun Nabawiyah",
    copy: "Grow love for the Prophet through stories, reflection, and identity.",
    points: ["Stories", "Values", "Prophetic love"],
    tone: "purple",
  },
  {
    title: "Life Skills",
    copy: "Shape purposeful habits, leadership, confidence, and stronger values.",
    points: ["Leadership", "Character", "Purpose"],
    tone: "blue",
  },
];

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7-11-7Z" />
    </svg>
  );
}

export default function GenMuminPage() {
  const [activeVideo, setActiveVideo] = useState<"orientation" | "intro" | null>(null);
  const activeVideoSrc = activeVideo === "orientation" ? heroVideoEmbed : activeVideo === "intro" ? introVideoEmbed : null;
  const activeVideoTitle = activeVideo === "orientation" ? "Gen Mumin orientation session" : "Gen Mumin intro video";

  return (
    <div className="ga-page ga-gen-page ga-gen-ad-page">
      <header className="ga-gen-header ga-gen-ad-header">
        <div className="ga-gen-offer-strip">
          <div className="ga-container ga-gen-offer-row">
            <div className="ga-gen-offer-copy">
              <span className="ga-gen-discount-badge">Limited slots</span>
              <strong>Early bird 25% OFF</strong>
              <span>
                Use code <b>GENM25</b> - <s>PKR 12,000</s> <b>PKR 8,999</b>
              </span>
            </div>
            <Link href={registrationHref} className="ga-gen-offer-button">
              Register Now
            </Link>
          </div>
        </div>

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
            <Link href="#gen-mumin-overview">Overview</Link>
            <Link href="#gen-mumin-programs">Programs</Link>
            <Link href="#gen-mumin-video">Intro</Link>
          </nav>

          <Link href={whatsappHref} className="ga-gen-header-cta" target="_blank" rel="noreferrer">
            Join Community
          </Link>
        </div>
      </header>

      <main>
        <section className="ga-gen-ad-hero">
          <div className="ga-container ga-gen-ad-hero-grid">
            <div className="ga-gen-ad-hero-copy">
              <span className="ga-gen-badge">Gen Mumin Orientation Session</span>
              <h1>Empowered Muslim Children, Not Just Educated Children.</h1>
              <p>
                Gen Mumin helps children grow beyond ordinary learning into faith, character, leadership, Qur&apos;an
                connection, and purposeful living.
              </p>
              <div className="ga-gen-ad-pills">
                {heroPills.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <div className="ga-gen-ad-actions">
                <Link href={whatsappHref} className="ga-gen-primary-cta" target="_blank" rel="noreferrer">
                  Join Our WhatsApp Community
                </Link>
                <button
                  type="button"
                  className="ga-gen-secondary-cta ga-gen-video-button"
                  onClick={() => setActiveVideo("orientation")}
                >
                  <PlayIcon />
                  Watch Orientation Session
                </button>
              </div>
            </div>

            <div className="ga-gen-ad-hero-media">
              <Image
                src="/gen-mumin-hero-poster.jpeg"
                alt="Gen Mumin orientation session poster"
                width={1080}
                height={1350}
                className="ga-gen-ad-hero-image"
                priority
              />
            </div>
          </div>
        </section>

        <section id="gen-mumin-overview" className="ga-section ga-gen-offer-section">
          <div className="ga-container ga-gen-offer-grid">
            <div className="ga-gen-offer-poster">
              <Image
                src="/gen-mumin-offer-poster.jpeg"
                alt="Gen Mumin limited-time launch offer poster"
                width={1080}
                height={1350}
                className="ga-gen-offer-image"
              />
            </div>
            <div className="ga-gen-offer-panel">
              <span className="ga-gen-section-kicker">Limited Time Launch Offer</span>
              <h2>Guide them before something else does.</h2>
              <p>
                Gen Mumin is for families who want children shaped by faith, knowledge, values, and purpose while the
                digital world competes for their attention.
              </p>
              <div className="ga-gen-price-grid">
                <div className="ga-gen-price-card">
                  <span>Launch price</span>
                  <strong>
                    <s>PKR 12,000</s>
                    PKR 8,999
                  </strong>
                </div>
                <div className="ga-gen-code-card">
                  <span>Early bird discount</span>
                  <strong>25% OFF</strong>
                  <b>Use code GENM25</b>
                </div>
              </div>
              <div className="ga-gen-transformation-list">
                {transformationCards.map((item) => (
                  <p key={item.from}>
                    From <b>{item.from}</b> to <strong>{item.to}</strong>
                  </p>
                ))}
              </div>
              <div className="ga-gen-feature-row">
                {posterFeatures.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <div className="ga-gen-ad-actions">
                <Link href={registrationHref} className="ga-gen-primary-cta">
                  Register With GENM25
                </Link>
                <Link href={whatsappHref} className="ga-gen-secondary-cta" target="_blank" rel="noreferrer">
                  Join Community
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="gen-mumin-video" className="ga-gen-video-band">
          <iframe
            src={orientationVideoAutoplay}
            title="Gen Mumin orientation background"
            allow="autoplay; encrypted-media; picture-in-picture; web-share"
            aria-hidden="true"
          />
          <div className="ga-gen-video-band-overlay" />
          <div className="ga-container ga-gen-video-band-content">
            <div>
              <span className="ga-gen-section-kicker">Orientation Preview</span>
              <h2>See why Gen Mumin is built for this generation.</h2>
              <p>
                Watch the orientation session to understand the programme vision, launch offer, and what families can
                expect from the learning journey.
              </p>
              <button
                type="button"
                className="ga-gen-primary-cta ga-gen-video-button"
                onClick={() => setActiveVideo("intro")}
              >
                <PlayIcon />
                Watch Intro Video
              </button>
            </div>
          </div>
        </section>

        <section id="gen-mumin-programs" className="ga-section ga-gen-program-lite-section">
          <div className="ga-container ga-gen-section-head ga-gen-section-head-centered">
            <span className="ga-gen-section-kicker">Programme Path</span>
            <h2>Four focused areas for stronger values and purposeful living.</h2>
            <p>Clear, child-friendly learning areas summarized for parents who want quick understanding.</p>
          </div>

          <div className="ga-container ga-gen-program-lite-grid">
            {programs.map((program) => (
              <article key={program.title} className={`ga-gen-lite-card is-${program.tone}`}>
                <h3>{program.title}</h3>
                <p>{program.copy}</p>
                <div>
                  {program.points.map((point) => (
                    <span key={point}>{point}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ga-gen-final-cta">
          <div className="ga-container ga-gen-final-card">
            <span className="ga-gen-section-kicker">Registration Now Open</span>
            <h2>Reserve your child&apos;s Gen Mumin spot today.</h2>
            <p>
              Use code <b>GENM25</b> for the early bird launch offer. Join the community for updates or register now to
              secure your place.
            </p>
            <div className="ga-gen-banner-actions">
              <Link href={registrationHref} className="ga-gen-primary-cta">
                Enroll Now
              </Link>
              <Link href={whatsappHref} className="ga-gen-secondary-cta" target="_blank" rel="noreferrer">
                Join Our Community
              </Link>
            </div>
          </div>
        </section>

        {activeVideoSrc ? (
          <div className="ga-gen-video-modal" role="dialog" aria-modal="true" aria-label={activeVideoTitle}>
            <button
              type="button"
              className="ga-gen-video-modal-backdrop"
              aria-label="Close video"
              onClick={() => setActiveVideo(null)}
            />
            <div className="ga-gen-video-modal-card">
              <button type="button" className="ga-gen-video-modal-close" onClick={() => setActiveVideo(null)}>
                Close
              </button>
              <iframe
                src={activeVideoSrc}
                title={activeVideoTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
