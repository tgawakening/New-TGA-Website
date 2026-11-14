import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sirahFont } from "@/lib/sirah/font";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import { courseProgress, groupByWeek, lessonStatus, toLessonView } from "@/lib/sirah/classroom";
import {
  getClassroomData,
  getCompletedLessonIds,
  getSirahStudentAccess,
  sirahClassroomAvailable,
} from "@/services/sirah-classroom.service";
import { MaterialList, STATUS_TEXT, SessionBand, classroomClock } from "./parts";
import "./tokens.css";
import styles from "./classroom.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Classroom | ${SIRAH_TITLE}`,
  robots: { index: false, follow: false },
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export default async function SirahClassroomPage() {
  const { user, allowed } = await getSirahStudentAccess();
  if (!user) redirect("/login");
  if (!allowed) redirect("/dashboard");

  const clock = classroomClock(user.studentProfile?.timezone);
  const ready = await sirahClassroomAvailable();
  const [{ lessons, courseMaterials, announcements }, completedIds] = ready
    ? await Promise.all([getClassroomData(), getCompletedLessonIds(user.id)])
    : [{ lessons: [], courseMaterials: [], announcements: [] }, new Set<string>()];
  const now = new Date();
  const progress = courseProgress(lessons, completedIds, now);
  // The band renders through the view builder, so the Zoom link is only
  // present inside the join window.
  const next = progress.next ? toLessonView(progress.next, [], { enrolled: true }, now) : null;
  const pinned = announcements.filter((item) => item.pinned);
  const earlier = announcements.filter((item) => !item.pinned);
  const weeks = groupByWeek(lessons);

  return (
    <main data-theme="sirah-classroom" className={`${styles.page} ${sirahFont.variable}`}>
      <header className={styles.masthead}>
        <div className={styles.container}>
          <div className={styles.mastRow}>
            <div>
              <h1 className={styles.title}>Classroom</h1>
              {progress.totalSessions > 0 && (
                <p className={styles.progress}>
                  {progress.currentWeek ? (
                    <>
                      Week <span className={styles.figure}>{progress.currentWeek}</span> of{" "}
                      <span className={styles.figure}>{progress.totalWeeks}</span>.
                    </>
                  ) : (
                    <>
                      The course begins in week <span className={styles.figure}>{progress.next?.weekNumber ?? 1}</span>.
                    </>
                  )}{" "}
                  You have completed <span className={styles.figure}>{progress.completed}</span> of{" "}
                  {plural(progress.totalSessions, "session")}.
                </p>
              )}
            </div>
            <p className={styles.mastMeta}>
              {SIRAH_TITLE}. Times shown in {clock.zoneName}.
              <br />
              <Link href="/dashboard">Back to your dashboard</Link>
            </p>
          </div>
        </div>
      </header>

      <div className={styles.container}>
        {pinned.length > 0 && (
          <section className={styles.notices} aria-label="Pinned announcements">
            {pinned.map((item) => (
              <article key={item.id} className={styles.notice}>
                <h2>{item.title}</h2>
                <p>{item.body}</p>
                <time className={styles.noticeDate} dateTime={item.publishedAt.toISOString()}>
                  {clock.noticeDate.format(item.publishedAt)}
                </time>
              </article>
            ))}
          </section>
        )}

        {next && (
          <SessionBand lesson={next} now={now} label={next.status === "live" ? "Live class" : "Next live class"}>
            <h2 className={styles.nextTitle}>
              <Link href={`/seerah/classroom/${next.id}`} className={styles.nextLink}>
                {next.title}
              </Link>
            </h2>
            <p className={styles.nextWhen}>
              Week {next.weekNumber},{" "}
              <time dateTime={next.scheduledAt.toISOString()}>{clock.longDate.format(next.scheduledAt)}</time>
            </p>
            {next.summary && <p className={styles.nextSummary}>{next.summary}</p>}
          </SessionBand>
        )}

        <section className={styles.section} aria-labelledby="schedule">
          <h2 id="schedule" className={styles.sectionTitle}>
            Week by week
          </h2>
          <p className={styles.sectionLede}>Open a session for its notes, materials and recording.</p>
          {weeks.length === 0 ? (
            <p className={styles.emptyPanel}>
              The first session has not been scheduled yet. When the team publishes it, the date, the joining link and the
              materials will appear here.
            </p>
          ) : (
            <ol className={styles.weeks}>
              {weeks.map((week) => (
                <li key={week.weekNumber} className={styles.week}>
                  <span className={styles.weekNumber}>Week {week.weekNumber}</span>
                  <ul className={styles.lessonRows}>
                    {week.lessons.map((lesson) => {
                      const status = lessonStatus(lesson.scheduledAt, now);
                      const done = completedIds.has(lesson.id);
                      return (
                        <li key={lesson.id}>
                          <Link href={`/seerah/classroom/${lesson.id}`} className={styles.lessonRow}>
                            <span className={styles.lessonTitle}>{lesson.title}</span>
                            <span className={styles.lessonWhen}>
                              <time dateTime={lesson.scheduledAt.toISOString()}>
                                {clock.shortDate.format(lesson.scheduledAt)}
                              </time>
                              , {STATUS_TEXT[status].toLowerCase()}
                            </span>
                            <span className={done ? styles.done : styles.notDone}>
                              {done ? "Completed" : "Not completed"}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>

        {courseMaterials.length > 0 && (
          <section className={styles.section} aria-labelledby="course-materials">
            <h2 id="course-materials" className={styles.sectionTitle}>
              Course materials
            </h2>
            <p className={styles.sectionLede}>Readings and references for the whole programme.</p>
            <MaterialList materials={courseMaterials} />
          </section>
        )}

        {earlier.length > 0 && (
          <section className={styles.section} aria-labelledby="announcements">
            <h2 id="announcements" className={styles.sectionTitle}>
              Announcements
            </h2>
            <ul className={styles.earlier}>
              {earlier.map((item) => (
                <li key={item.id}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <time className={styles.noticeDate} dateTime={item.publishedAt.toISOString()}>
                    {clock.noticeDate.format(item.publishedAt)}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
