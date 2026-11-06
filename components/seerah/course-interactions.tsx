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
      <div className={styles.reelHeading}>
        <span className={styles.reelMarker} aria-hidden>
          ▶
        </span>
        <div>
          <p className={styles.eyebrow}>Inside the course</p>
          <h3 className={styles.previewHeading}>A different lens.</h3>
        </div>
      </div>
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
      <div className={styles.reelStage}>
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
                <span className={styles.videoLabel}>
                  Discover the course <span aria-hidden>↗</span>
                </span>
              </button>
            )}
          </div>
          <figcaption>
            <span>{language === "en" ? "English" : "اردو"}</span>
            <span>COURSE FILM · {language === "en" ? "00:50" : "00:51"}</span>
          </figcaption>
        </figure>
      </div>
      <p className={styles.srOnly}>
        Video language is independent of your fee country.
      </p>
    </div>
  );
}

const methodSteps = [
  {
    label: "Report",
    title: "The report",
    icon: "M4 5h7a3 3 0 0 1 3 3v13a4 4 0 0 0-4-2H4z M14 8a3 3 0 0 1 3-3h7v14h-6a4 4 0 0 0-4 2",
    text: "Every account begins with a source. The precise report stays distinct from later claims about it.",
  },
  {
    label: "Transmission",
    title: "Transmission & wording",
    icon: "M8 8h8v8H8z M3 3h4v4H3z M17 17h4v4h-4z M7 7l2 2 M16 16l2 2 M17 3h4v4h-4z M16 8l2-2",
    text: "Transmission and variations in wording shape how a report is assessed.",
  },
  {
    label: "Context",
    title: "Historical context",
    icon: "M12 22s8-7 8-13a8 8 0 1 0-16 0c0 6 8 13 8 13z M12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
    text: "Geography, community and circumstances form the setting of an account.",
  },
  {
    label: "Perspectives",
    title: "Scholarly interpretations",
    icon: "M3 5h8v10H7l-4 4z M14 8h8v10h-4l-4 4z",
    text: "Scholarly readings can differ. Their reasoning belongs alongside their conclusions.",
  },
  {
    label: "Conclusions",
    title: "Conclusions & limits",
    icon: "M4 4h16v17H4z M8 9l2 2 5-5 M8 16h8",
    text: "Evidence, uncertainty and the limits of modern comparisons remain visible together.",
  },
];
export function TeachingApproach() {
  const [selected, setSelected] = useState(0);
  const step = methodSteps[selected];
  return (
    <div className={styles.methodExperience}>
      <div
        className={styles.methodRail}
        role="group"
        aria-label="Source-reading method"
      >
        {methodSteps.map((item, i) => (
          <button
            key={item.label}
            type="button"
            aria-pressed={selected === i}
            aria-controls="method-panel"
            aria-label={approach[i]}
            onClick={() => setSelected(i)}
          >
            <span className={styles.methodIcon} aria-hidden>
              <svg
                viewBox="0 0 28 28"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={item.icon} />
              </svg>
            </span>
            <span className={styles.methodNumber}>0{i + 1}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div
        id="method-panel"
        className={styles.methodPanel}
        aria-live="polite"
        aria-atomic="true"
      >
        <span className={styles.methodWatermark} aria-hidden>
          0{selected + 1}
        </span>
        <div>
          <p className={styles.eyebrow}>
            A closer reading · 0{selected + 1} / 05
          </p>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </div>
        <div className={styles.methodNavigation}>
          <button
            type="button"
            aria-label="Previous reading step"
            onClick={() => setSelected((selected + 4) % 5)}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Next reading step"
            onClick={() => setSelected((selected + 1) % 5)}
          >
            →
          </button>
        </div>
      </div>
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
