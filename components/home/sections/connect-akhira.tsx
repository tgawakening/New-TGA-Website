"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fadeInUp } from "@/components/home/sections/shared";

const CONNECT_PHASES = [
  {
    id: "divine-bonds",
    tab: "Divine Bonds",
    icon: "♡",
    phase: "PHASE 1",
    status: "Active",
    statusTone: "active",
    title: "Divine Bonds",
    subtitle: "Marriage & Nikah",
    arabic: "الروابط الإلهية",
    description:
      "Begin your journey to find a life partner the Islamic way. Our faith-based compatibility matching and marriage preparation program helps you build a blessed union.",
    points: [
      "OCEAN + Islamic Values Assessment",
      "AI-Powered Compatibility Matching",
      "Marriage Preparation Courses",
      "Family-Involved Process",
    ],
    cta: "Find Your Soulmate",
    ctaTone: "gold",
    stats: [
      { value: "4", label: "Phases" },
      { value: "28", label: "Chapters" },
      { value: "116", label: "Lessons" },
    ],
    leadsTo: "Islamic Parenting",
    ayahArabic: "وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا",
    ayahRef: "Ar-Rum 30:21",
  },
  {
    id: "parenting",
    tab: "Parenting",
    icon: "◌",
    phase: "PHASE 2",
    status: "Coming Soon",
    statusTone: "soon",
    title: "Islamic Parenting",
    subtitle: "Conception to Age 5",
    arabic: "التربية الإسلامية",
    description:
      "Raise righteous children from day one. Comprehensive Islamic parenting guidance from pregnancy through early childhood development.",
    points: [
      "Pregnancy Duas & Guidance",
      "Newborn Islamic Rituals (Aqiqah, Adhan)",
      "Child Development Milestones",
      "Islamic Tarbiyah Methods",
    ],
    cta: "Join Waitlist",
    ctaTone: "muted",
    stats: [
      { value: "40+", label: "Curriculum" },
      { value: "100+", label: "Milestones" },
      { value: "200+", label: "Resources" },
    ],
    leadsTo: "Nashrah Universe",
    ayahArabic: "يَا أَيُّهَا الَّذِينَ آمَنُوا قُوا أَنفُسَكُمْ وَأَهْلِيكُمْ نَارًا",
    ayahRef: "At-Tahrim 66:6",
  },
  {
    id: "nashrah",
    tab: "Nashrah",
    icon: "✦",
    phase: "PHASE 3",
    status: "Active",
    statusTone: "active",
    title: "Nashrah Universe",
    subtitle: "5-Year Islamic STEM Curriculum - Ages 6-13",
    arabic: "علم المعرفة",
    description:
      "A comprehensive 5-year curriculum with 8 subjects and 475 meticulously crafted lessons per subject spanning five cognitive levels. Every lesson bridges Quranic wisdom with scientific discovery.",
    points: [
      "Interactive Science Labs",
      "500+ Interactive Math Worlds",
      "20+ Game Templates",
      "Quran-Centered Knowledge Framework",
    ],
    cta: "Explore Curriculum",
    ctaTone: "gold",
    stats: [
      { value: "8", label: "Subjects" },
      { value: "3,800", label: "Lessons" },
      { value: "5", label: "Levels" },
    ],
    leadsTo: "Muslim LinkedIn",
    curriculum: [
      "IGCSE",
      "A-Level",
      "AQA",
      "Physics",
      "Mathematics",
      "Chemistry",
      "Biology",
      "English",
      "Computer Science",
      "Quran Studies",
    ],
    ayahArabic: "وَقُل رَّبِّ زِدْنِي عِلْمًا",
    ayahRef: "Taha 20:114",
  },
  {
    id: "muslims-linkedin",
    tab: "Muslims LinkedIn",
    icon: "▣",
    phase: "PHASE 4",
    status: "Coming Soon",
    statusTone: "soon",
    title: "Muslim LinkedIn",
    subtitle: "Entrepreneurship & Networking",
    arabic: "شبكة المسلم المهنية",
    description:
      "Connect, learn, and grow with the Muslim professional community. A halal networking and entrepreneurship platform for youth and young professionals.",
    points: [
      "Professional Networking",
      "Mentorship Matching",
      "Halal Business Marketplace",
      "Entrepreneurship Courses",
    ],
    cta: "Coming Soon",
    ctaTone: "muted",
    stats: [
      { value: "2025", label: "Planned" },
      { value: "20+", label: "Features" },
      { value: "Q2 2025", label: "Beta" },
    ],
    leadsTo: "Global Ummah Network",
    ayahArabic: "وَاعْتَصِمُوا بِحَبْلِ اللَّهِ جَمِيعًا وَلَا تَفَرَّقُوا",
    ayahRef: "Aal Imran 3:103",
  },
] as const;

