"use client";
import { useEffect, useRef, useState } from "react";

/** Recording embed with a visible keyboard focus ring. Browsers do not match
 * :focus on an iframe once focus moves into its cross-origin document, so CSS
 * alone cannot show it; this marks the frame while the player has focus.
 * Without JavaScript the player still loads and works. */
export function ClassroomPlayer({
  src,
  title,
  frameClassName,
  focusedClassName,
}: {
  src: string;
  title: string;
  frameClassName: string;
  focusedClassName: string;
}) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    // Focus entering the iframe fires window blur (and focusout on whatever
    // had focus); activeElement settles on the next frame, so check then.
    const check = () => requestAnimationFrame(() => setFocused(document.activeElement === iframe.current));
    const clear = () => setFocused(false);
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
  }, []);

  return (
    <div className={`${frameClassName} ${focused ? focusedClassName : ""}`}>
      <iframe
        ref={iframe}
        src={src}
        title={title}
        loading="lazy"
        allow="fullscreen; picture-in-picture; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}
