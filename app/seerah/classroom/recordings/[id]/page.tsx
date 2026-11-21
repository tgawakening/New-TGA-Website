import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import { playPath, recordingsAvailable, resolveRecordingPlayback } from "@/lib/lms/recordings";
import { getSirahStudentAccess } from "@/services/sirah-classroom.service";
import { classroomClock } from "@/components/indigo/classroom/clock";
import { ClassroomHeader } from "@/components/indigo/classroom/parts";
import { RecordingPlayer } from "@/components/indigo/classroom/recording-player";
import s from "@/components/indigo/classroom/classroom.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Class recording | ${SIRAH_TITLE}`,
  robots: { index: false, follow: false },
};

/** One class recording. The same check as the play route (active, paid
 * enrolment in the session's cohort; READY and PUBLISHED) decides whether
 * the player is shown; the player's source is the play route itself. */
export default async function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getSirahStudentAccess();
  if (!user) redirect("/login");

  const clock = classroomClock(user.studentProfile?.timezone);
  const decision = (await recordingsAvailable()) ? await resolveRecordingPlayback(user.id, id) : null;
  const back = { href: "/seerah/classroom/schedule", label: "Live classes" };

  return (
    <div className={s.page}>
      <ClassroomHeader home="/seerah/classroom" week={null} percent={null} back={back} />
      <main className={s.wrap}>
        {decision?.ok ? (
          <section className={s.hero} aria-labelledby="recording-title">
            <p className={s.eyebrow}>Class recording</p>
            <h1 id="recording-title" className={s.dTitle}>
              {decision.title}
            </h1>
            <RecordingPlayer src={playPath(id)} kind={decision.kind} title={decision.title} />
            <p className={s.recordingMeta}>
              Recorded <time dateTime={decision.startsAt.toISOString()}>{clock.longDate.format(decision.startsAt)}</time> ({clock.zoneName}).
              For enrolled students only: please do not share or re-record it.
            </p>
          </section>
        ) : (
          <section className={s.hero} aria-labelledby="gated-title">
            <div className={s.empty}>
              <h1 id="gated-title">{decision?.ok === false && decision.reason === "not_enrolled" ? "Recordings are for enrolled students" : "This recording is not available"}</h1>
              <p>
                {decision?.ok === false && decision.reason === "not_enrolled"
                  ? "Your account does not have an active, paid enrolment for this class's cohort. Your dashboard shows your enrolment and any payment that is due."
                  : "It may not be published yet. Published recordings are listed under Live classes."}
              </p>
              <p>
                <Link href={decision?.ok === false && decision.reason === "not_enrolled" ? "/dashboard" : back.href} className={s.btnTeal}>
                  {decision?.ok === false && decision.reason === "not_enrolled" ? "Go to your dashboard" : "Back to live classes"}
                </Link>
              </p>
            </div>
          </section>
        )}
      </main>
      <footer className={s.foot}>
        <b>Sīrah · Beyond Chronology</b> · The Global Awakening
      </footer>
    </div>
  );
}
