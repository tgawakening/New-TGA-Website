"use client";
import { useState } from "react";
import p from "./phase5.module.css";

/** "Subscribe to calendar": the webcal link opens the device's calendar app;
 * the https address can be pasted into Google Calendar ("From URL"). The
 * address is personal: it is signed for this student only. */
export function CalendarSubscribe({ https, webcal }: { https: string; webcal: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(https);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className={p.calendar}>
      <p>Get every live class in your own calendar. It updates itself when a class is added, moved or cancelled.</p>
      <div className={p.calendarActions}>
        <a className={p.btn} href={webcal}>
          Subscribe to calendar
        </a>
        <button type="button" className={p.btnGhost} onClick={copy}>
          {copied ? "Link copied" : "Copy calendar link"}
        </button>
      </div>
      <label>
        <span className={p.small}>For Google Calendar: Other calendars, From URL, then paste this link.</span>
        <input className={p.feedUrl} readOnly value={https} onFocus={(event) => event.currentTarget.select()} aria-label="Your calendar link" />
      </label>
      <p className={p.small}>This link is personal to you. Do not share it.</p>
    </div>
  );
}
