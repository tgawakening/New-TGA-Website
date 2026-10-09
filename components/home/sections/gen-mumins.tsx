"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { genMuminPrograms, type GenMuminProgramId } from "@/components/gen-mumin/programs";
import { ProgramIcon } from "@/components/gen-mumin/program-icon";
import { fadeInUp } from "@/components/home/sections/shared";

export function GenMuminsTimeline() {
  const phases = genMuminPrograms;
  const [activeId, setActiveId] = useState<GenMuminProgramId>(phases[0].id);
  const [pauseLoop, setPauseLoop] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (pauseLoop || reducedMotion) return;
    const timer = window.setInterval(() => {
      setActiveId((prev) => {
        const currentIndex = phases.findIndex((phase) => phase.id === prev);
        const nextIndex = (currentIndex + 1) % phases.length;
        return phases[nextIndex].id;
      });
    }, 6200);
    return () => window.clearInterval(timer);
  }, [pauseLoop, phases, reducedMotion]);

  const active = phases.find((phase) => phase.id === activeId) ?? phases[0];

  return (
    <section className="ga-section ga-gm-section">
      <div className="ga-container">
        <motion.h2 {...fadeInUp} className="ga-gm-title">
          Project <span className={`ga-gm-title-accent ga-gm-title-accent-${active.id}`}>Gen-Mu&apos;mins</span>
        </motion.h2>

        <motion.div
          {...fadeInUp}
          className="ga-gm-timeline"
          onMouseEnter={() => setPauseLoop(true)}
          onMouseLeave={() => setPauseLoop(false)}
          onFocus={() => setPauseLoop(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setPauseLoop(false);
          }}
        >
          <span className="ga-gm-track" />
          <div className="ga-gm-steps">
            {phases.map((phase) => (
              <button
                type="button"
                key={phase.id}
                onClick={() => { setActiveId(phase.id); setPauseLoop(true); }}
                aria-pressed={phase.id === active.id}
                className={`ga-gm-step ga-gm-step-${phase.id} ${phase.id === active.id ? "ga-gm-step-active" : ""}`}
              >
                <span className="ga-gm-step-icon"><ProgramIcon program={phase.id} /></span>
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
          className={`ga-gm-card ga-gm-card-${active.id}`}
          style={{ "--ga-gm-accent": active.accent } as CSSProperties}
        >
          <div className="ga-gm-copy">
            <div className="ga-gm-top">
              <span className="ga-gm-course">PROGRAM {phases.findIndex((phase) => phase.id === active.id) + 1}</span>
              <span className="ga-gm-active">Active</span>
            </div>
            <h3 className="ga-gm-card-title">{active.title}</h3>
            <p className="ga-gm-subtitle">{active.subtitle}</p>
            <p className="ga-gm-desc">{active.description}</p>

            <div className="ga-gm-points">
              {active.points.map((point) => (
                <p key={point}>{point}</p>
              ))}
            </div>

            <Link href="/projects/gen-mumin" className={`ga-gm-cta ga-gm-cta-${active.id}`}>
              Explore More
            </Link>
          </div>

          <div className="ga-gm-side">
            <p className="ga-gm-arabic" dir="rtl" lang="ar">
              {active.arabic}
            </p>
            <div className={`ga-gm-icon-wrap ga-gm-icon-wrap-${active.id}`}>
              <ProgramIcon program={active.id} animated />
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

      </div>
    </section>
  );
}
