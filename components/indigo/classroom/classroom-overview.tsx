import Link from "next/link";
import { courseProgress, groupByWeek, lessonStatus, toLessonView } from "@/lib/sirah/classroom";
import type { getClassroomData } from "@/services/sirah-classroom.service";
import { classroomClock, STATUS_TEXT } from "./clock";
import { ClassroomHeader, Dispatch, MaterialRows, ProgressBar, SectionHead } from "./parts";
import s from "./classroom.module.css";

type Data = Awaited<ReturnType<typeof getClassroomData>>;

/** The classroom overview, Indigo Geometry. Pure render: the route does the
 * gate and the reads, exactly as app/seerah/classroom/page.tsx does. */
export function ClassroomOverview({
  base,
  data,
  completedIds,
  timezone,
  now,
}: {
  base: string;
  data: Data;
  completedIds: Set<string>;
  timezone: string | null | undefined;
  now: Date;
}) {
  const { lessons, courseMaterials, announcements } = data;
  const clock = classroomClock(timezone);
  const progress = courseProgress(lessons, completedIds, now);
  // Everything a student sees goes through the view builder: the Zoom link
  // only exists inside the join window, material URLs only for the enrolled.
  const next = progress.next ? toLessonView(progress.next, progress.next.materials, { enrolled: true }, now) : null;
  const pinned = announcements.filter((a) => a.pinned);
  const earlier = announcements.filter((a) => !a.pinned);
  const weeks = groupByWeek(lessons);
  const percent = progress.totalSessions ? Math.round((progress.completed / progress.totalSessions) * 100) : null;
  const weeksLeft = progress.currentWeek ? Math.max(0, progress.totalWeeks - progress.currentWeek) : progress.totalWeeks;
  const herePct =
    progress.totalWeeks && progress.currentWeek ? Math.min(100, (progress.currentWeek / progress.totalWeeks) * 100) : 0;

  return (
    <div className={s.page}>
      <ClassroomHeader
        home={base}
        week={progress.currentWeek ? { current: progress.currentWeek, total: progress.totalWeeks } : null}
        percent={percent}
        back={{ href: "/dashboard", label: "Dashboard" }}
      />

      <main className={s.wrap}>
        {/* Next gathering */}
        <section className={s.hero} aria-labelledby="next-title">
          <p className={s.eyebrow}>{next?.status === "live" ? "Happening now" : "Your next gathering"}</p>
          {next ? (
            <Dispatch lesson={next} now={now} clock={clock} label={next.status === "live" ? "Live class" : "Next live class"}>
              <h1 id="next-title" className={s.dTitle}>
                <Link href={`${base}/${next.id}`}>{next.title}</Link>
              </h1>
              <p className={s.when}>
                <time dateTime={next.scheduledAt.toISOString()}>{clock.longDate.format(next.scheduledAt)}</time>{" "}
                <span className={s.tz}>your time ({clock.zoneName})</span>
              </p>
              {next.summary ? <p className={s.summary}>{next.summary}</p> : null}
            </Dispatch>
          ) : (
            <div className={s.empty}>
              <h1 id="next-title">
                {lessons.length ? "No upcoming session is scheduled" : "The first session is not scheduled yet"}
              </h1>
              <p>When the team publishes it, its date, joining link and materials appear here.</p>
            </div>
          )}
        </section>

        {pinned.length > 0 ? (
          <section className={s.notes} aria-label="Pinned announcements">
            {pinned.map((item) => (
              <article key={item.id} className={s.note}>
                <p className={s.pin}>Pinned announcement</p>
                <h2>{item.title}</h2>
                <p>{item.body}</p>
                <time dateTime={item.publishedAt.toISOString()}>{clock.noticeDate.format(item.publishedAt)}</time>
              </article>
            ))}
          </section>
        ) : null}

        {/* Journey */}
        {progress.totalWeeks > 0 ? (
          <section className={s.section} aria-labelledby="journey">
            <SectionHead id="journey">Your journey through the Sīrah</SectionHead>
            <div className={s.journey}>
              <div className={s.track}>
                <div className={s.fill} style={{ width: `${herePct}%` }} />
                {progress.currentWeek ? (
                  <span className={s.here} style={{ left: `${herePct}%` }}>
                    <span className={s.yh}>You are here</span>
                    <span className={s.pt} />
                  </span>
                ) : null}
              </div>
              <div className={s.ends}>
                <span>
                  <b>Week 1</b>
                  {progress.currentWeek ? "Begun" : "Starts soon"}
                </span>
                {progress.currentWeek ? (
                  <span className={s.endsHere}>
                    <b>Week {progress.currentWeek}</b>
                    {weeksLeft} {weeksLeft === 1 ? "week" : "weeks"} to go
                  </span>
                ) : null}
                <span className={s.endsLast}>
                  <b>Week {progress.totalWeeks}</b>
                  Final session
                </span>
              </div>
            </div>
          </section>
        ) : null}

        {/* This session's materials + at a glance */}
        {next ? (
          <section className={s.section} aria-labelledby="this-week">
            <SectionHead id="this-week">Week {next.weekNumber}: materials</SectionHead>
            <div className={s.grid2}>
              <div className={s.card}>
                <p className={s.tag}>Prepare before {clock.weekday.format(next.scheduledAt)}</p>
                <h3>{next.title}</h3>
                {next.materials.length || !next.hasRecording ? (
                  <MaterialRows
                    materials={next.materials}
                    recordingPending={next.hasRecording ? null : "Appears after the live session"}
                  />
                ) : null}
                {!next.materials.length ? (
                  <p className={s.lede}>Slides, readings and links for this session will appear here.</p>
                ) : null}
                <ProgressBar done={progress.completed} total={progress.totalSessions} />
              </div>
              <div className={`${s.card} ${s.glanceCard}`}>
                <p className={s.tag}>At a glance</p>
                <dl className={s.glance}>
                  <div>
                    <dt>sessions completed</dt>
                    <dd>{progress.completed}</dd>
                  </div>
                  <div>
                    <dt>sessions to go</dt>
                    <dd>{Math.max(0, progress.totalSessions - progress.completed)}</dd>
                  </div>
                  <div>
                    <dt>weeks remaining</dt>
                    <dd>{weeksLeft}</dd>
                  </div>
                  <div>
                    <dt>course progress</dt>
                    <dd>{percent ?? 0}%</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
        ) : null}

        {/* Chronicle */}
        <section className={s.section} aria-labelledby="chronicle">
          <SectionHead id="chronicle">The chronicle</SectionHead>
          <p className={s.sectionLede}>
            Every session, week by week. Open one for its notes, materials and recording. Times in {clock.zoneName}.
          </p>
          {weeks.length === 0 ? (
            <p className={s.emptyLine}>Sessions appear here once the team publishes them.</p>
          ) : (
            <ol className={s.chapters}>
              {weeks.flatMap((week) =>
                week.lessons.map((lesson) => {
                  const status = lessonStatus(lesson.scheduledAt, now);
                  const done = completedIds.has(lesson.id);
                  const isNext = next?.id === lesson.id;
                  const pill = done
                    ? { text: "✓ Completed", cls: s.stDone }
                    : status === "live"
                      ? { text: "● Live now", cls: s.stNext }
                      : isNext
                        ? { text: "● Up next", cls: s.stNext }
                        : { text: STATUS_TEXT[status], cls: s.stLock };
                  return (
                    <li key={lesson.id}>
                      <Link href={`${base}/${lesson.id}`} className={`${s.chap} ${isNext ? s.isNext : ""}`}>
                        <span className={s.wkn}>Wk {lesson.weekNumber}</span>
                        <span className={s.ti}>
                          {lesson.title}
                          <small>
                            <time dateTime={lesson.scheduledAt.toISOString()}>{clock.shortDate.format(lesson.scheduledAt)}</time>
                            {done ? "" : status === "past" ? " · not marked complete" : ""}
                          </small>
                        </span>
                        <span className={`${s.st} ${pill.cls}`}>{pill.text}</span>
                      </Link>
                    </li>
                  );
                }),
              )}
            </ol>
          )}
        </section>

        {courseMaterials.length > 0 ? (
          <section className={s.section} aria-labelledby="course-materials">
            <SectionHead id="course-materials">Course materials</SectionHead>
            <p className={s.sectionLede}>Readings and references for the whole programme.</p>
            <MaterialRows
              materials={courseMaterials.map((m) => ({ id: m.id, title: m.title, kind: m.kind, url: m.url }))}
            />
          </section>
        ) : null}

        {earlier.length > 0 ? (
          <section className={s.section} aria-labelledby="announcements">
            <SectionHead id="announcements">Announcements</SectionHead>
            <ul className={s.earlier}>
              {earlier.map((item) => (
                <li key={item.id}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <time dateTime={item.publishedAt.toISOString()}>{clock.noticeDate.format(item.publishedAt)}</time>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      <footer className={s.foot}>
        <b>Sīrah · Beyond Chronology</b> · The Global Awakening
      </footer>
    </div>
  );
}
