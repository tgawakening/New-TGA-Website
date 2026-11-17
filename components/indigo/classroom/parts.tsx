import Link from "next/link";
import type { ReactNode } from "react";
import {
  SIRAH_JOIN_WINDOW_MINUTES,
  SIRAH_MATERIAL_LABELS,
  type LessonView,
  type MaterialView,
} from "@/lib/sirah/classroom";
import { ClassroomCountdown } from "@/components/sirah/classroom-countdown";
import type { ClassroomClock } from "./clock";
import s from "./classroom.module.css";
import { BrandLogo } from "@/components/brand-logo";

/* ---------- Header ---------- */
export function ClassroomHeader({
  home,
  week,
  percent,
  back,
}: {
  home: string;
  week: { current: number; total: number } | null;
  percent: number | null;
  back: { href: string; label: string };
}) {
  return (
    <header className={s.header}>
      <div className={`${s.wrap} ${s.headRow}`}>
        {/* The real TGA logo, same asset and sizes as the landing nav */}
        <Link href={home} className={s.logo} aria-label="Sīrah Classroom: The Global Awakening">
          <BrandLogo alt="" sizes="(min-width: 64rem) 160px, 112px" priority className={s.logoImg} />
          <span className={s.place} aria-hidden="true">
            <b>Sīrah Classroom</b>
            <span>Beyond Chronology</span>
          </span>
        </Link>
        <span className={s.spacer} />
        {week ? (
          <span className={s.wk}>
            Week <b>{week.current}</b> of {week.total}
          </span>
        ) : null}
        {percent !== null ? (
          <span
            className={s.ring}
            style={{ "--p": percent } as React.CSSProperties}
            role="img"
            aria-label={`${percent}% of sessions completed`}
          >
            <i>{percent}%</i>
          </span>
        ) : null}
        <Link href={back.href} className={s.back}>
          {back.label}
        </Link>
      </div>
    </header>
  );
}

/* ---------- The session "dispatch": who/when on the left, countdown or Join on the right ---------- */
type BandLesson = Pick<
  LessonView,
  "status" | "scheduledAt" | "inJoinWindow" | "zoomJoinUrl" | "zoomMeetingId" | "weekNumber"
>;

