import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionIdentity } from "@/lib/auth/session";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import { hostsForIdentity, lmsSessionsAvailable, teacherSessions, type SessionView } from "@/lib/lms/schedule";
import { prisma } from "@/lib/prisma";
import { lmsContentAvailable } from "@/lib/lms/content";
import { recordingsAvailable, recordingsForSessions, type RecordingAdminView } from "@/lib/lms/recordings";
import { externalRecordingsForSessions } from "@/lib/lms/external-recordings";
import { viewerTimeZone } from "@/lib/time/viewer-zone.server";
import { classroomClock } from "@/components/indigo/classroom/clock";
import { ClassroomHeader, SectionHead } from "@/components/indigo/classroom/parts";
import s from "@/components/indigo/classroom/classroom.module.css";
import { scheduleTeacherSession } from "./actions";

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

export default async function TeacherSessionsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> } = { searchParams: Promise.resolve({}) }) {
  const { notice, error } = await searchParams;
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
  const pastIds = past.map(session => session.id);
  const recordingMap = await recordingsAvailable() ? await recordingsForSessions(pastIds) : new Map<string, RecordingAdminView[]>();
  const external = resources ? await externalRecordingsForSessions(pastIds) : [];
  const canViewRevenue = (await getSirahWorkspaceAccess())?.role === "SUPER_ADMIN";

  return (
    <div className={s.page}>
      <ClassroomHeader home="/seerah/classroom/teaching" week={null} percent={null} back={{ href: "/seerah/classroom/teaching", label: "Dashboard" }} />
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
            <p><a href="mailto:admin@tgaawakening.com?subject=Schedule%20a%20class">Request a class time</a> from the course administrator.</p>
            {canViewRevenue && <p><Link href="/seerah/classroom/teaching/revenue">Revenue and partnership</Link></p>}
          </div>
        </section>

        <section id="schedule" className={s.section}><SectionHead id="schedule-heading">Schedule a class</SectionHead>
          {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
          {[...new Map([...upcoming, ...past].map(session => [`${session.host.id}:${session.cohortId}`, session])).values()].map(session => <form key={`${session.host.id}:${session.cohortId}`} action={scheduleTeacherSession}>
            <input type="hidden" name="hostId" value={session.host.id} /><input type="hidden" name="cohortId" value={session.cohortId} /><input type="hidden" name="timeZone" value={clock.timeZone} />
            <p>{session.cohortId} - {session.host.email} - {clock.zoneName}</p>
            <p><label>Title <input name="title" required maxLength={191} /></label></p>
            <p><label>Date and time <input type="datetime-local" name="startsLocal" required /></label></p>
            <p><label>Duration in minutes <input type="number" name="durationMin" min={1} max={480} defaultValue={60} required /></label></p>
            <p><label><input type="checkbox" name="notifyStudents" /> Notify enrolled students</label></p>
            <button type="submit" className={s.btnTeal}>Schedule class</button>
          </form>)}
          {!upcoming.length && !past.length && <p>Ask the administrator to assign your first cohort.</p>}
        </section>
        <section className={s.section} aria-labelledby="upcoming">
          <SectionHead id="upcoming">Upcoming</SectionHead>
          <p className={s.sectionLede}>Times are your time ({clock.zoneName}). Signed in as {identity.email}.</p>
          {upcoming.length ? <Rows sessions={upcoming} clock={clock} startable resources={resources} /> : <p className={s.emptyLine}>Nothing scheduled.</p>}
        </section>

        <section className={s.section} aria-labelledby="teacher-recordings"><SectionHead id="teacher-recordings">My class recordings</SectionHead>
          {past.flatMap(session => [
            ...(recordingMap.get(session.id) ?? []).filter(recording => recording.status === "READY").map(recording => <p key={recording.id}>{session.title} | <a href={`/seerah/classroom/teaching/recordings/${encodeURIComponent(recording.id)}`} target="_blank" rel="noopener noreferrer">Open recording</a></p>),
            ...external.filter(recording => recording.sessionId === session.id && recording.url).map(recording => <p key={recording.id}>{session.title} | <a href={recording.url!} target="_blank" rel="noopener noreferrer">{recording.title}</a></p>),
          ])}
          {!past.some(session => (recordingMap.get(session.id) ?? []).some(recording => recording.status === "READY") || external.some(recording => recording.sessionId === session.id && recording.url)) && <p className={s.emptyLine}>No recordings available yet.</p>}
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
