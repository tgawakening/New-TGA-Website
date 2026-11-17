"use client";

import { useEffect, useRef, useState } from "react";
import { Star8 } from "../ornaments";
import { topics } from "./content";
import s from "./seerah.module.css";

/* The ten course questions on a native scroll-snap rail: swipe on phones,
 * previous / next buttons everywhere, no carousel library and no autoplay
 * (the reader sets the pace). Each card opens its full "closer look" in a
 * native disclosure, so it works without JavaScript too. */
export function Topics() {
  const rail = useRef<HTMLOListElement>(null);
  const [at, setAt] = useState(0);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const cards = [...el.children] as HTMLElement[];
    // The counter names the first card in view (several show at once on wide screens).
    const visible = new Set<number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const k = cards.indexOf(e.target as HTMLElement);
          if (e.isIntersecting) visible.add(k);
          else visible.delete(k);
        }
        if (visible.size) setAt(Math.min(...visible));
      },
      { root: el, threshold: 0.6 },
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  const move = (dir: number) => {
    const el = rail.current;
    if (!el) return;
    const card = el.children[0] as HTMLElement | undefined;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? 300) + gap), behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className={s.topicsBlock}>
      <div className={s.railControls}>
        <span className={s.railCount} aria-hidden="true">
          {String(at + 1).padStart(2, "0")} / {String(topics.length).padStart(2, "0")}
        </span>
        <button type="button" aria-label="Previous topic" aria-controls="topic-rail" onClick={() => move(-1)}>
          ←
        </button>
        <button type="button" aria-label="Next topic" aria-controls="topic-rail" onClick={() => move(1)}>
          →
        </button>
      </div>
      <ol id="topic-rail" ref={rail} className={s.rail} aria-label="Course topics" tabIndex={0}>
        {topics.map((t, k) => (
          <li key={t.title} className={s.topic}>
            <div className={s.topicHead}>
              <span className={s.topicNum}>{String(k + 1).padStart(2, "0")}</span>
              <Star8 className={s.topicGlyph} />
            </div>
            <p className={s.topicTheme}>{t.theme}</p>
            <h3 className={s.topicTitle}>{t.title}</h3>
            <p className={s.topicQuestion}>{t.question}</p>
            <p className={s.topicFocus}>{t.focus}</p>
            <details className={s.topicMore}>
              <summary>
                Explore this question<span className={s.srOnly}> about {t.title}</span>
              </summary>
              <div className={s.topicDetail}>
                <h4>What students will examine</h4>
                <p>{t.detail}</p>
                <h4>A present-day reflection</h4>
                <p>{t.reflection}</p>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
