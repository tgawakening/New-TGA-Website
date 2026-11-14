import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sirahFont } from "@/lib/sirah/font";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import {
  SIRAH_DEFAULT_TIMEZONE,
  SIRAH_JOIN_WINDOW_MINUTES,
  SIRAH_MATERIAL_LABELS,
  canJoinLesson,
  groupByWeek,
  isValidTimeZone,
  lessonStatus,
  nextLesson,
  type SirahLessonStatus,
} from "@/lib/sirah/classroom";
import {
  getClassroomData,
  getSirahStudentAccess,
  sirahClassroomAvailable,
} from "@/services/sirah-classroom.service";
import { ClassroomCountdown } from "@/components/sirah/classroom-countdown";
import "./tokens.css";
import styles from "./classroom.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Classroom | ${SIRAH_TITLE}`,
  robots: { index: false, follow: false },
};

type Material = { id: string; title: string; kind: keyof typeof SIRAH_MATERIAL_LABELS; url: string };

const STATUS_TEXT: Record<SirahLessonStatus, string> = {
  upcoming: "Upcoming",
  live: "Live now",
  past: "Took place",
};

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, ...options });
}

function MaterialList({ materials }: { materials: Material[] }) {
  // The recording leads: it is what a student who missed the session needs.
  const sorted = [...materials].sort(
    (a, b) => Number(b.kind === "RECORDING") - Number(a.kind === "RECORDING"),
  );
  return (
    <ul className={styles.materials}>
      {sorted.map((material) => (
        <li key={material.id} className={material.kind === "RECORDING" ? styles.recording : undefined}>
          <span className={styles.kind}>{SIRAH_MATERIAL_LABELS[material.kind]}</span>
          <a href={material.url} target="_blank" rel="noopener noreferrer">
            {material.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function SirahClassroomPage() {
  const { user, allowed } = await getSirahStudentAccess();
  if (!user) redirect("/login");
  if (!allowed) redirect("/dashboard");

  const profileZone = user.studentProfile?.timezone;
  const timeZone = profileZone && isValidTimeZone(profileZone) ? profileZone : SIRAH_DEFAULT_TIMEZONE;
  const longDate = formatter(timeZone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const shortDate = formatter(timeZone, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
  const noticeDate = formatter(timeZone, { day: "numeric", month: "long", year: "numeric" });
  const zoneName =
    formatter(timeZone, { timeZoneName: "long" })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value || timeZone;

  const ready = await sirahClassroomAvailable();
  const { lessons, courseMaterials, announcements } = ready
    ? await getClassroomData()
    : { lessons: [], courseMaterials: [], announcements: [] };
  const now = new Date();
  const next = nextLesson(lessons, now);
  const nextStatus = next ? lessonStatus(next.scheduledAt, now) : null;
  const joinable = next ? canJoinLesson(next.scheduledAt, now) && Boolean(next.zoomJoinUrl) : false;
  const pinned = announcements.filter((item) => item.pinned);
  const earlier = announcements.filter((item) => !item.pinned);
  const weeks = groupByWeek(lessons);

  return (
    <main data-theme="sirah-classroom" className={`${styles.page} ${sirahFont.variable}`}>
      <header className={styles.masthead}>
        <div className={styles.container}>
          <div className={styles.mastRow}>
            <h1 className={styles.title}>Classroom</h1>
            <p className={styles.mastMeta}>
              {SIRAH_TITLE}. Times shown in {zoneName}.
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
                  {noticeDate.format(item.publishedAt)}
                </time>
              </article>
            ))}
          </section>
        )}

        {next ? (
          <section className={styles.next} aria-label={nextStatus === "live" ? "Live session" : "Next session"}>
            <div className={styles.nextInner}>
              <div>
                <h2 className={styles.nextTitle}>{next.title}</h2>
                <p className={styles.nextWhen}>
                  Week {next.weekNumber}, <time dateTime={next.scheduledAt.toISOString()}>{longDate.format(next.scheduledAt)}</time>
                </p>
                {next.summary && <p className={styles.nextSummary}>{next.summary}</p>}
              </div>
              <div className={styles.nextAside}>
                {nextStatus === "live" && <p className={styles.liveNow}>Live now</p>}
                {nextStatus === "upcoming" && (
                  <ClassroomCountdown
                    startsAt={next.scheduledAt.toISOString()}
                    serverNow={now.toISOString()}
                    joinWindowMinutes={SIRAH_JOIN_WINDOW_MINUTES}
                    className={styles.countdown}
                    noteClassName={styles.countdownNote}
                  />
                )}
                {joinable && next.zoomJoinUrl ? (
                  <>
                    <a className={styles.join} href={next.zoomJoinUrl} target="_blank" rel="noopener noreferrer">
                      Join on Zoom
                    </a>
                    {next.zoomMeetingId && <span className={styles.meetingId}>Meeting ID {next.zoomMeetingId}</span>}
                  </>
                ) : (
                  <p className={styles.joinHint}>
                    {nextStatus === "live" || canJoinLesson(next.scheduledAt, now)
                      ? "The joining link is on its way. Check the course group if it does not appear in a few minutes."
                      : `The Join button appears here ${SIRAH_JOIN_WINDOW_MINUTES} minutes before the start.`}
                  </p>
                )}
              </div>
            </div>
          </section>
        ) : null}

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
                  <div>
                    {week.lessons.map((lesson) => {
                      const status = lessonStatus(lesson.scheduledAt, now);
                      const hasRecording = lesson.materials.some((item) => item.kind === "RECORDING");
                      return (
                        <details key={lesson.id} className={styles.lesson} open={lesson.id === next?.id}>
                          <summary>
                            <span className={styles.lessonTitle}>{lesson.title}</span>
                            <span className={styles.lessonWhen}>
                              <time dateTime={lesson.scheduledAt.toISOString()}>{shortDate.format(lesson.scheduledAt)}</time>
                            </span>
                            <span className={`${styles.status} ${status === "live" ? styles.statusLive : ""}`}>
                              {STATUS_TEXT[status]}
                            </span>
                          </summary>
                          <div className={styles.lessonBody}>
                            {lesson.summary && <p>{lesson.summary}</p>}
                            {lesson.materials.length > 0 ? (
                              <MaterialList materials={lesson.materials} />
                            ) : (
                              <p className={styles.empty}>Materials for this session will be added here.</p>
                            )}
                            {status === "past" && !hasRecording && (
                              <p className={styles.empty}>The recording will be added once it has been processed.</p>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
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
                    {noticeDate.format(item.publishedAt)}
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
