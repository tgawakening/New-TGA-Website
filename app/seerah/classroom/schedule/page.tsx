import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import { JOIN_OPENS_MINUTES_BEFORE } from "@/lib/lms/access";
import { lmsSessionsAvailable, studentSchedule } from "@/lib/lms/schedule";
import { viewerTimeZone } from "@/lib/time/viewer-zone.server";
import { studentPhase5 } from "@/lib/lms/student-phase5";
import { studentExternalRecordings, studentStandaloneRecordings } from "@/lib/lms/external-recordings";
import { recordingsAvailable, studentRecordings, watchPath, playPath, type StudentRecording } from "@/lib/lms/recordings";
import { getSirahStudentAccess } from "@/services/sirah-classroom.service";
import { classroomClock } from "@/components/indigo/classroom/clock";
import { RecordingLibrary } from "@/components/indigo/classroom/recording-library";
import { ClassroomHeader, SectionHead } from "@/components/indigo/classroom/parts";
import { LiveSessionRows, NextLiveClass } from "@/components/indigo/classroom/live-sessions";
import s from "@/components/indigo/classroom/classroom.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Live classes | ${SIRAH_TITLE}`,
  robots: { index: false, follow: false },
};

/** The student's full live-class schedule: next class with countdown and
 * Join, then upcoming and past classes. Access is the existing paid + active
 * rule; without it the page shows the gated state and reads no sessions. */
export default async function LiveSchedulePage() {
  const { user } = await getSirahStudentAccess();
  if (!user) redirect("/login");

  const now = new Date();
  const clock = classroomClock((await viewerTimeZone()) ?? user.studentProfile?.timezone);
  const schedule = (await lmsSessionsAvailable()) ? await studentSchedule(user.id, now) : null;
  const phase5 = schedule?.allowed ? await studentPhase5(user.id, now) : null;
  // Published recordings, under the same paid + active rule (none when not allowed).
  const recordings: StudentRecording[] = schedule?.allowed && (await recordingsAvailable()) ? await studentRecordings(user.id, now) : [];
  const watchBySession = new Map(recordings.map((r) => [r.sessionId, watchPath(r.recordingId)] as const));
  const external = phase5 ? await studentExternalRecordings(user.id, now) : [];
  const standalone = phase5 ? await studentStandaloneRecordings(user.id, now) : [];
  const externalBySession = new Map<string, { id: string; title: string; url: string }[]>();
  for (const item of external) {
    if (!item.sessionId || !item.url) continue;
    externalBySession.set(item.sessionId, [...(externalBySession.get(item.sessionId) ?? []), { id: item.id, title: item.title, url: item.url }]);
  }

  return (
    <div className={s.page}>
      <ClassroomHeader home="/seerah/classroom" week={null} percent={null} back={{ href: "/seerah/classroom", label: "Classroom" }} inbox={phase5?.inbox ?? null} student={{ active: "live" }} />
      <main className={s.wrap}>
        {!schedule?.allowed ? (
          <section className={s.hero} aria-labelledby="gated-title">
            <div className={s.empty}>
              <h1 id="gated-title">{schedule ? "Live classes are for enrolled students" : "Live classes are not open yet"}</h1>
              <p>
                {schedule
                  ? "Your account does not have an active, paid enrolment for the current cohort, so the live class schedule is hidden. Your dashboard shows your enrolment and any payment that is due."
                  : "The live class schedule appears here once it is published."}
              </p>
              <p>
                <Link href="/dashboard" className={s.btnTeal}>
                  Go to your dashboard
                </Link>
              </p>
            </div>
          </section>
        ) : (
          <>
            <section className={s.hero} aria-labelledby="next-live">
              <p className={s.eyebrow}>{schedule.next?.phase === "live" ? "Happening now" : "Your next live class"}</p>
              {schedule.next ? (
                <NextLiveClass session={schedule.next} now={now} clock={clock} headingLevel={1} />
              ) : (
                <div className={s.empty}>
                  <h1 id="next-live">No live class is scheduled right now</h1>
                  <p>New classes appear here as soon as they are booked.</p>
                </div>
              )}
            </section>

            <section className={s.section} aria-labelledby="upcoming">
              <SectionHead id="upcoming">Upcoming classes</SectionHead>
              <p className={s.sectionLede}>
                Times are your time ({clock.zoneName}). Join opens {JOIN_OPENS_MINUTES_BEFORE} minutes before each class, or as soon as the host starts it.
              </p>
              {schedule.upcoming.length ? (
                <LiveSessionRows sessions={schedule.upcoming} clock={clock} nextId={schedule.next?.id} />
              ) : (
                <p className={s.emptyLine}>Nothing scheduled yet.</p>
              )}
            </section>

            <section className={s.section} aria-labelledby="recordings">
              <SectionHead id="recordings">Recordings</SectionHead>
              <p className={s.sectionLede}>Watch published classes at your own pace.</p>
              <RecordingLibrary items={[
                ...recordings.map((r) => ({ id: `zoom-${r.recordingId}`, title: r.title, date: clock.shortDate.format(r.startsAt), href: watchPath(r.recordingId), player: { src: playPath(r.recordingId), kind: r.kind }, external: false })),
                ...external.flatMap((r) => { const session = schedule.past.find((item) => item.id === r.sessionId); return session && r.url ? [{ id: r.id, title: r.title, date: clock.shortDate.format(session.startsAt), href: r.url, external: true }] : []; }),
                ...standalone.flatMap((r) => r.url ? [{ id: r.id, title: r.title, date: clock.shortDate.format(r.createdAt), href: r.url, description: r.originalFilename, resources: r.resources, external: true }] : []),
              ]} />
            </section>

            <section className={s.section} aria-labelledby="past">
              <SectionHead id="past">Past classes</SectionHead>
              <p className={s.sectionLede}>
                {recordings.length || external.length || standalone.length ? "Published recordings are shown with their classes." : "Recordings appear here once they are published."}
              </p>
              {schedule.past.length ? (
                <LiveSessionRows sessions={schedule.past} clock={clock} recordings={watchBySession} externalRecordings={externalBySession} />
              ) : standalone.length ? null : (
                <p className={s.emptyLine}>No classes have taken place yet.</p>
              )}
              {standalone.length > 0 && (
                <ol className={s.chapters}>
                  {standalone.map((item) => item.url && (
                    <li key={item.id}>
                      <div className={s.chap}>
                        <span className={s.ti}>{item.title}{item.originalFilename && <small>{item.originalFilename}</small>}</span>
                        <a className={`${s.st} ${s.stNext}`} href={item.url} target="_blank" rel="noopener noreferrer">Watch →</a>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
      <footer className={s.foot}>
        <b>Sīrah · Beyond Chronology</b> · The Global Awakening
      </footer>
    </div>
  );
}
