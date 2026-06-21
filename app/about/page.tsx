import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Header } from "@/components/home/sections";
import { courses, missionPillars, missionStats, upcomingCourses } from "@/components/home/data";

export const metadata: Metadata = {
  title: "About Global Awakening",
  description:
    "Learn about Global Awakening, a faith-driven education platform raising Akhira-ready leaders through revelation-grounded learning, projects, and community.",
};

const focusAreas = [
  {
    title: "Revelation-Grounded Learning",
    body:
      "Courses are designed to connect sacred knowledge with clear thinking, character, strategy, and practical leadership.",
  },
  {
    title: "Projects With Purpose",
    body:
      "Initiatives such as Gen-Mumin, Connect for Akhirah, Nashrah, and global mission projects help learners turn knowledge into beneficial work.",
  },
  {
    title: "Community and Care",
    body:
      "The platform is built around respectful collaboration, privacy, student support, and pathways for learners who need financial help.",
  },
];

export default function AboutPage() {
  return (
    <div className="ga-page">
      <Header />
      <main>
        <section className="about-hero">
          <div className="ga-container about-hero-grid">
            <div>
              <p className="policy-eyebrow">About Global Awakening</p>
              <h1>Raising Akhira-ready leaders, grounded in revelation and equipped to lead.</h1>
              <p>
                Global Awakening is a faith-driven learning platform and community working to unite
                minds, inspire change, and help Muslims build beneficial systems rooted in Qur&apos;an,
                prophetic wisdom, and practical excellence.
              </p>
              <div className="about-actions">
                <Link href="/#courses" className="ga-btn ga-btn-primary">
                  Explore Courses
                </Link>
                <Link href="/support-our-mission" className="ga-btn ga-btn-outline">
                  Support Our Mission
                </Link>
              </div>
            </div>

            <div className="about-signal-card">
              <span>Our Direction</span>
              <h2>Education that serves deen, families, communities, and the Akhirah.</h2>
              <p>
                From Seerah strategy to youth projects, Global Awakening connects learning with
                action so students can grow in identity, confidence, service, and leadership.
              </p>
            </div>
          </div>
        </section>

        <section className="about-band">
          <div className="ga-container about-stats">
            {missionStats.map((stat) => (
              <div key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="policy-body">
          <div className="ga-container">
            <div className="about-section-head">
              <p className="policy-eyebrow">What We Build</p>
              <h2>Learning pathways for whole-person development.</h2>
              <p>
                The website brings together courses, children and youth tracks, social projects,
                support options, and community spaces with a shared mission.
              </p>
            </div>

            <div className="about-focus-grid">
              {focusAreas.map((item) => (
                <article key={item.title} className="about-focus-card">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>

            <div className="about-two-col">
              <article>
                <p className="policy-eyebrow">Mission Pillars</p>
                <h2>Rooted in faith, built for real life.</h2>
                <ul className="about-pill-list">
                  {missionPillars.map((pillar) => (
                    <li key={pillar}>{pillar}</li>
                  ))}
                </ul>
              </article>

              <article>
                <p className="policy-eyebrow">Current Learning</p>
                <h2>Courses and projects already shaping the journey.</h2>
                <div className="about-link-list">
                  {courses.slice(0, 4).map((course) => (
                    <Link key={course.id} href={course.id === "prophetic-strategy" ? "/seerah" : "/#courses"}>
                      {course.title}
                    </Link>
                  ))}
                  {upcomingCourses.slice(0, 3).map((course) => (
                    <Link key={course.id} href="/#projects">
                      {course.title}
                    </Link>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
