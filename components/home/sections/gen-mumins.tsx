"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { fadeInUp } from "@/components/home/sections/shared";

const GM_PHASES = [
  {
    id: "seerah",
    tab: "Seerah",
    icon: "☾",
    course: "COURSE 1",
    status: "Active",
    title: "The Prophet's Seerah",
    subtitle: "Stories of Our Beloved Prophet",
    arabic: "السيرة النبوية",
    description:
      "Journey through the blessed life of Prophet Muhammad (peace be upon him). Learn about his birth, prophethood, migration, and the beautiful lessons from his life that guide us today.",
    points: ["Birth & Early Life", "Prophethood & Revelation", "Hijrah to Madinah", "Key Events & Battles"],
    cta: "Start Learning",
    leadsTo: "Arabic",
    stats: [
      { value: "24+", label: "Lessons" },
      { value: "50+", label: "Activities" },
      { value: "4.9", label: "Rating" },
    ],
    tone: "seerah",
  },
  {
    id: "arabic",
    tab: "Arabic",
    icon: "⌘",
    course: "COURSE 2",
    status: "Active",
    title: "Arabic for Understanding Qur'an",
    subtitle: "Read & Understand the Quran",
    arabic: "اللغة العربية",
    description:
      "Build a strong foundation in Arabic to understand Allah's words directly. Learn reading, writing, vocabulary, and basic grammar through fun, interactive lessons designed for children.",
    points: ["Arabic Alphabet & Reading", "Writing & Handwriting", "Quranic Vocabulary", "Basic Grammar Rules"],
    cta: "Start Learning",
    leadsTo: "Tajweed",
    stats: [
      { value: "500+", label: "Words" },
      { value: "100+", label: "Exercises" },
      { value: "4.8", label: "Rating" },
    ],
    tone: "arabic",
  },
  {
    id: "tajweed",
    tab: "Tajweed",
    icon: "◉",
    course: "COURSE 3",
    status: "Active",
    title: "Quranic Tajweed Track",
    subtitle: "Beautiful Quran Recitation",
    arabic: "التجويد",
    description:
      "Perfect your Quran recitation with proper pronunciation and tajweed rules. Learn the articulation points, characteristics of letters, and rules that make recitation beautiful.",
    points: ["Proper Pronunciation", "Makharij (Articulation)", "Tajweed Rules", "Fluency Building"],
    cta: "Start Learning",
    leadsTo: "Leadership",
    stats: [
      { value: "30+", label: "Rules" },
      { value: "Daily", label: "Practice" },
      { value: "4.9", label: "Rating" },
    ],
    tone: "tajweed",
  },
  {
    id: "leadership",
    tab: "Leadership",
    icon: "◎",
    course: "COURSE 4",
    status: "Active",
    title: "Life Lessons & Leadership",
    subtitle: "Building Future Muslim Leaders",
    arabic: "القيادة",
    description:
      "Build confidence, character, and Islamic leadership skills. Learn public speaking, teamwork, problem-solving, and life skills grounded in Islamic values and prophetic examples.",
    points: ["Confidence Building", "Islamic Character", "Public Speaking", "Teamwork & Collaboration"],
    cta: "Start Learning",
    leadsTo: "Advanced Tracks",
    stats: [
      { value: "20+", label: "Skills" },
      { value: "10+", label: "Projects" },
      { value: "4.9", label: "Rating" },
    ],
    tone: "leadership",
  },
] as const;

type GenMuminPhaseId = (typeof GM_PHASES)[number]["id"];

export function GenMuminsTimeline() {
  const phases = GM_PHASES;
  const [activeId, setActiveId] = useState<GenMuminPhaseId>(phases[0].id);
  const [pauseLoop, setPauseLoop] = useState(false);

  useEffect(() => {
    if (pauseLoop) return;
    const timer = window.setInterval(() => {
      setActiveId((prev) => {
        const currentIndex = phases.findIndex((phase) => phase.id === prev);
        const nextIndex = (currentIndex + 1) % phases.length;
        return phases[nextIndex].id;
      });
    }, 6200);
    return () => window.clearInterval(timer);
  }, [pauseLoop, phases]);

  const active = phases.find((phase) => phase.id === activeId) ?? phases[0];

  return (
    <section className="ga-section ga-gm-section">
      <div className="ga-container">
        <motion.h2 {...fadeInUp} className="ga-gm-title">
          Project <span className={`ga-gm-title-accent ga-gm-title-accent-${active.tone}`}>Gen-Mu&apos;mins</span>
        </motion.h2>

        <motion.div
          {...fadeInUp}
          className="ga-gm-timeline"
          onMouseEnter={() => setPauseLoop(true)}
          onMouseLeave={() => setPauseLoop(false)}
        >
          <span className="ga-gm-track" />
          <div className="ga-gm-steps">
            {phases.map((phase) => (
              <button
                type="button"
                key={phase.id}
                onClick={() => setActiveId(phase.id)}
                className={`ga-gm-step ga-gm-step-${phase.tone} ${phase.id === active.id ? "ga-gm-step-active" : ""}`}
              >
                <span className="ga-gm-step-icon">{phase.icon}</span>
                <span className="ga-gm-step-label">{phase.tab}</span>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.article
          key={active.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: "easeOut" }}
          className={`ga-gm-card ga-gm-card-${active.tone}`}
        >
          <div className="ga-gm-copy">
            <div className="ga-gm-top">
              <span className="ga-gm-course">{active.course}</span>
              <span className="ga-gm-active">{active.status}</span>
            </div>
            <h3 className="ga-gm-card-title">{active.title}</h3>
            <p className="ga-gm-subtitle">{active.subtitle}</p>
            <p className="ga-gm-desc">{active.description}</p>

            <div className="ga-gm-points">
              {active.points.map((point) => (
                <p key={point}>{point}</p>
              ))}
            </div>

            <Link href="/projects/gen-mumin" className={`ga-gm-cta ga-gm-cta-${active.tone}`}>
              Explore More
            </Link>
          </div>

          <div className="ga-gm-side">
            <p className="ga-gm-arabic" dir="rtl" lang="ar">
              {active.arabic}
            </p>
            <div className={`ga-gm-icon-wrap ga-gm-icon-wrap-${active.tone}`}>
              <span className="ga-gm-icon">{active.icon}</span>
            </div>

            <div className="ga-gm-stats">
              {active.stats.map((item) => (
                <div key={item.label}>
                  <p className="ga-gm-stat-value">{item.value}</p>
                  <p className="ga-gm-stat-label">{item.label}</p>
                </div>
              ))}
            </div>
            <p className="ga-gm-leads">
              Leads to <span>{active.leadsTo}</span>
            </p>
          </div>
        </motion.article>

        <motion.div {...fadeInUp} className="ga-gm-summary-link">
          <Link href="/projects/gen-mumin" className="ga-gm-summary-btn">
            Explore More About Gen-Mumin
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
