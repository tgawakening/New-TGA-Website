import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sirahFont } from "@/lib/sirah/font";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import {
  gateFrom,
  getLessonDetail,
  getSirahStudentAccess,
  sirahClassroomAvailable,
} from "@/services/sirah-classroom.service";
import { CompletionForm, MaterialList, STATUS_TEXT, SessionBand, classroomClock } from "../parts";
import "../tokens.css";
import styles from "../classroom.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Session | ${SIRAH_TITLE}`,
  robots: { index: false, follow: false },
};

export default async function SirahLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  // Gate first: nothing about the session is read for someone not enrolled.
  const access = await getSirahStudentAccess();
  if (!access.user) redirect("/login");
  if (!access.allowed) redirect("/dashboard");
  if (!(await sirahClassroomAvailable())) redirect("/seerah/classroom");

  const { lessonId } = await params;
  const now = new Date();
  const detail = await getLessonDetail(lessonId, gateFrom(access), now);
  if (!detail) notFound();
  const { lesson, previous, next, completedAt } = detail;
  const clock = classroomClock(access.user.studentProfile?.timezone);
  const recordings = lesson.materials.filter((material) => material.kind === "RECORDING");
  const otherGroups = lesson.groups.filter((group) => group.key !== "RECORDING");
  const when = <time dateTime={lesson.scheduledAt.toISOString()}>{clock.longDate.format(lesson.scheduledAt)}</time>;

  return (
    <main data-theme="sirah-classroom" className={`${styles.page} ${sirahFont.variable}`}>
      <header className={styles.masthead}>
        <div className={styles.container}>
          <div className={styles.mastRow}>
            <div>
              <h1 className={styles.title}>{lesson.title}</h1>
              <p className={styles.progress}>
                Week <span className={styles.figure}>{lesson.weekNumber}</span>, {STATUS_TEXT[lesson.status].toLowerCase()}.
              </p>
            </div>
            <p className={styles.mastMeta}>
              {SIRAH_TITLE}. Times shown in {clock.zoneName}.
              <br />
              <Link href="/seerah/classroom">All sessions</Link>
            </p>
          </div>
        </div>
      </header>

      <div className={styles.container}>
        {lesson.status === "past" ? (
          <section className={styles.section} aria-labelledby="about">
            <h2 id="about" className={styles.sectionTitle}>
              About this session
            </h2>
            <p className={styles.sectionLede}>Took place on {when}.</p>
            {lesson.summary && <p className={styles.prose}>{lesson.summary}</p>}
          </section>
        ) : (
          <SessionBand lesson={lesson} now={now} label={lesson.status === "live" ? "Live class" : "Upcoming class"}>
            <p className={styles.bandWhen}>{when}</p>
            {lesson.summary && <p className={styles.nextSummary}>{lesson.summary}</p>}
          </SessionBand>
        )}

        <CompletionForm lessonId={lesson.id} completed={Boolean(completedAt)} returnTo={`/seerah/classroom/${lesson.id}`} />

        <section className={styles.section} aria-labelledby="recording">
          <h2 id="recording" className={styles.sectionTitle}>
            Recording
          </h2>
          {recordings.length === 0 ? (
            <p className={styles.sectionLede}>
              {lesson.status === "past"
                ? "The recording will be added once it has been processed."
                : "The recording is added here after the session."}
            </p>
          ) : (
            recordings.map((recording) =>
              recording.embed ? (
                <figure key={recording.id} className={styles.player}>
                  <iframe
                    src={recording.embed.src}
                    title={recording.title}
                    loading="lazy"
                    allow="fullscreen; picture-in-picture; encrypted-media"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                  <figcaption>{recording.title}</figcaption>
                </figure>
              ) : recording.url ? (
                <a
                  key={recording.id}
                  className={styles.recordingLink}
                  href={recording.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Watch the recording: {recording.title}
                </a>
              ) : null,
            )
          )}
        </section>

        <section className={styles.section} aria-labelledby="materials">
          <h2 id="materials" className={styles.sectionTitle}>
            Materials
          </h2>
          {otherGroups.length === 0 ? (
            <p className={styles.sectionLede}>Materials for this session will be added here.</p>
          ) : (
            otherGroups.map((group) => (
              <div key={group.key} className={styles.materialGroup}>
                <h3 className={styles.groupTitle}>{group.label}</h3>
                <MaterialList materials={group.items} />
              </div>
            ))
          )}
        </section>

        <nav className={styles.pager} aria-label="Other sessions">
          {previous ? (
            <Link href={`/seerah/classroom/${previous.id}`} className={styles.pagerLink} rel="prev">
              <span className={styles.pagerLabel}>Previous session, week {previous.weekNumber}</span>
              <span className={styles.pagerTitle}>{previous.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/seerah/classroom/${next.id}`} className={`${styles.pagerLink} ${styles.pagerNext}`} rel="next">
              <span className={styles.pagerLabel}>Next session, week {next.weekNumber}</span>
              <span className={styles.pagerTitle}>{next.title}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </main>
  );
}
