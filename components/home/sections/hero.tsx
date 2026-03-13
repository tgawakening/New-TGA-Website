"use client";

import { motion } from "framer-motion";
import { revealContainer, revealLine, TypingHighlight } from "@/components/home/sections/shared";

export function HeroSection() {
  const ayatText =
    "وَمِنْ آيَاتِهِ خَلْقُ السَّمَاوَاتِ وَالأَرْضِ وَاخْتِلَافُ أَلْسِنَتِكُمْ وَأَلْوَانِكُمْ ۚ إِنَّ فِي ذَٰلِكَ لَآيَاتٍ لِّلْعَالِمِينَ";
  const translationText =
    '"And among His signs is the Creation of the Heavens and the Earth and the difference of your Tongues and Colours. Surely in this there are signs for the persons having Knowledge."';

  return (
    <section className="hero-shell relative flex min-h-[86vh] items-center overflow-hidden pt-8 md:min-h-[90vh] md:pt-12">
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-100"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="/videos/hero-earth.mp4" type="video/mp4" />
      </video>
      <div className="hero-video-mask absolute inset-0" />

      <div className="ga-container relative z-10 py-16 text-center md:py-20">
        <motion.p
          dir="rtl"
          lang="ar"
          className="hero-arabic mx-auto max-w-6xl"
          variants={revealLine}
          initial="hidden"
          animate="show"
          transition={{ delay: 0.08 }}
        >
          <TypingHighlight text={ayatText} delay={0.2} duration={18} rtl />
        </motion.p>
        <motion.p
          className="hero-translation hero-kicker mx-auto mt-6 max-w-5xl"
          variants={revealLine}
          initial="hidden"
          animate="show"
          transition={{ delay: 0.38 }}
        >
          {translationText}
        </motion.p>

        <motion.div
          variants={revealLine}
          initial="hidden"
          animate="show"
          transition={{ delay: 0.78 }}
          className="hero-divider mx-auto mt-8"
        />

        <motion.h2
          variants={revealContainer}
          initial="hidden"
          animate="show"
          className="hero-main mt-5 md:mt-6"
        >
          <motion.span variants={revealLine} className="hero-main-line text-[#8ac4ff]">
            <TypingHighlight
              text="Raising Akhira-Ready Leaders"
              color="#9fd1ff"
              delay={1.25}
              duration={16.5}
              block
            />
          </motion.span>
          <motion.span variants={revealLine} className="hero-main-line">
            <TypingHighlight
              text="Grounded in Revelation and Equipped to Lead"
              color="#f4fbff"
              delay={1.7}
              duration={17.2}
              block
            />
          </motion.span>
        </motion.h2>
      </div>
    </section>
  );
}
