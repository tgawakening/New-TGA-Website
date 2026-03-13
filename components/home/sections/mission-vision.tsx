"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { missionPillars, missionStats } from "@/components/home/data";
import { CountUpStat, fadeInUp, TypingHighlight } from "@/components/home/sections/shared";

export function MissionVisionSection() {
  const [activeMode, setActiveMode] = useState<"vision" | "mission">("vision");
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = window.setInterval(() => {
      setActiveMode((prev) => (prev === "vision" ? "mission" : "vision"));
    }, 6200);
    return () => window.clearInterval(timer);
  }, [isPaused]);

  const sectionContent = {
    vision: {
      badge: "Our Vision",
      icon: "✧",
      iconLabel: "Vision Icon",
      titleA: "A united, empowered",
      titleB: "Global Muslim Community",
      lead:
        "Grounded in the timeless wisdom of the Qur'an, where future generations rise as compassionate, innovative leaders, shaping a better world for all.",
      motto: "Unity. Wisdom. Legacy.",
      focusTitle: "Our future direction",
      points: [
        "Faith-centered civilizational thinking",
        "Compassionate and innovative leadership",
        "Interconnected global Muslim collaboration",
      ],
      ayahArabic: "إِنَّ أَكْرَمَكُمْ عِندَ ٱللَّهِ أَتْقَىٰكُمْ",
      ayahTranslation:
        '"Indeed, the most noble of you in the sight of Allah is the most righteous of you."',
      ayahRef: "Surah Al-Hujurat 49:13",
    },
    mission: {
      badge: "Our Mission",
      icon: "✦",
      iconLabel: "Mission Icon",
      titleA: "Awakening the Ummah,",
      titleB: "One Journey at a Time",
      lead:
        "We are a global platform driven by the mission of awakening and empowering intellectual and concerned Muslims to inspire meaningful change.",
      motto: "Action. Service. Reform.",
      focusTitle: "Our focus in action",
      points: missionPillars,
      ayahArabic: "وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ",
      ayahTranslation: '"And cooperate in righteousness and piety."',
      ayahRef: "Al-Ma'idah 5:2",
    },
  } as const;

  const current = sectionContent[activeMode];

  return (
    <section className="ga-section ga-mission-vision">
      <div className="ga-container">
        <div
          className="ga-mv-compact"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <motion.div {...fadeInUp} className="ga-mv-tabs ga-mv-tabs-compact">
            <button
              type="button"
              className={`ga-mv-tab-btn ${activeMode === "vision" ? "ga-mv-tab-btn-active" : ""}`}
              onClick={() => setActiveMode("vision")}
            >
              Our Vision
            </button>
            <button
              type="button"
              className={`ga-mv-tab-btn ${activeMode === "mission" ? "ga-mv-tab-btn-active" : ""}`}
              onClick={() => setActiveMode("mission")}
            >
              Our Mission
            </button>
          </motion.div>

          <motion.div
            key={activeMode}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: "easeOut" }}
            className="ga-mv-stage mt-5 text-center"
          >
            <div className="ga-mv-badge-row">
              <span className="ga-badge inline-flex">{current.badge}</span>
              <motion.div
                className={`ga-mv-state-icon ${activeMode === "vision" ? "ga-mv-state-icon-vision" : "ga-mv-state-icon-mission"}`}
                animate={{ y: [0, -4, 0], rotate: [0, 6, 0, -6, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                aria-label={current.iconLabel}
              >
                {current.icon}
              </motion.div>
            </div>

            <h2 className="ga-mv-unified-title">
              <span>{current.titleA} </span>
              <span className="ga-sky">{current.titleB}</span>
            </h2>
            <p className="ga-mv-lead mx-auto mt-3 max-w-3xl">{current.lead}</p>
            <p className="ga-mv-motto mt-2">{current.motto}</p>
          </motion.div>

          {activeMode === "mission" ? (
            <>
              <motion.div {...fadeInUp} className="ga-mv-counters mt-5">
                {missionStats.map((stat) => (
                  <article key={stat.label} className="ga-mv-counter">
                    <p className="ga-mv-counter-value">
                      <CountUpStat value={stat.value} />
                    </p>
                    <p className="ga-mv-counter-label">{stat.label}</p>
                  </article>
                ))}
              </motion.div>

              <motion.div {...fadeInUp} className="mt-5 text-center">
                <p className="ga-mv-focus-title">{current.focusTitle}</p>
                <div className="ga-mv-impact-row mt-3">
                  {current.points.map((point) => (
                    <span key={`${activeMode}-${point}`} className="ga-mv-impact-pill">
                      {point}
                    </span>
                  ))}
                </div>
              </motion.div>
            </>
          ) : null}

          <motion.article {...fadeInUp} className="ga-ayah-card ga-ayah-card-compact mt-6">
            <p className="ga-ayah-arabic" dir="rtl" lang="ar">
              <TypingHighlight
                text={current.ayahArabic}
                delay={0.3}
                duration={18}
                rtl
              />
            </p>
            <p className="ga-ayah-translation">{current.ayahTranslation}</p>
            <p className="ga-ayah-ref">{current.ayahRef}</p>
          </motion.article>
        </div>
      </div>
    </section>
  );
}
