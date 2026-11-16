"use client";

import { useSyncExternalStore } from "react";
import styles from "./sirah-notice.module.css";

/** Dismissal lasts for this browser tab and only for this exact text, so a
 * changed notice shows again. */
const storageKey = (text: string) => `sirah-notice-dismissed:${text}`;

// Fallback when sessionStorage is blocked: dismissed until the page reloads.
const dismissedInMemory = new Set<string>();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readDismissed(text: string) {
  if (dismissedInMemory.has(text)) return true;
  try {
    return sessionStorage.getItem(storageKey(text)) === "1";
  } catch {
    return false;
  }
}

export function SirahNoticeBanner({ text }: { text: string }) {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => readDismissed(text),
    () => false,
  );

  if (dismissed) return null;

  function dismiss() {
    dismissedInMemory.add(text);
    try {
      sessionStorage.setItem(storageKey(text), "1");
    } catch {
      // Storage blocked: the in-memory flag still hides it on this page.
    }
    listeners.forEach((listener) => listener());
  }

  return (
    <aside aria-label="Notice" className={styles.notice}>
      <p className={styles.text}>{text}</p>
      <button type="button" className={styles.dismiss} onClick={dismiss} aria-label="Dismiss notice">
        <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>
    </aside>
  );
}
