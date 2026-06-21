import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer, Header } from "@/components/home/sections";
import { courses, missionPillars, missionStats } from "@/components/home/data";

export const metadata: Metadata = {
  title: "About Global Awakening",
  description:
    "Learn about Global Awakening, a faith-driven education platform raising Akhira-ready leaders through revelation-grounded learning, projects, and community.",
};

const visualPillars = [
  {
    title: "Revelation",
    text: "Learning begins with Qur'an, Seerah, adab, and a clear Islamic worldview.",
  },
  {
    title: "Leadership",
    text: "Students are guided to think, plan, serve, and lead with responsibility.",
  },
  {
    title: "Action",
    text: "Courses and projects turn knowledge into family, community, and Ummah benefit.",
  },
];

export default function AboutPage() {
  return (
    <div className="ga-page">
      <Header />
      <main>
        <section className="about-hero about-hero-visual">
          <div className="ga-container about-visual-grid">
            <div className="about-visual-copy">
              <p className="policy-eyebrow">About Global Awakening</p>
              <h1>Raising Akhira-ready leaders through knowledge, character, and purpose.</h1>
              <p>
                Global Awakening is a faith-driven learning platform and community helping Muslims
                grow through revelation-grounded education, meaningful projects, and supportive
                collaboration.
              </p>
              <div className="about-actions">
                <Link href="/#courses" className="ga-btn ga-btn-primary">
                  Explore Courses
                </Link>
                <Link href="/projects/gen-mumin" className="ga-btn ga-btn-outline">
                  View Gen-Mumin
                </Link>
              </div>
            </div>

            <div className="about-visual-media">
              <Image
                src="/Gen-Mumin.jpeg"
                alt="Gen-Mumin children learning banner"
                width={760}
                height={520}
                className="about-main-image"
                priority
              />
              <div className="about-floating-note">
                <strong>Faith-led learning</strong>
                <span>For students, families, and future community builders.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="about-stats-band">
          <div className="ga-container about-stats">
            {missionStats.map((stat) => (
              <div key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="about-story-section">
          <div className="ga-container about-story-grid">
            <div className="about-story-image-wrap">
              <Image
                src="/seerah slide-3.jpg"
                alt="Students exploring prophetic planning and strategy"
                width={620}
                height={760}
                className="about-story-image"
              />
            </div>

            <div className="about-story-copy">
              <p className="policy-eyebrow">What We Are Building</p>
              <h2>Education that connects belief with confident action.</h2>
              <p>
                The platform brings together live courses, youth tracks, Seerah strategy, social
                projects, student support, and community spaces with one shared direction: learning
                that serves deen and prepares people for beneficial work.
              </p>

              <div className="about-interactive-row">
                {visualPillars.map((pillar) => (
                  <article key={pillar.title} className="about-interactive-pill">
                    <span>{pillar.title}</span>
                    <p>{pillar.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="about-pathways-section">
          <div className="ga-container">
            <div className="about-section-head">
              <p className="policy-eyebrow">Pathways</p>
              <h2>Current learning and project directions.</h2>
            </div>

            <div className="about-pathways">
              {courses.slice(0, 4).map((course) => (
                <Link
                  key={course.id}
                  href={course.id === "prophetic-strategy" ? "/seerah" : "/#courses"}
                  className="about-pathway-link"
                >
                  <span>{course.category}</span>
                  <strong>{course.title}</strong>
                </Link>
              ))}
            </div>

            <div className="about-mission-line">
              {missionPillars.map((pillar) => (
                <span key={pillar}>{pillar}</span>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
