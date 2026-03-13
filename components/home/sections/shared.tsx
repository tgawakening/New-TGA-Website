"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

export const fadeInUp = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.7, ease: "easeOut" },
} as const;

export const revealContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.14,
      delayChildren: 0.12,
    },
  },
} as const;

export const revealLine = {
  hidden: { opacity: 0, y: 22, clipPath: "inset(0 0 100% 0)" },
  show: {
    opacity: 1,
    y: 0,
    clipPath: "inset(0 0 0% 0)",
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
} as const;

export function TypingHighlight({
  text,
  color,
  delay = 0,
  duration = 10.5,
  block = false,
  rtl = false,
}: {
  text: string;
  color?: string;
  delay?: number;
  duration?: number;
  block?: boolean;
  rtl?: boolean;
}) {
  return (
    <span
      className={`hero-typing-highlight ${block ? "hero-typing-block" : ""} ${rtl ? "hero-typing-rtl" : ""}`}
      data-text={text}
      style={
        {
          "--hero-highlight-color": color ?? "#f4fbff",
          "--hero-highlight-delay": `${delay}s`,
          "--hero-highlight-duration": `${duration}s`,
        } as CSSProperties
      }
    >
      {text}
    </span>
  );
}

export function CountUpStat({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [count, setCount] = useState(0);

  const target = Number.parseInt(value.replace(/[^\d]/g, ""), 10) || 0;
  const suffix = value.replace(/[\d]/g, "");

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const duration = 1300;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setCount(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

type SectionHeadingProps = {
  badge: string;
  title: ReactNode;
  subtitle?: string;
  center?: boolean;
};

export function SectionHeading({
  badge,
  title,
  subtitle,
  center = true,
}: SectionHeadingProps) {
  return (
    <motion.div
      {...fadeInUp}
      className={center ? "mx-auto max-w-4xl text-center" : "max-w-4xl"}
    >
      <span className="ga-badge">{badge}</span>
      <h2 className="ga-heading mt-5">{title}</h2>
      {subtitle ? <p className="ga-copy mt-5">{subtitle}</p> : null}
    </motion.div>
  );
}
