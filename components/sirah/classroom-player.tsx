"use client";
import { useEffect, useRef, useState } from "react";

/** The recording player.
 *
 * Embeds (YouTube / Vimeo) start as a click-to-play link in our own
 * document. That link is what the keyboard reaches first, so its focus ring
 * is ordinary :focus-visible in every browser, with no reliance on detecting
 * focus inside a cross-origin frame (which no browser reports reliably). The
 * player loads only on activation, then takes focus so playback keys work.
 * While the loaded frame holds focus, the wrapper is also marked as a best
 * effort. Uploaded recordings use a native <video>, which is focusable and
 * styled like any other control. Without JavaScript the start link opens the
 * recording on its host. */
export function ClassroomPlayer(
  props: {
    title: string;
    classes: { frame: string; focused: string; start: string; startIcon: string; startText: string; startHint: string };
  } & ({ kind: "embed"; src: string; href: string } | { kind: "video"; src: string; contentType?: string | null }),
) {
  const { title, classes } = props;
  const iframe = useRef<HTMLIFrameElement>(null);
  const [started, setStarted] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!started) return;
    iframe.current?.focus();
    // Focus entering the iframe fires window blur (and focusout on whatever
    // had focus); activeElement settles on the next frame, so check then.
    const check = () => requestAnimationFrame(() => setFocused(document.activeElement === iframe.current));
    const clear = () => setFocused(false);
    check();
    window.addEventListener("blur", check);
    document.addEventListener("focusout", check);
    window.addEventListener("focus", clear);
    document.addEventListener("focusin", clear);
    return () => {
      window.removeEventListener("blur", check);
      document.removeEventListener("focusout", check);
      window.removeEventListener("focus", clear);
      document.removeEventListener("focusin", clear);
    };
  }, [started]);

  if (props.kind === "video") {
    return (
      <div className={classes.frame}>
        <video controls preload="metadata" playsInline aria-label={title}>
          <source src={props.src} {...(props.contentType ? { type: props.contentType } : {})} />
          <a href={props.src}>Download the recording</a>
        </video>
      </div>
    );
  }

  if (!started) {
    return (
      <div className={classes.frame}>
        {/* A link, so without JavaScript it still opens the recording. */}
        <a
          className={classes.start}
          href={props.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            event.preventDefault();
            setStarted(true);
          }}
        >
          <span className={classes.startIcon} aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path d="M6 4l10 6-10 6z" />
            </svg>
          </span>
          <span className={classes.startText}>Play the recording</span>
          <span className={classes.startHint}>{title}</span>
        </a>
      </div>
    );
  }

  const src = new URL(props.src);
  src.searchParams.set("autoplay", "1");
  return (
    <div className={`${classes.frame} ${focused ? classes.focused : ""}`}>
      <iframe
        ref={iframe}
        src={src.toString()}
        title={title}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}
