"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { approach, courseConfig } from "./course-config";
import styles from "./seerah.module.css";

const languageKey = "tga-sirah-video-language";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("sirah-video-language", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("sirah-video-language", callback);
  };
}
function savedLanguage() {
  try {
    const value = localStorage.getItem(languageKey);
    return value === "en" || value === "ur" ? value : null;
  } catch {
    return null;
  }
}

export function CoursePreview({ country }: { country: string }) {
  const saved = useSyncExternalStore(subscribe, savedLanguage, () => null);
  const [choice, setChoice] = useState<"en" | "ur" | null>(null);
  const language = choice || saved || (country === "PK" ? "ur" : "en");
  const [playingLanguage, setPlayingLanguage] = useState<string | null>(null);
  const video = courseConfig.videos.find((item) => item.language === language)!;
  const player = useRef<HTMLVideoElement>(null);
  function select(value: "en" | "ur") {
    player.current?.pause();
    setPlayingLanguage(null);
    setChoice(value);
    try {
      localStorage.setItem(languageKey, value);
      window.dispatchEvent(new Event("sirah-video-language"));
    } catch {
      /* Explicit choice still works when storage is blocked. */
    }
  }
  return (
    <div className={styles.previewColumn}>
      <div
        className={styles.languageSelector}
        role="group"
        aria-label="Course video language"
      >
        {(["en", "ur"] as const).map((value) => (
          <button
            key={value}
            type="button"
            lang={value}
            aria-pressed={language === value}
            onClick={() => select(value)}
          >
            {value === "en" ? "English" : "اردو"}
          </button>
        ))}
      </div>
      <p className={styles.languageHelp}>
        Choose your video language independently of your fee country.
      </p>
      <figure className={styles.video}>
        <div style={{ aspectRatio: "9 / 16" }}>
          {playingLanguage === language ? (
            <video
              ref={player}
              key={language}
              controls
              autoPlay
              playsInline
              preload="none"
              width={720}
              height={1280}
              poster={video.poster.src}
              aria-label={video.title}
            >
              <source src={video.src} type="video/mp4" />
              Your browser does not support video.{" "}
              <a href={video.src}>Download the overview</a>.
            </video>
          ) : (
            <button
              type="button"
              onClick={() => setPlayingLanguage(language)}
              aria-label={`Play ${video.title}`}
            >
              <Image
                src={video.poster.src}
                alt={video.poster.alt}
                fill
                sizes="(max-width: 760px) 80vw, 340px"
              />
              <span className={styles.play} aria-hidden>
                ▶
              </span>
              <span className={styles.videoLabel}>Watch the overview</span>
            </button>
          )}
        </div>
        <figcaption>{video.title}</figcaption>
      </figure>
    </div>
  );
}

const explanations = [
  "Begin with the precise question and identify the report and its source. Separate the account from claims made about it.",
  "Examine how the report was transmitted and compare its wording. Ask what the evidence can and cannot establish.",
  "Read the account in its geographical, social and historical setting before considering present-day comparisons.",
  "Compare scholarly interpretations and the reasons offered for them. Keep differences of interpretation visible.",
  "Discuss conclusions alongside uncertainty and the limits of comparison. A modern reflection does not establish historical equivalence.",
];
export function TeachingApproach() {
  const [selected, setSelected] = useState(0);
  return (
    <div className={styles.teachingStepper}>
      <ol className={styles.approach}>
        {approach.map((step, i) => (
          <li key={step}>
            <button
              type="button"
              aria-expanded={selected === i}
              aria-controls={`method-step-${i}`}
              onClick={() => setSelected(i)}
            >
              <span>0{i + 1}</span>
              {step}
            </button>
            <div
              id={`method-step-${i}`}
              hidden={selected !== i}
              className={styles.stepExplanation}
            >
              {explanations[i]}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function useSectionExperience(
  root: React.RefObject<HTMLDivElement | null>,
) {
  const [active, setActive] = useState("overview");
  useEffect(() => {
    if (!root.current || !("IntersectionObserver" in window)) return;
    const elements = root.current.querySelectorAll<HTMLElement>(
      "main > section, main > aside",
    );
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.revealed = "true";
            reveal.unobserve(entry.target);
          }
      },
      { threshold: 0.06 },
    );
    elements.forEach((element) => reveal.observe(element));
    const navigation = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(
          (entry) => entry.isIntersecting && entry.target.id,
        );
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: 0 },
    );
    root.current
      .querySelectorAll("section[id]")
      .forEach((element) => navigation.observe(element));
    return () => {
      reveal.disconnect();
      navigation.disconnect();
    };
  }, [root]);
  return active;
}