type ConnectPhaseId = (typeof CONNECT_PHASES)[number]["id"];

export function ConnectAkhiraTimeline() {
  const [activeId, setActiveId] = useState<ConnectPhaseId>(CONNECT_PHASES[0].id);
  const [pauseLoop, setPauseLoop] = useState(false);

  useEffect(() => {
    if (pauseLoop) return;
    const timer = window.setInterval(() => {
      setActiveId((prev) => {
        const currentIndex = CONNECT_PHASES.findIndex((phase) => phase.id === prev);
        const nextIndex = (currentIndex + 1) % CONNECT_PHASES.length;
        return CONNECT_PHASES[nextIndex].id;
      });
    }, 6200);
    return () => window.clearInterval(timer);
  }, [pauseLoop]);

  const activeIndex = CONNECT_PHASES.findIndex((phase) => phase.id === activeId);
  const active = CONNECT_PHASES[activeIndex] ?? CONNECT_PHASES[0];

  return (
    <section className="ga-section ga-cfa-section">
      <div className="ga-container">
        <motion.h2 {...fadeInUp} className="ga-cfa-title">
          Connect for Akhirah
        </motion.h2>

        <motion.div
          {...fadeInUp}
          className="ga-cfa-timeline"
          onMouseEnter={() => setPauseLoop(true)}
          onMouseLeave={() => setPauseLoop(false)}
        >
          <span className="ga-cfa-track" />
          <div className="ga-cfa-steps">
            {CONNECT_PHASES.map((phase) => (
              <button
                type="button"
                key={phase.id}
                onClick={() => setActiveId(phase.id)}
                className={`ga-cfa-step ${phase.id === active.id ? "ga-cfa-step-active" : ""}`}
              >
                <span className="ga-cfa-step-icon">{phase.icon}</span>
                <span className="ga-cfa-step-label">{phase.tab}</span>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.article
          key={active.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="ga-cfa-card"
        >
          <div className="ga-cfa-copy">
            <div className="ga-cfa-phase-row">
              <span className="ga-cfa-phase-id">{active.phase}</span>
              <span className={`ga-cfa-status ga-cfa-status-${active.statusTone}`}>{active.status}</span>
            </div>

            <h3 className="ga-cfa-card-title">{active.title}</h3>
            <p className="ga-cfa-card-subtitle">{active.subtitle}</p>
            <p className="ga-cfa-card-desc">{active.description}</p>

            {active.id === "nashrah" ? (
              <div className="ga-cfa-curriculum">
                {active.curriculum?.map((item) => (
                  <span key={item} className="ga-cfa-chip">
                    {item}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="ga-cfa-points">
              {active.points.map((point) => (
                <p key={point}>{point}</p>
              ))}
            </div>

            <button
              type="button"
              className={`ga-cfa-cta ${active.ctaTone === "muted" ? "ga-cfa-cta-muted" : "ga-cfa-cta-gold"}`}
            >
              {active.cta}
            </button>
          </div>

          <div className="ga-cfa-side">
            <p className="ga-cfa-arabic" dir="rtl" lang="ar">
              {active.arabic}
            </p>
            <div className="ga-cfa-visual-ayah">
              <p className="ga-cfa-visual-ayah-text" dir="rtl" lang="ar">
                {active.ayahArabic}
              </p>
              <p className="ga-cfa-visual-ayah-ref">{active.ayahRef}</p>
            </div>

            <div className={`ga-cfa-visual ga-cfa-visual-${active.id}`}>
              {active.id === "divine-bonds" ? (
                <div className="ga-cfa-v-divine">
                  <span className="ga-cfa-d-beam" />
                  <span className="ga-cfa-d-thread ga-cfa-d-thread-a" />
                  <span className="ga-cfa-d-thread ga-cfa-d-thread-b" />
                  <span className="ga-cfa-d-thread ga-cfa-d-thread-c" />
                  <span className="ga-cfa-d-thread ga-cfa-d-thread-d" />
                  <span className="ga-cfa-d-thread ga-cfa-d-thread-e" />
                  <span className="ga-cfa-d-thread ga-cfa-d-thread-f" />
                  <span className="ga-cfa-d-knot" />
                  <span className="ga-cfa-d-heart">❤</span>
                </div>
              ) : null}

              {active.id === "parenting" ? (
                <div className="ga-cfa-v-parenting">
                  <span className="ga-cfa-p-quran" />
                  <span className="ga-cfa-p-light" />
                  <span className="ga-cfa-p-beam" />
                  <span className="ga-cfa-p-house" />
                  <span className="ga-cfa-p-member ga-cfa-p-mother" />
                  <span className="ga-cfa-p-member ga-cfa-p-father" />
                  <span className="ga-cfa-p-member ga-cfa-p-child" />
                </div>
              ) : null}

              {active.id === "nashrah" ? (
                <div className="ga-cfa-v-nashrah">
                  <span className="ga-cfa-n-ring ga-cfa-n-ring-a" />
                  <span className="ga-cfa-n-ring ga-cfa-n-ring-b" />
                  <span className="ga-cfa-n-center">
                    <span className="ga-cfa-n-book" />
                    <span className="ga-cfa-n-title" dir="rtl" lang="ar">القرآن الكريم</span>
                  </span>
                  <span className="ga-cfa-n-orbit ga-cfa-n-orbit-a">Biology</span>
                  <span className="ga-cfa-n-orbit ga-cfa-n-orbit-b">Chemistry</span>
                  <span className="ga-cfa-n-orbit ga-cfa-n-orbit-c">Physics</span>
                  <span className="ga-cfa-n-orbit ga-cfa-n-orbit-d">Math</span>
                </div>
              ) : null}

              {active.id === "muslims-linkedin" ? (
                <div className="ga-cfa-v-linkedin">
                  <span className="ga-cfa-l-globe" />
                  <span className="ga-cfa-l-wave ga-cfa-l-wave-a" />
                  <span className="ga-cfa-l-wave ga-cfa-l-wave-b" />
                  <span className="ga-cfa-l-line ga-cfa-l-line-a" />
                  <span className="ga-cfa-l-line ga-cfa-l-line-b" />
                  <span className="ga-cfa-l-line ga-cfa-l-line-c" />
                  <span className="ga-cfa-l-line ga-cfa-l-line-d" />
                  <span className="ga-cfa-l-line ga-cfa-l-line-e" />
                  <span className="ga-cfa-l-line ga-cfa-l-line-f" />
                  <span className="ga-cfa-l-node ga-cfa-l-node-a" />
                  <span className="ga-cfa-l-node ga-cfa-l-node-b" />
                  <span className="ga-cfa-l-node ga-cfa-l-node-c" />
                  <span className="ga-cfa-l-node ga-cfa-l-node-d" />
                  <span className="ga-cfa-l-node ga-cfa-l-node-e" />
                  <span className="ga-cfa-l-node ga-cfa-l-node-f" />
                  <span className="ga-cfa-l-node ga-cfa-l-node-g" />
                  <span className="ga-cfa-l-node ga-cfa-l-node-h" />
                  <span className="ga-cfa-l-signal ga-cfa-l-signal-a" />
                  <span className="ga-cfa-l-signal ga-cfa-l-signal-b" />
                  <span className="ga-cfa-l-signal ga-cfa-l-signal-c" />
                  <span className="ga-cfa-l-signal ga-cfa-l-signal-d" />
                </div>
              ) : null}
            </div>

            <div className="ga-cfa-stats">
              {active.stats.map((item) => (
                <div key={item.label}>
                  <p className="ga-cfa-stat-value">{item.value}</p>
                  <p className="ga-cfa-stat-label">{item.label}</p>
                </div>
              ))}
            </div>

            <p className="ga-cfa-leads">
              Leads to <span>{active.leadsTo}</span>
            </p>
          </div>
        </motion.article>
      </div>
    </section>
  );
}
