"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { fadeInUp } from "@/components/home/sections/shared";
import { CtaArrow } from "@/components/home/sections/courses";

export function FeeWaiverSection() {
  return (
    <section className="ga-section ga-fee-section">
      <div className="ga-container">
        <motion.article {...fadeInUp} className="ga-fee-card text-center">
          <div className="ga-fee-icon" aria-hidden>
            <svg viewBox="0 0 24 24" className="ga-fee-icon-svg">
              <path
                d="M12 20.2c-.4 0-.8-.1-1.1-.4C6 15.8 3 13.1 3 9.5 3 7 5 5 7.5 5c1.5 0 3 .7 4 1.9 1-1.2 2.5-1.9 4-1.9C18 5 20 7 20 9.5c0 3.6-3 6.3-7.9 10.3-.3.3-.7.4-1.1.4z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h3 className="ga-fee-title mt-5 font-semibold text-white">
            No One Should Be Left Behind in Seeking Knowledge
          </h3>
          <p className="ga-copy mx-auto mt-4 max-w-3xl ga-fee-copy">
            We believe Islamic education is a right, not a privilege. If financial circumstances are holding you back,
            do not let that stop you. We offer full fee waivers for those in genuine need.
          </p>
          <Link href="/seerah/fee-warrior" className="ga-fee-btn mt-7">
            Apply for Fee Waiver <CtaArrow />
          </Link>
          <p className="ga-fee-note mt-5">Your request is completely confidential. We&apos;re here to help.</p>
        </motion.article>
      </div>
    </section>
  );
}
