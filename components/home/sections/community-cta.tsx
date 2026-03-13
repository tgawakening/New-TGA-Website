"use client";

import { motion } from "framer-motion";
import { fadeInUp, SectionHeading } from "@/components/home/sections/shared";

export function CommunityCta() {
  return (
    <section className="ga-section ga-community-bg">
      <div className="ga-container">
        <SectionHeading
          badge="Community"
          title="Join Our Growing Community"
          subtitle="Be part of a global movement to unite Muslims through faith, knowledge, and compassion."
        />
        <motion.div {...fadeInUp} className="mt-8 flex flex-wrap justify-center gap-4">
          <button type="button" className="ga-btn ga-btn-light">
            Explore Courses
          </button>
          <button type="button" className="ga-btn ga-btn-outline">
            Start Your Journey
          </button>
        </motion.div>
      </div>
    </section>
  );
}
