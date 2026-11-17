"use client";

import { useRef, useState } from "react";
import { videos } from "./content";
import s from "./projects.module.css";

type Key = keyof typeof videos;

/* A button that opens one of the two films in a native <dialog> (Escape,
 * focus trap and focus return come with it). The YouTube player is created
 * only when the dialog opens and removed when it closes, so nothing from
 * YouTube loads until someone presses play. The live page instead autoplays
 * a muted background iframe on every visit. */
export function VideoButton({ which, label, variant = "ghost" }: { which: Key; label: string; variant?: "ghost" | "teal" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const v = videos[which];

  return (
    <>
      <button
        type="button"
        className={`${s.play} ${variant === "teal" ? s.playTeal : ""}`}
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        <span className={s.playIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
          </svg>
        </span>
        {label}
      </button>
      <dialog
        ref={dialog}
        className={s.dialog}
        aria-label={v.title}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // A click on the backdrop (the dialog itself, outside the frame) closes it.
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className={s.dialogFrame}>
          <button type="button" className={s.dialogClose} onClick={() => dialog.current?.close()}>
            Close
          </button>
          <div className={s.dialogVideo}>
            {open ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`}
                title={v.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
