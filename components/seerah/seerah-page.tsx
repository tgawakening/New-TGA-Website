import Image from "next/image";
import Link from "next/link";
import { FeeWaiverSection, Footer } from "@/components/home/sections";
import { TypingHighlight } from "@/components/home/sections/shared";

const whatsappLink = "https://chat.whatsapp.com/EXcZmIOG9c8LOSdjK7KMko";

const ARABIC_AYAH_LINE_ONE =
  "\u0644\u064e\u0642\u064e\u062f\u0652 \u0623\u064e\u0631\u0652\u0633\u064e\u0644\u0652\u0646\u064e\u0627 \u0631\u064f\u0633\u064f\u0644\u064e\u0646\u064e\u0627 \u0628\u0650\u0627\u0644\u0652\u0628\u064e\u064a\u0650\u0651\u0646\u064e\u0627\u062a\u0650 \u0648\u064e\u0623\u064e\u0646\u0652\u0632\u064e\u0644\u0652\u0646\u064e\u0627 \u0645\u064e\u0639\u064e\u0647\u064f\u0645\u064f \u0627\u0644\u0652\u0643\u0650\u062a\u064e\u0627\u0628\u064e \u0648\u064e\u0627\u0644\u0652\u0645\u0650\u064a\u0632\u064e\u0627\u0646\u064e \u0644\u0650\u064a\u064e\u0642\u064f\u0648\u0645\u064e \u0627\u0644\u0646\u064e\u0651\u0627\u0633\u064f \u0628\u0650\u0627\u0644\u0652\u0642\u0650\u0633\u0652\u0637\u0650";
const ARABIC_AYAH_LINE_TWO =
  "\u0648\u064e\u0623\u064e\u0646\u0652\u0632\u064e\u0644\u0652\u0646\u064e\u0627 \u0627\u0644\u0652\u062d\u064e\u062f\u0650\u064a\u062f\u064e \u0641\u0650\u064a\u0647\u0650 \u0628\u064e\u0623\u0652\u0633\u064c \u0634\u064e\u062f\u0650\u064a\u062f\u064c \u0648\u064e\u0645\u064e\u0646\u064e\u0627\u0641\u0650\u0639\u064f \u0644\u0650\u0644\u0646\u064e\u0651\u0627\u0633\u0650";

const metaChips = ["Saturdays", "10:00 AM", "40+ Sessions", "All Levels"];
const topicChips = ["Pre-Islamic Arabia", "Makkan Period", "Madinan Period"];

const strategyModules = [
  {
    title: "Military Strategies & Ethics",
    subtitle:
      "Study the Prophet's battle strategy, planning, and ethical conduct in warfare.",
    points: ["Battle Planning", "Ethical Warfare", "Defensive Strategy", "Team Unity"],
    image: "/seerah slide-1.jpg",
  },
  {
    title: "Intelligence & Security",
    subtitle:
      "Discover methods the Prophet (PBUH) used to build intelligence systems and safeguard the Ummah.",
    points: ["Information Gathering", "Risk Awareness", "Network Building", "Privacy"],
    image: "/seerah slide-2.jpg",
  },
  {
    title: "Strategic Planning",
    subtitle:
      "Learn the Prophet's long-term blueprint for planning, execution, and movement building.",
    points: ["Long-term Vision", "Resource Planning", "Crisis Management", "Results"],
    image: "/seerah slide-3.jpg",
  },
  {
    title: "Diplomacy & Alliances",
    subtitle:
      "Master the art of diplomacy through the Prophet's treaties and negotiation frameworks.",
    points: ["Treaty Development", "Conflict Resolution", "Mutual Benefit", "Alliance Work"],
    image: "/seerah slide-4.jpg",
  },
  {
    title: "Governance & Justice",
    subtitle:
      "Explore governance and justice in action, based on prophetic leadership in Madinah.",
    points: ["Constitution of Madinah", "Justice System", "Rule of Law", "Social Duty"],
    image: "/seerah slide-5.jpg",
  },
];

const courseDetails = [
  {
    title: "Learning Outcomes",
    points: [
      "Master strategic decision-making from Seerah.",
      "Build practical leadership and planning skills.",
      "Apply prophetic principles to modern challenges.",
    ],
  },
  {
    title: "Reference Materials",
    points: ["Selected Seerah books", "The Sealed Nectar", "The Corrected Sirah Framework"],
  },
  {
    title: "Requirements",
    points: ["Basic Islamic knowledge", "Weekly commitment", "Learner participation"],
  },
];

