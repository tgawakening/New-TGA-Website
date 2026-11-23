import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionIdentity } from "@/lib/auth/session";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import { hostsForIdentity, lmsSessionsAvailable, teacherSessions, type SessionView } from "@/lib/lms/schedule";
import { prisma } from "@/lib/prisma";
import { lmsContentAvailable } from "@/lib/lms/content";
import { viewerTimeZone } from "@/lib/time/viewer-zone.server";
import { classroomClock } from "@/components/indigo/classroom/clock";
import { ClassroomHeader, SectionHead } from "@/components/indigo/classroom/parts";
import s from "@/components/indigo/classroom/classroom.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `My sessions | ${SIRAH_TITLE}`,
  robots: { index: false, follow: false },
};

/* Teacher portal. No role or schema: a teacher is a signed-in account whose
 * email is an ACTIVE ZoomHost's email, exactly the rule the start route
 * (/api/sirah/lms/sessions/[id]/start) enforces. Anyone else gets a 404, so
 * the portal is invisible to them. */

const PILL: Record<SessionView["phase"], { text: string; cls: string }> = {
  upcoming: { text: "Scheduled", cls: s.stLock },
  live: { text: "● Live now", cls: s.stNext },
  past: { text: "Took place", cls: s.stDone },
  cancelled: { text: "Cancelled", cls: s.stLock },
};

function Rows({
  sessions,
  clock,
  startable,
  resources,
}: {
  sessions: SessionView[];
  clock: ReturnType<typeof classroomClock>;
  startable: boolean;
  /** Phase 5: link each session to its resources page (hosts add and publish files and links). */
  resources: boolean;
}) {
  return (
    <ol className={s.chapters}>
      {sessions.map((session) => {
        const canStart = startable && (session.phase === "upcoming" || session.phase === "live") && Boolean(session.zoomMeetingId);
        return (
          <li key={session.id}>
            <div className={`${s.chap} ${session.phase === "live" ? s.isNext : ""}`}>
              <span className={s.wkn}>{session.durationMin} min</span>
              <span className={s.ti}>
                {session.title}
                <small>
                  <time dateTime={session.startsAt.toISOString()}>{clock.shortDate.format(session.startsAt)}</time> · {session.cohortId}
                  {resources ? (
                    <>
                      {" · "}
                      <a href={`/seerah/classroom/teaching/resources/${encodeURIComponent(session.id)}`}>Resources</a>
                    </>
                  ) : null}
                </small>
              </span>
              {canStart ? (
                <a className={s.bjLive} href={session.startPath} target="_blank" rel="noopener noreferrer">
                  Start as host <span aria-hidden="true">→</span>
                </a>
              ) : (
                <span className={`${s.st} ${PILL[session.phase].cls}`}>{PILL[session.phase].text}</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default async function TeacherSessionsPage() {
  const identity = await getSessionIdentity();
  if (!identity) redirect("/login");
  if (!(await lmsSessionsAvailable())) notFound();
  const hosts = await hostsForIdentity(identity);
  if (!hosts.length) notFound();

  const now = new Date();
  const profile = await prisma.studentProfile.findUnique({ where: { userId: identity.id }, select: { timezone: true } });
  const clock = classroomClock((await viewerTimeZone()) ?? profile?.timezone);
  const { upcoming, past } = await teacherSessions(
    hosts.map((h) => h.id),
    now,
  );
  const next = upcoming.find((v) => v.phase !== "cancelled");
  const resources = await lmsContentAvailable();

  return (
    <div className={s.page}>
      <ClassroomHeader home="/seerah/classroom/teaching" week={null} percent={null} back={{ href: "/dashboard", label: "Dashboard" }} />
      <main className={s.wrap}>
        <section className={s.hero} aria-labelledby="teaching-title">
          <p className={s.eyebrow}>Teaching</p>
          <div className={s.empty}>
            <h1 id="teaching-title">My sessions</h1>
            <p>
              {next
                ? `Next: ${next.title}, ${clock.longDate.format(next.startsAt)} (${clock.zoneName}).`
                : "You have no upcoming sessions."}{" "}
              Start as host opens Zoom with a fresh host link each time; students wait in the waiting room until you admit them.
            </p>
          </div>
        </section>

        <section className={s.section} aria-labelledby="upcoming">
          <SectionHead id="upcoming">Upcoming</SectionHead>
          <p className={s.sectionLede}>Times are your time ({clock.zoneName}). Signed in as {identity.email}.</p>
          {upcoming.length ? <Rows sessions={upcoming} clock={clock} startable resources={resources} /> : <p className={s.emptyLine}>Nothing scheduled.</p>}
        </section>

        <section className={s.section} aria-labelledby="past">
          <SectionHead id="past">Past</SectionHead>
          {past.length ? <Rows sessions={past} clock={clock} startable={false} resources={resources} /> : <p className={s.emptyLine}>No past sessions yet.</p>}
        </section>
      </main>
      <footer className={s.foot}>
        <b>Sīrah · Beyond Chronology</b> · The Global Awakening
      </footer>
    </div>
  );
}
