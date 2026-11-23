import Link from "next/link";
import { JOIN_OPENS_MINUTES_BEFORE } from "@/lib/lms/access";
import type { SessionView, StudentSessionView } from "@/lib/lms/schedule";
import { ClassroomCountdown } from "@/components/sirah/classroom-countdown";
import { LiveStatusRefresh } from "@/components/sirah/live-status-refresh";
import type { ClassroomClock } from "./clock";
import { SectionHead } from "./parts";
import s from "./classroom.module.css";

/* Live classes (LMS Phase 2), in the classroom's own styling. The Join link
 * always points at /api/sirah/lms/sessions/[id]/join, which re-checks the
 * enrolment and the window before redirecting to Zoom: no Zoom URL is ever
 * rendered. Join is a link while the class is LIVE on Zoom (the host has
 * started it, even early) or inside the scheduled window. Before that it is a
 * dormant label; the countdown refreshes the page when the window opens, and
 * LiveStatusRefresh re-checks every minute in case the host starts early. */

const minutes = (n: number) => (n % 60 === 0 ? `${n / 60} h` : n > 60 ? `${Math.floor(n / 60)} h ${n % 60} min` : `${n} min`);

export function JoinControl({ session }: { session: StudentSessionView }) {
  if (session.phase === "cancelled") return <span className={s.bjDormant}>This class was cancelled</span>;
  if (session.joinable)
    return (
      <a className={s.bjLive} href={session.joinPath} target="_blank" rel="noopener noreferrer">
        {session.phase === "live" ? "Enter the class" : "Join the class"} <span aria-hidden="true">→</span>
      </a>
    );
  if (session.window === "open")
    return <p className={s.joinHint}>The class is being set up. Refresh in a minute, or check the course group.</p>;
  // Past the scheduled end and Zoom does not report it live.
  if (session.window === "ended") return <span className={s.bjDormant}>The join window has closed</span>;
  return (
    <span className={s.bjDormant} role="link" aria-disabled="true">
      Join opens {JOIN_OPENS_MINUTES_BEFORE} min before, or when the host starts
    </span>
  );
}

/** The next live class: who/when on the left, countdown and Join on the right. */
export function NextLiveClass({
  session,
  now,
  clock,
  headingLevel = 2,
}: {
  session: StudentSessionView;
  now: Date;
  clock: ClassroomClock;
  headingLevel?: 1 | 2;
}) {
  const live = session.phase === "live";
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section className={`${s.dispatch} ${live ? s.isLive : ""}`} aria-label={live ? "Live class" : "Next live class"}>
      <div className={s.dispatchPad}>
        <div>
          <span className={`${s.flag} ${live ? s.fLive : s.fSoon}`}>
            <span className={s.dot} aria-hidden="true" />
            {live ? "Live now" : "Next live class"}
          </span>
          <p className={s.smeta}>Live on Zoom · {minutes(session.durationMin)}</p>
          <Heading className={s.dTitle}>{session.title}</Heading>
          <p className={s.when}>
            <time dateTime={session.startsAt.toISOString()}>{clock.longDate.format(session.startsAt)}</time>{" "}
            <span className={s.tz}>your time ({clock.zoneName})</span>
          </p>
        </div>

        <div className={s.aside}>
          {live ? (
            <p className={s.clabel}>The room is open</p>
          ) : (
            <>
              <p className={s.clabel}>Begins in</p>
              <ClassroomCountdown
                startsAt={session.startsAt.toISOString()}
                serverNow={now.toISOString()}
                joinWindowMinutes={JOIN_OPENS_MINUTES_BEFORE}
                classes={{ root: s.countdown, units: s.count, unit: s.countUnit, value: s.countN, label: s.countL, note: s.srOnly }}
              />
            </>
          )}
          <div className={s.join}>
            <JoinControl session={session} />
            {session.window === "not_open" ? <LiveStatusRefresh /> : null}
            {live ? (
              <p className={s.inroom}>
                Started at <b>{clock.time.format(session.startsAt)}</b> · ends at <b>{clock.time.format(session.endsAt)}</b>
              </p>
            ) : (
              <p className={s.inroom}>The host admits you from the waiting room.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const PILL: Record<SessionView["phase"], { text: string; cls: string }> = {
  upcoming: { text: "Upcoming", cls: s.stLock },
  live: { text: "● Live now", cls: s.stNext },
  past: { text: "Took place", cls: s.stDone },
  cancelled: { text: "Cancelled", cls: s.stLock },
};

/** A list of live classes. `join` adds the Join control to rows inside their window. */
export function LiveSessionRows({ sessions, clock, nextId }: { sessions: StudentSessionView[]; clock: ClassroomClock; nextId?: string }) {
  return (
    <ol className={s.chapters}>
      {sessions.map((session) => {
        const pill = session.id === nextId && session.phase === "upcoming" ? { text: "● Up next", cls: s.stNext } : PILL[session.phase];
        return (
          <li key={session.id}>
            <div className={`${s.chap} ${session.id === nextId ? s.isNext : ""}`}>
              <span className={s.wkn}>{minutes(session.durationMin)}</span>
              <span className={s.ti}>
                {session.title}
                <small>
                  <time dateTime={session.startsAt.toISOString()}>{clock.shortDate.format(session.startsAt)}</time>
                  {session.phase === "past" ? " · recording coming later" : ""}
                </small>
              </span>
              {session.joinable ? (
                <a className={`${s.st} ${s.stNext}`} href={session.joinPath} target="_blank" rel="noopener noreferrer">
                  Join →
                </a>
              ) : (
                <span className={`${s.st} ${pill.cls}`}>{pill.text}</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The classroom overview's live-class section: next class, then what follows. */
export function LiveClassesSection({
  schedule,
  now,
  clock,
  scheduleHref,
}: {
  schedule: { upcoming: StudentSessionView[]; past: StudentSessionView[]; next: StudentSessionView | null };
  now: Date;
  clock: ClassroomClock;
  scheduleHref: string;
}) {
  const later = schedule.upcoming.filter((v) => v.id !== schedule.next?.id).slice(0, 3);
  return (
    <section className={s.section} aria-labelledby="live-classes">
      <SectionHead id="live-classes">Live classes</SectionHead>
      <p className={s.sectionLede}>
        Join from {JOIN_OPENS_MINUTES_BEFORE} minutes before each class starts, or as soon as the host starts it. Times are your time ({clock.zoneName}).{" "}
        <Link href={scheduleHref}>Full schedule</Link>
      </p>
      {schedule.next ? (
        <NextLiveClass session={schedule.next} now={now} clock={clock} />
      ) : (
        <p className={s.emptyLine}>No live class is scheduled right now. New classes appear here as soon as they are booked.</p>
      )}
      {later.length > 0 ? <LiveSessionRows sessions={later} clock={clock} /> : null}
    </section>
  );
}
