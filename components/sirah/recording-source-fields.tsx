"use client";

import { useId, useState } from "react";
import styles from "@/components/sirah/admin-classroom.module.css";

type Source = "bunny" | "link";

/**
 * Source picker for a standalone recording. "Bunny video (protected)" stores
 * only a Bunny video ID; students get a short-lived, server-signed embed that
 * plays on this site only. "Public link (shareable)" stores a plain URL that
 * anyone holding it can open. Only the chosen field is submitted.
 */
export function RecordingSourceFields({
  defaultSource = "bunny",
  defaultUrl = "",
  defaultVideoId = "",
  bunnyReady,
}: {
  defaultSource?: Source;
  defaultUrl?: string;
  defaultVideoId?: string;
  bunnyReady: boolean;
}) {
  const [source, setSource] = useState<Source>(defaultSource);
  const name = useId();
  return (
    <>
      <div className={styles.checks} role="radiogroup" aria-label="Recording source">
        <label className={styles.check}>
          <input type="radio" name="source" value="bunny" checked={source === "bunny"} onChange={() => setSource("bunny")} />
          Bunny video (protected){bunnyReady ? "" : " — not configured on this server yet"}
        </label>
        <label className={styles.check}>
          <input type="radio" name="source" value="link" checked={source === "link"} onChange={() => setSource("link")} />
          Public link (shareable) — anyone with the link can watch
        </label>
      </div>
      {source === "bunny" ? (
        <label className={styles.label} htmlFor={`${name}-bunny`}>
          Bunny video ID
          <input id={`${name}-bunny`} className={styles.input} name="bunnyVideoId" defaultValue={defaultVideoId} placeholder="1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d" maxLength={1024} autoComplete="off" spellCheck={false} required />
        </label>
      ) : (
        <label className={styles.label} htmlFor={`${name}-url`}>
          Public link
          <input id={`${name}-url`} className={styles.input} type="url" name="url" defaultValue={defaultUrl} placeholder="https://" maxLength={1024} required />
        </label>
      )}
    </>
  );
}
