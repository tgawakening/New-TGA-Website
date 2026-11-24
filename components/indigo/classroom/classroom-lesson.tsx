import Link from "next/link";
import { ClassroomPlayer } from "@/components/sirah/classroom-player";
import type { getLessonDetail } from "@/services/sirah-classroom.service";
import { classroomClock, STATUS_TEXT } from "./clock";
import { ClassroomHeader, CompletionForm, Dispatch, MaterialRows, SectionHead } from "./parts";
import s from "./classroom.module.css";

type Detail = NonNullable<Awaited<ReturnType<typeof getLessonDetail>>>;

/** One session, Indigo Geometry. Same pieces as app/seerah/classroom/[lessonId]. */
export function ClassroomLesson({
  base,
  detail,
  timezone,
  now,
  completeAction,
}: {
  base: string;
  detail: Detail;
  timezone: string | null | undefined;
  now: Date;
  completeAction: (form: FormData) => Promise<void>;
}) {
  const { lesson, previous, next, completedAt } = detail;
  const clock = classroomClock(timezone);
  const playerClasses = {
    frame: s.playerFrame,
    focused: s.playerFocused,
    start: s.playerStart,
    startIcon: s.playIcon,
    startText: s.playerStartText,
    startHint: s.playerStartHint,
  };
  const recordings = lesson.materials.filter((m) => m.kind === "RECORDING");
  const otherGroups = lesson.groups.filter((g) => g.key !== "RECORDING");
  const when = <time dateTime={lesson.scheduledAt.toISOString()}>{clock.longDate.format(lesson.scheduledAt)}</time>;

  return (
    <div className={s.page}>
      <ClassroomHeader home={base} week={null} percent={null} back={{ href: base, label: "All sessions" }} student={{ active: null }} />

      <main className={s.wrap}>
        <section className={s.hero} aria-labelledby="lesson-title">
          <p className={s.eyebrow}>
            Week {lesson.weekNumber} · {STATUS_TEXT[lesson.status]}
          </p>
          {lesson.status === "past" ? (
            <div className={s.card}>
              <h1 id="lesson-title" className={s.dTitle}>
                {lesson.title}
              </h1>
              <p className={s.when}>
                Took place on {when} <span className={s.tz}>your time ({clock.zoneName})</span>
              </p>
              {lesson.summary ? <p className={s.summary}>{lesson.summary}</p> : null}
            </div>
          ) : (
            <Dispatch lesson={lesson} now={now} clock={clock} label={lesson.status === "live" ? "Live class" : "Upcoming class"}>
              <h1 id="lesson-title" className={s.dTitle}>
                {lesson.title}
              </h1>
              <p className={s.when}>
                {when} <span className={s.tz}>your time ({clock.zoneName})</span>
              </p>
              {lesson.summary ? <p className={s.summary}>{lesson.summary}</p> : null}
            </Dispatch>
          )}
        </section>

        <CompletionForm
          action={completeAction}
          lessonId={lesson.id}
          completed={Boolean(completedAt)}
          returnTo={`${base}/${lesson.id}`}
        />

        <section className={s.section} aria-labelledby="recording">
          <SectionHead id="recording">Recording</SectionHead>
          {recordings.length === 0 ? (
            <p className={s.emptyLine}>
              {lesson.status === "past"
                ? "The recording will be added once it has been processed."
                : "The recording is added here after the session."}
            </p>
          ) : (
            recordings.map((recording) =>
              recording.file && recording.url ? (
                <figure key={recording.id} className={s.player}>
                  <ClassroomPlayer
                    kind="video"
                    src={recording.url}
                    contentType={recording.file.contentType}
                    title={recording.title}
                    classes={playerClasses}
                  />
                  <figcaption>{recording.title}</figcaption>
                </figure>
              ) : recording.embed ? (
                <figure key={recording.id} className={s.player}>
                  <ClassroomPlayer
                    kind="embed"
                    src={recording.embed.src}
                    href={recording.url ?? recording.embed.src}
                    title={recording.title}
                    classes={playerClasses}
                  />
                  <figcaption>{recording.title}</figcaption>
                </figure>
              ) : recording.url ? (
                <MaterialRows key={recording.id} materials={[recording]} />
              ) : null,
            )
          )}
        </section>

        <section className={s.section} aria-labelledby="materials">
          <SectionHead id="materials">Materials</SectionHead>
          {otherGroups.length === 0 ? (
            <p className={s.emptyLine}>Slides, readings and links for this session will appear here.</p>
          ) : (
            <div className={s.groups}>
              {otherGroups.map((group) => (
                <div key={group.key} className={s.card}>
                  <p className={s.tag}>
                    {group.label} · {group.items.length}
                  </p>
                  <MaterialRows materials={group.items} />
                </div>
              ))}
            </div>
          )}
        </section>

        <nav className={s.pager} aria-label="Other sessions">
          {previous ? (
            <Link href={`${base}/${previous.id}`} className={s.pagerLink} rel="prev">
              <span className={s.pagerLabel}>← Previous · week {previous.weekNumber}</span>
              <span className={s.pagerTitle}>{previous.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`${base}/${next.id}`} className={`${s.pagerLink} ${s.pagerNext}`} rel="next">
              <span className={s.pagerLabel}>Next · week {next.weekNumber} →</span>
              <span className={s.pagerTitle}>{next.title}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </main>

      <footer className={s.foot}>
        <b>Sīrah · Beyond Chronology</b> · The Global Awakening
      </footer>
    </div>
  );
}