export function Dispatch({
  lesson,
  now,
  clock,
  label,
  children,
}: {
  lesson: BandLesson;
  now: Date;
  clock: ClassroomClock;
  label: string;
  children: ReactNode;
}) {
  const live = lesson.status === "live";
  return (
    <section className={`${s.dispatch} ${live ? s.isLive : ""}`} aria-label={label}>
      <div className={s.dispatchPad}>
        <div>
          <span className={`${s.flag} ${live ? s.fLive : s.fSoon}`}>
            <span className={s.dot} aria-hidden="true" />
            {live ? "Live now" : "Upcoming session"}
          </span>
          <p className={s.smeta}>Week {lesson.weekNumber}</p>
          {children}
        </div>

        <div className={s.aside}>
          {live ? (
            <p className={s.clabel}>The room is open</p>
          ) : (
            <>
              <p className={s.clabel}>Begins in</p>
              <ClassroomCountdown
                startsAt={lesson.scheduledAt.toISOString()}
                serverNow={now.toISOString()}
                joinWindowMinutes={SIRAH_JOIN_WINDOW_MINUTES}
                classes={{
                  root: s.countdown,
                  units: s.count,
                  unit: s.countUnit,
                  value: s.countN,
                  label: s.countL,
                  note: s.srOnly,
                }}
              />
            </>
          )}

          <div className={s.join}>
            {lesson.zoomJoinUrl ? (
              <>
                <a className={s.bjLive} href={lesson.zoomJoinUrl} target="_blank" rel="noopener noreferrer">
                  {live ? "Enter the session" : "Join on Zoom"} <span aria-hidden="true">→</span>
                </a>
                {lesson.zoomMeetingId ? <p className={s.inroom}>Meeting ID {lesson.zoomMeetingId}</p> : null}
              </>
            ) : lesson.inJoinWindow ? (
              <p className={s.joinHint}>
                The joining link is on its way. Check the course group if it does not appear in a few minutes.
              </p>
            ) : (
              <span className={s.bjDormant}>Join opens {SIRAH_JOIN_WINDOW_MINUTES} min before</span>
            )}
            {live ? (
              <p className={s.inroom}>
                Started at <b>{clock.time.format(lesson.scheduledAt)}</b> · the recording appears here after
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Materials ---------- */
const KIND_ICON: Record<MaterialView["kind"], { text: string; tone: string }> = {
  SLIDES: { text: "SL", tone: s.icS },
  PDF: { text: "PDF", tone: s.icS },
  READING: { text: "RD", tone: s.icR },
  LINK: { text: "LN", tone: s.icR },
  RECORDING: { text: "▶", tone: s.icV },
};

export function MaterialRows({
  materials,
  recordingPending,
}: {
  materials: Pick<MaterialView, "id" | "title" | "kind" | "url">[];
  /** Show a locked "Recording" row when the session has none yet. */
  recordingPending?: string | null;
}) {
  return (
    <ul className={s.mats}>
      {materials.map((m) => {
        const icon = KIND_ICON[m.kind];
        const body = (
          <>
            <span className={`${s.ic} ${icon.tone}`} aria-hidden="true">
              {icon.text}
            </span>
            <span className={s.txt}>
              <b>{m.title}</b>
              <span>{SIRAH_MATERIAL_LABELS[m.kind]}</span>
            </span>
            {m.url ? (
              <span className={s.go} aria-hidden="true">
                →
              </span>
            ) : null}
          </>
        );
        return (
          <li key={m.id}>
            {m.url ? (
              <a className={s.mat} href={m.url} target="_blank" rel="noopener noreferrer">
                {body}
              </a>
            ) : (
              <span className={s.mat}>{body}</span>
            )}
          </li>
        );
      })}
      {recordingPending ? (
        <li>
          <span className={`${s.mat} ${s.locked}`}>
            <span className={`${s.ic} ${s.icV}`} aria-hidden="true">
              ▶
            </span>
            <span className={s.txt}>
              <b>Recording</b>
              <span>{recordingPending}</span>
            </span>
          </span>
        </li>
      ) : null}
    </ul>
  );
}

/* ---------- Progress bar ---------- */
export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={s.prog}>
      <div className={s.progLab}>
        <span>Course completion</span>
        <b>
          {done} of {total} sessions
        </b>
      </div>
      <div
        className={s.bar}
        role="progressbar"
        aria-label="Sessions you have completed"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------- Completion: a plain form posting to the server action ---------- */
export function CompletionForm({
  action,
  lessonId,
  completed,
  returnTo,
}: {
  action: (form: FormData) => Promise<void>;
  lessonId: string;
  completed: boolean;
  returnTo: string;
}) {
  return (
    <form action={action} className={`${s.completion} ${completed ? s.completionDone : ""}`}>
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="complete" value={completed ? "false" : "true"} />
      <input type="hidden" name="return" value={returnTo} />
      <span className={s.check} aria-hidden="true">
        <svg viewBox="0 0 20 20">
          <path d="M5 10.5l3.2 3.2L15 6.8" />
        </svg>
      </span>
      <div className={s.completionText}>
        <p className={s.completionTitle}>{completed ? "Completed" : "Not completed yet"}</p>
        <p className={s.completionHint}>
          {completed
            ? "You marked this session complete. It counts towards your progress."
            : "Mark it complete once you have attended or watched the recording."}
        </p>
      </div>
      <button type="submit" className={completed ? s.btnGhost : s.btnTeal}>
        {completed ? "Mark as not complete" : "Mark as complete"}
      </button>
    </form>
  );
}

export function SectionHead({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div className={s.shead}>
      <h2 id={id}>{children}</h2>
      <span className={s.rule} aria-hidden="true" />
    </div>
  );
}