function SeerahHeroHeader() {
  return (
    <div className="seerah-mini-header">
      <Link href="/" className="seerah-mini-btn seerah-mini-btn-home">
        Home
      </Link>
      <Link
        href={whatsappLink}
        target="_blank"
        rel="noreferrer"
        className="seerah-mini-btn seerah-mini-btn-free"
      >
        Free Orientation
      </Link>
      <button type="button" className="seerah-mini-btn seerah-mini-btn-enroll">
        Enroll Now - £20/mo
      </button>
    </div>
  );
}

export default function SeerahPage() {
  return (
    <div className="ga-page seerah-page">
      <main>
        <section className="seerah-hero">
          <div className="ga-container">
            <SeerahHeroHeader />
          </div>

          <div className="ga-container seerah-hero-grid">
            <div className="seerah-hero-copy">
              <p className="seerah-arabic" dir="rtl" lang="ar">
                <TypingHighlight text={ARABIC_AYAH_LINE_ONE} delay={0.2} duration={17} rtl block />
                <span className="seerah-arabic-break">*</span>
                <TypingHighlight text={ARABIC_AYAH_LINE_TWO} delay={0.9} duration={17} rtl block />
              </p>

              <p className="seerah-translation">
                We sent Our messengers with clear signs, and sent down with them the Book and the
                Balance so people may uphold justice. And We sent down iron, wherein is great military
                might and benefits for mankind.
                <span>- Surah Al-Hadeed 57:25</span>
              </p>

              <h1 className="seerah-title">
                <span>Prophetic Strategies</span>
                <small>&amp; Planning</small>
              </h1>

              <div className="seerah-chip-grid seerah-chip-grid-meta">
                {metaChips.map((chip) => (
                  <span key={chip} className="seerah-chip">
                    {chip}
                  </span>
                ))}
              </div>
              <div className="seerah-chip-grid">
                {topicChips.map((chip) => (
                  <span key={chip} className="seerah-chip seerah-chip-topic">
                    {chip}
                  </span>
                ))}
              </div>

              <p className="seerah-orientation-copy">Not sure yet? Attend our free orientation first</p>
              <Link href={whatsappLink} target="_blank" rel="noreferrer" className="seerah-whatsapp-btn">
                Join Free Orientation Session
              </Link>
            </div>

            <article className="seerah-video-card">
              <video autoPlay muted loop playsInline className="seerah-video">
                <source src="/videos/seerah-course-promo.mp4" type="video/mp4" />
              </video>
              <div className="seerah-video-overlay">
                <p>Starting from Ramadan</p>
                <h2>PROPHETIC COMMAND</h2>
              </div>
            </article>
          </div>
        </section>

        <section className="seerah-modules">
          {strategyModules.map((module, index) => (
            <div key={module.title} className="seerah-module-row">
              <div className="ga-container">
                <article className={`seerah-module-card ${index % 2 === 1 ? "seerah-module-reverse" : ""}`}>
                  <Image
                    src={module.image}
                    alt={module.title}
                    width={460}
                    height={620}
                    className="seerah-module-image"
                  />
                  <div>
                    <p className="seerah-module-kicker">Prophetic Strategy</p>
                    <h3 className="seerah-module-title">{module.title}</h3>
                    <p className="seerah-module-subtitle">{module.subtitle}</p>
                    <div className="seerah-module-points">
                      {module.points.map((point) => (
                        <p key={point}>{point}</p>
                      ))}
                    </div>
                  </div>
                </article>
              </div>
            </div>
          ))}
        </section>

        <section className="seerah-details">
          <div className="ga-container">
            <h3 className="seerah-section-title">Course Details</h3>
            <div className="seerah-details-grid">
              {courseDetails.map((detail) => (
                <article key={detail.title} className="seerah-details-card">
                  <h4>{detail.title}</h4>
                  <ul>
                    {detail.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="seerah-journey">
          <div className="ga-container text-center">
            <h3 className="seerah-journey-title">Begin Your Journey</h3>
            <p className="seerah-journey-subtitle">
              Join our Prophetic Strategies and Planning course and lead with purpose and vision.
            </p>

            <article className="seerah-price-card">
              <div>
                <span>Monthly Fee</span>
                <strong>£20/month</strong>
              </div>
              <div>
                <span>Full Access</span>
                <strong>40+ Sessions + Worksheets</strong>
              </div>
            </article>

            <div className="seerah-journey-actions">
              <button type="button" className="seerah-enroll-btn">
                Enroll Now
              </button>
              <Link href={whatsappLink} target="_blank" rel="noreferrer" className="seerah-whatsapp-btn">
                Join Free Orientation Session
              </Link>
            </div>
          </div>
        </section>

        <div className="seerah-fee-compact">
          <FeeWaiverSection />
        </div>
      </main>
      <Footer />
    </div>
  );
}
