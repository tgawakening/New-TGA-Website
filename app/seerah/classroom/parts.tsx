import type { ReactNode } from "react";
import {
  SIRAH_DEFAULT_TIMEZONE,
  SIRAH_JOIN_WINDOW_MINUTES,
  SIRAH_MATERIAL_LABELS,
  isValidTimeZone,
  type LessonView,
  type MaterialView,
  type SirahLessonStatus,
} from "@/lib/sirah/classroom";
import { ClassroomCountdown } from "@/components/sirah/classroom-countdown";
import { toggleLessonComplete } from "./actions";
import styles from "./classroom.module.css";

/** Shared pieces of the classroom overview and the session page. */

export const STATUS_TEXT: Record<SirahLessonStatus, string> = {
  upcoming: "Upcoming",
  live: "Live now",
  past: "Took place",
};

/** Dates in the student's profile zone, London when unset or unknown. */
export function classroomClock(profileZone: string | null | undefined) {
  const timeZone = profileZone && isValidTimeZone(profileZone) ? profileZone : SIRAH_DEFAULT_TIMEZONE;
  const make = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone, ...options });
  return {
    timeZone,
    zoneName:
      make({ timeZoneName: "long" })
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName")?.value || timeZone,
    longDate: make({ weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true }),
    shortDate: make({ weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }),
    noticeDate: make({ day: "numeric", month: "long", year: "numeric" }),
  };
}

/** The charcoal band: the session on the left, its countdown and Join on the
 * right. The Join link exists only if the view builder let it through. */
export function SessionBand({
  lesson,
  now,
  label,
  children,
}: {
  lesson: Pick<LessonView, "status" | "scheduledAt" | "inJoinWindow" | "zoomJoinUrl" | "zoomMeetingId">;
  now: Date;
  label: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.next} aria-label={label}>
      <div className={styles.nextInner}>
        <div>{children}</div>
        <div className={styles.nextAside}>
          {lesson.status === "live" && <p className={styles.liveNow}>Live now</p>}
          {lesson.status === "upcoming" && (
            <ClassroomCountdown
              startsAt={lesson.scheduledAt.toISOString()}
              serverNow={now.toISOString()}
              joinWindowMinutes={SIRAH_JOIN_WINDOW_MINUTES}
              classes={{
                root: styles.countdown,
                units: styles.units,
                unit: styles.unit,
                value: styles.unitValue,
                label: styles.unitLabel,
                note: styles.countdownNote,
              }}
            />
          )}
          {lesson.zoomJoinUrl ? (
            <>
              <a className={styles.join} href={lesson.zoomJoinUrl} target="_blank" rel="noopener noreferrer">
                Join on Zoom
              </a>
              {lesson.zoomMeetingId && <span className={styles.meetingId}>Meeting ID {lesson.zoomMeetingId}</span>}
            </>
          ) : (
            <p className={styles.joinHint}>
              {lesson.inJoinWindow
                ? "The joining link is on its way. Check the course group if it does not appear in a few minutes."
                : `The Join button appears here ${SIRAH_JOIN_WINDOW_MINUTES} minutes before the start.`}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** `groupKind`: inside a card already titled by kind, rows of that kind drop
 * the repeated label; only a different kind (a PDF among readings) shows one. */
export function MaterialList({
  materials,
  groupKind,
}: {
  materials: Pick<MaterialView, "id" | "title" | "kind" | "url">[];
  groupKind?: MaterialView["kind"];
}) {
  return (
    <ul className={`${styles.materials} ${groupKind ? styles.materialsGrouped : ""}`}>
      {materials.map((material) => (
        <li key={material.id} className={material.kind === "RECORDING" ? styles.recording : undefined}>
          {material.kind !== groupKind && <span className={styles.kind}>{SIRAH_MATERIAL_LABELS[material.kind]}</span>}
          {material.url ? (
            <a href={material.url} target="_blank" rel="noopener noreferrer">
              {material.title}
            </a>
          ) : (
            <span>{material.title}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** A plain form posting to the server action: works without JavaScript. */
export function CompletionForm({
  lessonId,
  completed,
  returnTo,
}: {
  lessonId: string;
  completed: boolean;
  returnTo: string;
}) {
  return (
    <form action={toggleLessonComplete} className={`${styles.completion} ${completed ? styles.completionDone : ""}`}>
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="complete" value={completed ? "false" : "true"} />
      <input type="hidden" name="return" value={returnTo} />
      <span className={styles.checkMark} aria-hidden="true">
        <svg viewBox="0 0 20 20">
          <path d="M5 10.5l3.2 3.2L15 6.8" />
        </svg>
      </span>
      <div className={styles.completionText}>
        <p className={styles.completionTitle}>{completed ? "Completed" : "Not completed yet"}</p>
        <p className={styles.completionHint}>
          {completed
            ? "You marked this session complete. It counts towards your progress."
            : "Mark it complete once you have attended or watched the recording."}
        </p>
      </div>
      <button type="submit" className={completed ? styles.secondaryButton : styles.primaryButton}>
        {completed ? "Mark as not complete" : "Mark as complete"}
      </button>
    </form>
  );
}
