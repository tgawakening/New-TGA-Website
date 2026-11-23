"use client";

import s from "./classroom.module.css";

/* Plays a class recording through the enrolment-checked play route (`src` is
 * /api/sirah/lms/recordings/[id]/play), which redirects to a short-lived
 * storage URL: no storage or Zoom URL is ever in the page. Stream only: the
 * download control and the context menu are turned off. That deters casual
 * saving; it is not DRM. */
export function RecordingPlayer({ src, kind, title }: { src: string; kind: "VIDEO" | "AUDIO"; title: string }) {
  const common = {
    src,
    controls: true,
    preload: "metadata" as const,
    controlsList: "nodownload",
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    "aria-label": `Recording: ${title}`,
  };
  return kind === "AUDIO" ? (
    <audio className={s.recordingAudio} {...common} />
  ) : (
    // No captions track yet: transcripts are stored for a later update.
    <video className={s.recordingVideo} playsInline disablePictureInPicture {...common} />
  );
}
