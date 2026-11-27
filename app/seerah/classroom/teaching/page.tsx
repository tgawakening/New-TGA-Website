import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionIdentity } from "@/lib/auth/session";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import { hostsForIdentity, lmsSessionsAvailable, teacherSessions, type SessionView } from "@/lib/lms/schedule";
import { prisma } from "@/lib/prisma";
import { lmsContentAvailable } from "@/lib/lms/content";
import { recordingsAvailable, recordingsForSessions, type RecordingAdminView } from "@/lib/lms/recordings";
import { externalRecordingsForSessions } from "@/lib/lms/external-recordings";
import { viewerTimeZone } from "@/lib/time/viewer-zone.server";
import { classroomClock } from "@/components/indigo/classroom/clock";
import { ClassroomHeader } from "@/components/indigo/classroom/parts";
import { teacherEarningsAccess } from "@/services/teacher-earnings.service";
import c from "@/components/indigo/classroom/classroom.module.css";
import t from "@/components/indigo/classroom/teaching.module.css";
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
  upcoming: { text: "Scheduled", cls: "" },
  live: { text: "● Live now", cls: t.chipLive },
  past: { text: "Took place", cls: t.chipDone },
  cancelled: { text: "Cancelled", cls: "" },
};

type Clock = ReturnType<typeof classroomClock>;

function DateBlock({ at, clock }: { at: Date; clock: Clock }) {
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: clock.timeZone }).format(at);
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: clock.timeZone }).format(at);
  return (
    <span className={t.date} aria-hidden="true">
      <span className={t.dateDay}>{day}</span>
      <span className={t.dateMonth}>{month}</span>
    </span>
  );
}

