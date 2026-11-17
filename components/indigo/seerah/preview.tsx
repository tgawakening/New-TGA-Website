"use client";

import Image from "next/image";
import { useRef, useState, useSyncExternalStore } from "react";
import { courseConfig } from "./content";
import s from "./seerah.module.css";

/* Same behaviour as CoursePreview in components/seerah/course-interactions.tsx:
 * English or Urdu (a saved choice wins, else Urdu for Pakistan), the choice is
 * remembered under the same key, and the film only loads when played
 * (poster first, preload="none"). */
const KEY = "tga-sirah-video-language";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener("sirah-video-language", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("sirah-video-language", cb);
  };
};
const saved = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "en" || v === "ur" ? v : null;
  } catch {
    return null;
  }
};

export function CoursePreview({ country }: { country: string }) {
  const stored = useSyncExternalStore(subscribe, saved, () => null);
  const [choice, setChoice] = useState<"en" | "ur" | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const player = useRef<HTMLVideoElement>(null);
  const language = choice || stored || (country === "PK" ? "ur" : "en");
  const video = courseConfig.videos.find((v) => v.language === language)!;

  const pick = (v: "en" | "ur") => {
    player.current?.pause();
    setPlaying(null);
    setChoice(v);
    try {
      localStorage.setItem(KEY, v);
      window.dispatchEvent(new Event("sirah-video-language"));
    } catch {
      /* The explicit choice still applies when storage is blocked. */
    }
  };

  return (
    <figure className={s.film}>
      <div className={s.filmLang} role="group" aria-label="Course video language">
        {(["en", "ur"] as const).map((v) => (
          <button key={v} type="button" lang={v} aria-pressed={language === v} onClick={() => pick(v)}>
            {v === "en" ? "English" : "اردو"}
          </button>
        ))}
      </div>
      <div className={s.filmFrame}>
        {playing === language ? (
          <video
            ref={player}
            key={language}
            controls
            autoPlay
            playsInline
            preload="none"
            width={video.width}
            height={video.height}
            poster={video.poster.src}
            aria-label={video.title}
          >
            <source src={video.src} type="video/mp4" />
            Your browser does not support video. <a href={video.src}>Download the overview</a>.
          </video>
        ) : (
          <button type="button" className={s.filmPoster} onClick={() => setPlaying(language)} aria-label={`Play ${video.title}`}>
            <Image src={video.poster.src} alt={video.poster.alt} fill sizes="(min-width: 56rem) 300px, 70vw" />
            <span className={s.filmPlay} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <figcaption className={s.filmCaption}>
        <span>Inside the course</span>
        <span>
          Course film · {language === "en" ? "English · 00:50" : "اردو · 00:51"}
        </span>
      </figcaption>
      <p className={s.srOnly}>Video language is independent of your fee country.</p>
    </figure>
  );
}
