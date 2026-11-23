import type { StudentAnnouncement, StudentResource } from "@/lib/lms/content";
import type { ClassroomClock } from "./clock";
import { CalendarSubscribe } from "./calendar-subscribe";
import { SectionHead } from "./parts";
import s from "./classroom.module.css";

/* LMS Phase 5 in the student classroom: the cohort's published notices and
 * resources, and the calendar subscription. Pure render; the page has already
 * run the enrolment + cohort check (lib/lms/content.studentContent). A file
 * row links to the enrolment-checked route, never to storage. */

function sizeLabel(bytes: number | null) {
  if (bytes === null) return "";
  if (bytes >= 1024 ** 3) return ` · ${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return ` · ${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return ` · ${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const icon = (resource: StudentResource) =>
  resource.kind === "LINK"
    ? { text: "LN", tone: s.icR }
    : resource.contentType && /^(audio|video)\//.test(resource.contentType)
      ? { text: "▶", tone: s.icV }
      : { text: "FILE", tone: s.icS };

export function CohortNotices({ announcements, clock }: { announcements: StudentAnnouncement[]; clock: ClassroomClock }) {
  if (!announcements.length) return null;
  return (
    <section className={s.section} aria-labelledby="cohort-notices">
      <SectionHead id="cohort-notices">Notices for your cohort</SectionHead>
      <ul className={s.earlier}>
        {announcements.map((item) => (
          <li key={item.id}>
            <h3>{item.title}</h3>
            <p style={{ whiteSpace: "pre-line" }}>{item.body}</p>
            {item.publishedAt ? <time dateTime={item.publishedAt.toISOString()}>{clock.noticeDate.format(item.publishedAt)}</time> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ResourceList({ resources }: { resources: StudentResource[] }) {
  if (!resources.length) return null;
  return (
    <section className={s.section} aria-labelledby="resources">
      <SectionHead id="resources">Resources</SectionHead>
      <p className={s.sectionLede}>Files and links shared by your teachers, newest first.</p>
      <ul className={s.mats}>
        {resources.map((resource) => {
          const mark = icon(resource);
          return (
            <li key={resource.id}>
              <a className={s.mat} href={resource.href} target="_blank" rel="noopener noreferrer">
                <span className={`${s.ic} ${mark.tone}`} aria-hidden="true">
                  {mark.text}
                </span>
                <span className={s.txt}>
                  <b>{resource.title}</b>
                  <span>
                    {resource.kind === "LINK" ? "Link" : "File"}
                    {resource.sessionTitle ? ` · ${resource.sessionTitle}` : ""}
                    {sizeLabel(resource.sizeBytes)}
                  </span>
                </span>
                <span className={s.go} aria-hidden="true">
                  →
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function CalendarSection({ links }: { links: { https: string; webcal: string } }) {
  return (
    <section className={s.section} aria-labelledby="calendar">
      <SectionHead id="calendar">Your calendar</SectionHead>
      <CalendarSubscribe https={links.https} webcal={links.webcal} />
    </section>
  );
}