function Rows({ sessions, clock, startable, resources }: { sessions: SessionView[]; clock: Clock; startable: boolean; resources: boolean }) {
  return (
    <ol className={t.rows}>
      {sessions.map((session) => {
        const canStart = startable && (session.phase === "upcoming" || session.phase === "live") && Boolean(session.zoomMeetingId);
        return (
          <li key={session.id} className={`${t.row} ${session.phase === "live" ? t.rowLive : ""}`}>
            <DateBlock at={session.startsAt} clock={clock} />
            <span className={t.rowMain}>
              <span className={t.rowTitle}>{session.title}</span>
              <span className={t.rowMeta}>
                <time dateTime={session.startsAt.toISOString()}>{clock.shortDate.format(session.startsAt)}</time>
                <span>{session.durationMin} min</span>
                <span>{session.cohortId}</span>
              </span>
            </span>
            <span className={t.rowActions}>
              {resources ? (
                <a className={`${t.btnGhost} ${t.btnSmall}`} href={`/seerah/classroom/teaching/resources/${encodeURIComponent(session.id)}`}>
                  Resources
                </a>
              ) : null}
              {canStart ? (
                <a className={t.btnLive} href={session.startPath} target="_blank" rel="noopener noreferrer">
                  Start as host <span aria-hidden="true">→</span>
                </a>
              ) : (
                <span className={`${t.chip} ${PILL[session.phase].cls}`}>{PILL[session.phase].text}</span>
              )}
            </span>
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
  const canViewEarnings = (await teacherEarningsAccess(identity)).allowed;
  // One schedule form per host and cohort the teacher already teaches.
  const cohorts = [...new Map([...upcoming, ...past].map(session => [`${session.host.id}:${session.cohortId}`, session])).values()];
  const recordings = past.flatMap(session => [
    ...(recordingMap.get(session.id) ?? []).filter(recording => recording.status === "READY").map(recording => ({ key: recording.id, session, title: session.title, href: `/seerah/classroom/teaching/recordings/${encodeURIComponent(recording.id)}` })),
    ...external.filter(recording => recording.sessionId === session.id && recording.url).map(recording => ({ key: recording.id, session, title: recording.title || session.title, href: recording.url! })),
  ]);
  const firstName = (identity.fullName || "").trim().split(/\s+/)[0];

  return (
    <div className={c.page}>
      <ClassroomHeader home="/seerah/classroom/teaching" week={null} percent={null} back={{ href: "/seerah/classroom/teaching", label: "Dashboard" }} />
      <main className={c.wrap}>
        <section className={t.hero} aria-labelledby="teaching-title">
          <div>
            <p className={t.eyebrow}>Teaching{firstName ? ` · ${firstName}` : ""}</p>
            <h1 id="teaching-title" className={t.title}>My sessions</h1>
            <p className={t.lede}>
              Start as host opens Zoom with a fresh host link each time; students wait in the waiting room until you admit them. Times are your time ({clock.zoneName}).
            </p>
          </div>
          {next ? (
            <div className={`${t.next} ${next.phase === "live" ? t.nextLive : ""}`}>
              <div>
                <p className={t.cardTitle}>{next.phase === "live" ? "Happening now" : "Your next class"}</p>
                <p className={t.nextTitle}>{next.title}</p>
                <p className={t.nextWhen}>
                  {clock.longDate.format(next.startsAt)} ({clock.zoneName}) · {next.durationMin} min
                </p>
              </div>
              <a className={t.btnGhost} href="#upcoming">Go to upcoming</a>
            </div>
          ) : (
            <p className={t.empty}>You have no upcoming sessions. Schedule one below, or request a time from the course administrator.</p>
          )}
          <div className={t.heroLinks}>
            <a className={t.btnGhost} href="#schedule">Schedule a class</a>
            {canViewEarnings ? <Link className={t.btnGhost} href="/seerah/classroom/teaching/revenue">My earnings</Link> : null}
            <a className={t.btnGhost} href="mailto:admin@tgaawakening.com?subject=Schedule%20a%20class">Request a class time</a>
          </div>
        </section>

        <section id="schedule" className={t.section} aria-labelledby="schedule-heading">
          <div className={t.sectionHead}>
            <h2 id="schedule-heading" className={t.sectionTitle}>Schedule a class</h2>
            <span className={t.sectionMeta}>For cohorts you already teach</span>
          </div>
          <div className={t.grid}>
            {notice ? <p className={t.flash} role="status">{notice}</p> : null}
            {error ? <p className={t.flashError} role="alert">{error}</p> : null}
            {cohorts.length ? (
              <div className={`${t.grid} ${cohorts.length > 1 ? t.grid2 : ""}`}>
                {cohorts.map(session => (
                  <form key={`${session.host.id}:${session.cohortId}`} action={scheduleTeacherSession} className={`${t.card} ${t.form}`}>
                    <input type="hidden" name="hostId" value={session.host.id} />
                    <input type="hidden" name="cohortId" value={session.cohortId} />
                    <input type="hidden" name="timeZone" value={clock.timeZone} />
                    <div className={t.cardHead}>
                      <p className={t.cardTitle}>{session.cohortId}</p>
                      <span className={t.chip}>{clock.zoneName}</span>
                    </div>
                    <p className={t.small}>Hosted from {session.host.email}</p>
                    <div className={t.fields}>
                      <label className={`${t.field} ${t.full}`}>
                        Title
                        <input name="title" required maxLength={191} placeholder="e.g. Week 7: The Treaty of Hudaybiyyah" />
                      </label>
                      <label className={t.field}>
                        Date and time <span className={t.hint}>({clock.zoneName})</span>
                        <input type="datetime-local" name="startsLocal" required />
                      </label>
                      <label className={t.field}>
                        Duration (minutes)
                        <input type="number" name="durationMin" min={1} max={480} defaultValue={60} required />
                      </label>
                    </div>
                    <div className={t.formFoot}>
                      <label className={t.check}>
                        <input type="checkbox" name="notifyStudents" /> Notify enrolled students
                      </label>
                      <button type="submit" className={t.btn}>Schedule class</button>
                    </div>
                  </form>
                ))}
              </div>
            ) : (
              <p className={t.empty}>Ask the administrator to assign your first cohort. Once you have a class, you can schedule more here.</p>
            )}
          </div>
        </section>

        <section className={t.section} aria-labelledby="upcoming">
          <div className={t.sectionHead}>
            <h2 id="upcoming" className={t.sectionTitle}>Upcoming</h2>
            <span className={t.sectionMeta}>Signed in as {identity.email}</span>
          </div>
          {upcoming.length ? <Rows sessions={upcoming} clock={clock} startable resources={resources} /> : <p className={t.empty}>Nothing scheduled.</p>}
        </section>

        <section className={t.section} aria-labelledby="teacher-recordings">
          <div className={t.sectionHead}>
            <h2 id="teacher-recordings" className={t.sectionTitle}>My class recordings</h2>
            {recordings.length ? <span className={t.sectionMeta}>{recordings.length} {recordings.length === 1 ? "recording" : "recordings"}</span> : null}
          </div>
          {recordings.length ? (
            <ul className={t.rows}>
              {recordings.map(recording => (
                <li key={recording.key} className={t.row}>
                  <DateBlock at={recording.session.startsAt} clock={clock} />
                  <span className={t.rowMain}>
                    <span className={t.rowTitle}>{recording.title}</span>
                    <span className={t.rowMeta}>
                      <span>{recording.session.title}</span>
                      <span>{recording.session.cohortId}</span>
                    </span>
                  </span>
                  <span className={t.rowActions}>
                    <a className={`${t.btn} ${t.btnSmall}`} href={recording.href} target="_blank" rel="noopener noreferrer">Open recording</a>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={t.empty}>No recordings available yet.</p>
          )}
        </section>

        <section className={t.section} aria-labelledby="past">
          <div className={t.sectionHead}>
            <h2 id="past" className={t.sectionTitle}>Past</h2>
          </div>
          {past.length ? <Rows sessions={past} clock={clock} startable={false} resources={resources} /> : <p className={t.empty}>No past sessions yet.</p>}
        </section>
      </main>
      <footer className={t.foot}>
        <b>Sīrah · Beyond Chronology</b> · The Global Awakening
      </footer>
    </div>
  );
}
