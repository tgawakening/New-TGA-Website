import { redirect } from "next/navigation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { sirahFont } from "@/lib/sirah/font";
import {
  SIRAH_DEFAULT_TIMEZONE,
  SIRAH_JOIN_WINDOW_MINUTES,
  SIRAH_MATERIAL_KINDS,
  SIRAH_MATERIAL_LABELS,
  lessonStatus,
  nextLesson,
  utcToZonedLocal,
} from "@/lib/sirah/classroom";
import { getClassroomData, sirahClassroomAvailable } from "@/services/sirah-classroom.service";
import { ScheduleFields, SelectField } from "@/components/sirah/classroom-pickers";
import "@/app/seerah/classroom/tokens.css";
import styles from "@/components/sirah/admin-classroom.module.css";
import {
  addMaterial,
  createLesson,
  postAnnouncement,
  removeAnnouncement,
  removeMaterial,
  setAnnouncementPinned,
  updateLesson,
} from "./actions";

export const dynamic = "force-dynamic";

/** Zones the team schedules from. The stored time is always UTC; students see
 * it in their own profile zone. */
const TIME_ZONES = [
  { value: "Europe/London", label: "London", hint: "Europe/London" },
  { value: "Asia/Karachi", label: "Pakistan", hint: "Asia/Karachi" },
  { value: "Asia/Dubai", label: "Gulf", hint: "Asia/Dubai" },
  { value: "Europe/Berlin", label: "Central Europe", hint: "Europe/Berlin" },
  { value: "America/New_York", label: "US Eastern", hint: "America/New_York" },
  { value: "America/Chicago", label: "US Central", hint: "America/Chicago" },
  { value: "America/Los_Angeles", label: "US Pacific", hint: "America/Los_Angeles" },
  { value: "Australia/Sydney", label: "Sydney", hint: "Australia/Sydney" },
  { value: "UTC", label: "UTC", hint: "Coordinated Universal Time" },
];
const KIND_OPTIONS = SIRAH_MATERIAL_KINDS.map((kind) => ({ value: kind, label: SIRAH_MATERIAL_LABELS[kind] }));

const STATUS_TEXT = { upcoming: "Upcoming", live: "Live now", past: "Took place" } as const;
const listDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: SIRAH_DEFAULT_TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const shortDate = new Intl.DateTimeFormat("en-GB", { timeZone: SIRAH_DEFAULT_TIMEZONE, day: "numeric", month: "long" });

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

type LessonDefaults = {
  id?: string;
  title?: string;
  summary?: string;
  weekNumber?: number;
  scheduledAt?: Date;
  zoomJoinUrl?: string | null;
  zoomMeetingId?: string | null;
};

function LessonForm({
  lesson,
  idPrefix,
  action,
  submitLabel,
}: {
  lesson?: LessonDefaults;
  idPrefix: string;
  action: (form: FormData) => Promise<void>;
  submitLabel: string;
}) {
  return (
    <form action={action} className={styles.form}>
      {lesson?.id && <input type="hidden" name="id" value={lesson.id} />}

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Session</legend>
        <div className={styles.grid}>
          <label className={`${styles.field} ${styles.span3}`}>
            <span className={styles.label}>Title</span>
            <input className={styles.input} name="title" required maxLength={191} defaultValue={lesson?.title} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Week</span>
            <input
              className={styles.input}
              name="weekNumber"
              required
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              defaultValue={lesson?.weekNumber ?? ""}
              aria-describedby={`${idPrefix}-week-help`}
            />
            <span id={`${idPrefix}-week-help`} className={styles.help}>
              1 to 60
            </span>
          </label>
          <label className={`${styles.field} ${styles.span4}`}>
            <span className={styles.label}>Summary</span>
            <textarea
              className={styles.textarea}
              name="summary"
              maxLength={5000}
              defaultValue={lesson?.summary}
              aria-describedby={`${idPrefix}-summary-help`}
            />
            <span id={`${idPrefix}-summary-help`} className={styles.help}>
              Shown under the title on the student pages. Optional.
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Schedule</legend>
        <div className={styles.grid}>
          <ScheduleFields
            name="scheduledLocal"
            idPrefix={idPrefix}
            defaultValue={lesson?.scheduledAt ? utcToZonedLocal(lesson.scheduledAt, SIRAH_DEFAULT_TIMEZONE) : ""}
          />
          <div className={`${styles.field} ${styles.span2}`}>
            <span id={`${idPrefix}-zone`} className={styles.label}>
              Time zone of that time
            </span>
            <SelectField name="timeZone" labelId={`${idPrefix}-zone`} options={TIME_ZONES} defaultValue={SIRAH_DEFAULT_TIMEZONE} />
          </div>
        </div>
        <p className={styles.help}>Stored once, shown to each student in their own time zone.</p>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Zoom</legend>
        <div className={styles.grid}>
          <label className={`${styles.field} ${styles.span3}`}>
            <span className={styles.label}>Join link</span>
            <input
              className={styles.input}
              name="zoomJoinUrl"
              type="url"
              maxLength={1024}
              placeholder="https://us02web.zoom.us/j/…"
              defaultValue={lesson?.zoomJoinUrl ?? ""}
              aria-describedby={`${idPrefix}-zoom-help`}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Meeting ID</span>
            <input
              className={styles.input}
              name="zoomMeetingId"
              maxLength={64}
              inputMode="numeric"
              defaultValue={lesson?.zoomMeetingId ?? ""}
            />
          </label>
        </div>
        <p id={`${idPrefix}-zoom-help`} className={styles.help}>
          Students receive the link only from {SIRAH_JOIN_WINDOW_MINUTES} minutes before the start until the session ends.
        </p>
      </fieldset>

      <div className={styles.formFoot}>
        <button type="submit" className={styles.primary}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function MaterialForm({ lessonId, idPrefix }: { lessonId?: string; idPrefix: string }) {
  return (
    <form action={addMaterial} className={styles.inlineForm}>
      <input type="hidden" name="lessonId" value={lessonId ?? ""} />
      <p className={styles.inlineTitle}>Add a material</p>
      <div className={styles.grid}>
        <label className={`${styles.field} ${styles.span2}`}>
          <span className={styles.label}>Title</span>
          <input className={styles.input} name="title" required maxLength={191} placeholder="Week 3 slides" />
        </label>
        <div className={styles.field}>
          <span id={`${idPrefix}-kind`} className={styles.label}>
            Kind
          </span>
          <SelectField name="kind" labelId={`${idPrefix}-kind`} options={KIND_OPTIONS} defaultValue="SLIDES" />
        </div>
        <label className={styles.field}>
          <span className={styles.label}>Position</span>
          <input
            className={styles.input}
            name="order"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            defaultValue={0}
            aria-describedby={`${idPrefix}-order-help`}
          />
          <span id={`${idPrefix}-order-help`} className={styles.help}>
            Lower comes first
          </span>
        </label>
        <label className={`${styles.field} ${styles.span3}`}>
          <span className={styles.label}>Link</span>
          <input className={styles.input} name="url" type="url" required maxLength={1024} placeholder="https://" />
        </label>
        <div className={`${styles.field} ${styles.alignEnd}`}>
          <button type="submit" className={styles.secondary}>
            Add material
          </button>
        </div>
      </div>
    </form>
  );
}

/** Removal is a two-step disclosure: works without JavaScript, never one click. */
function ConfirmRemove({
  action,
  id,
  anchor,
  what,
}: {
  action: (form: FormData) => Promise<void>;
  id: string;
  anchor?: string;
  what: string;
}) {
  return (
    <details className={styles.confirm}>
      <summary className={styles.ghostDanger}>Remove</summary>
      <form action={action} className={styles.confirmPanel}>
        <input type="hidden" name="id" value={id} />
        {anchor && <input type="hidden" name="anchor" value={anchor} />}
        <span>Remove {what}? This cannot be undone.</span>
        <button type="submit" className={styles.danger}>
          Yes, remove
        </button>
      </form>
    </details>
  );
}

function MaterialRows({
  materials,
  anchor,
}: {
  materials: { id: string; title: string; kind: keyof typeof SIRAH_MATERIAL_LABELS; url: string }[];
  anchor: string;
}) {
  if (!materials.length) return <p className={styles.emptyLine}>No materials yet.</p>;
  return (
    <ul className={styles.rows}>
      {materials.map((material) => (
        <li key={material.id} className={styles.row}>
          <span className={styles.tag}>{SIRAH_MATERIAL_LABELS[material.kind]}</span>
          <span className={styles.rowMain}>
            <a href={material.url} target="_blank" rel="noopener noreferrer" className={styles.rowLink}>
              {material.title}
            </a>
            <span className={styles.rowMeta}>{host(material.url)}</span>
          </span>
          <ConfirmRemove action={removeMaterial} id={material.id} anchor={anchor} what="this material" />
        </li>
      ))}
    </ul>
  );
}

export default async function SirahClassroomAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  if (!(access.role === "SUPER_ADMIN" || access.role === "MANAGER")) redirect("/admin/sirah");
  const { notice, error } = await searchParams;
  const themed = `${styles.screen} ${sirahFont.variable}`;

  if (!(await sirahClassroomAvailable())) {
    return (
      <section data-theme="sirah-classroom" className={themed}>
        <header className={styles.intro}>
          <div>
            <h2 className={styles.title}>Classroom</h2>
            <p className={styles.lede}>
              The classroom tables are not in this database yet. Deploy the classroom migrations and reload this page.
            </p>
          </div>
        </header>
      </section>
    );
  }

  const { lessons, courseMaterials, announcements } = await getClassroomData();
  const now = new Date();
  const upcoming = nextLesson(lessons, now);
  const weeks = new Set(lessons.map((lesson) => lesson.weekNumber)).size;
  const missingZoom = lessons.filter((lesson) => lessonStatus(lesson.scheduledAt, now) !== "past" && !lesson.zoomJoinUrl).length;

  return (
    <section data-theme="sirah-classroom" className={themed}>
      <header className={styles.intro}>
        <div>
          <h2 className={styles.title}>Classroom</h2>
          <p className={styles.lede}>
            {lessons.length === 0
              ? "No sessions yet. Create the first one and it appears in every enrolled student's classroom."
              : `${lessons.length} ${lessons.length === 1 ? "session" : "sessions"} across ${weeks} ${weeks === 1 ? "week" : "weeks"}.${
                  upcoming ? ` Next: week ${upcoming.weekNumber}, ${shortDate.format(upcoming.scheduledAt)}.` : ""
                }`}
          </p>
          {missingZoom > 0 && (
            <p className={styles.attention}>
              {missingZoom} upcoming {missingZoom === 1 ? "session has" : "sessions have"} no Zoom link yet.
            </p>
          )}
        </div>
        <div className={styles.introActions}>
          <a href="#new-session" className={styles.primary}>
            New session
          </a>
          <a href="/seerah/classroom" target="_blank" rel="noopener noreferrer" className={styles.secondary}>
            Student view
          </a>
        </div>
      </header>

      {notice && (
        <p className={styles.flash} role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className={styles.flashError} role="alert">
          {error}
        </p>
      )}

      <section className={styles.card} aria-labelledby="sessions-title">
        <div className={styles.cardHead}>
          <h3 id="sessions-title" className={styles.cardTitle}>
            Sessions
          </h3>
          <p className={styles.cardLede}>In week order. Times are London time. Open one to edit it or manage its materials.</p>
        </div>
        {lessons.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>The schedule is empty</p>
            <p>Sessions you create are listed here in week order.</p>
            <a href="#new-session" className={styles.secondary}>
              Create the first session
            </a>
          </div>
        ) : (
          <ol className={styles.ledger}>
            {lessons.map((lesson) => {
              const status = lessonStatus(lesson.scheduledAt, now);
              const anchor = `session-${lesson.id}`;
              return (
                <li key={lesson.id} id={anchor} className={styles.ledgerItem}>
                  <details className={styles.session}>
                    <summary className={styles.sessionSummary}>
                      <span className={styles.week}>
                        <span className={styles.weekLabel}>Week</span>
                        <span className={styles.weekNumber}>{lesson.weekNumber}</span>
                      </span>
                      <span className={styles.sessionMain}>
                        <span className={styles.sessionTitle}>{lesson.title}</span>
                        <span className={styles.sessionMeta}>
                          {listDate.format(lesson.scheduledAt)}, {lesson.materials.length}{" "}
                          {lesson.materials.length === 1 ? "material" : "materials"}
                        </span>
                      </span>
                      <span className={styles.sessionState}>
                        <span className={`${styles.status} ${status === "live" ? styles.statusLive : ""}`}>{STATUS_TEXT[status]}</span>
                        {status !== "past" && !lesson.zoomJoinUrl && <span className={styles.warn}>No Zoom link</span>}
                      </span>
                      <svg className={styles.disclosure} viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M4 6l4 4 4-4" />
                      </svg>
                    </summary>
                    <div className={styles.sessionBody}>
                      <LessonForm lesson={lesson} idPrefix={anchor} action={updateLesson} submitLabel="Save changes" />
                      <div className={styles.subsection}>
                        <h4 className={styles.subTitle}>Materials and recording</h4>
                        <MaterialRows materials={lesson.materials} anchor={anchor} />
                        <MaterialForm lessonId={lesson.id} idPrefix={`${anchor}-material`} />
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className={styles.card} id="new-session" aria-labelledby="new-session-title">
        <div className={styles.cardHead}>
          <h3 id="new-session-title" className={styles.cardTitle}>
            New session
          </h3>
          <p className={styles.cardLede}>The Zoom link can be added now or later. Materials are added once the session exists.</p>
        </div>
        <LessonForm idPrefix="new-session" action={createLesson} submitLabel="Create session" />
      </section>

      <section className={styles.card} id="course-materials" aria-labelledby="course-materials-title">
        <div className={styles.cardHead}>
          <h3 id="course-materials-title" className={styles.cardTitle}>
            Course-wide materials
          </h3>
          <p className={styles.cardLede}>Readings and references for the whole programme, listed on the classroom page.</p>
        </div>
        <MaterialRows materials={courseMaterials} anchor="course-materials" />
        <MaterialForm idPrefix="course-material" />
      </section>

      <section className={styles.card} id="announcements" aria-labelledby="announcements-title">
        <div className={styles.cardHead}>
          <h3 id="announcements-title" className={styles.cardTitle}>
            Announcements
          </h3>
          <p className={styles.cardLede}>Pinned announcements sit at the top of the classroom. The rest are listed at the bottom.</p>
        </div>
        <form action={postAnnouncement} className={styles.form}>
          <div className={styles.grid}>
            <label className={`${styles.field} ${styles.span4}`}>
              <span className={styles.label}>Title</span>
              <input className={styles.input} name="title" required maxLength={191} />
            </label>
            <label className={`${styles.field} ${styles.span4}`}>
              <span className={styles.label}>Message</span>
              <textarea className={styles.textarea} name="body" required maxLength={5000} />
            </label>
          </div>
          <div className={styles.formFoot}>
            <label className={styles.check}>
              <input type="checkbox" name="pinned" className={styles.checkbox} />
              <span>Pin to the top of the classroom</span>
            </label>
            <button type="submit" className={styles.primary}>
              Post announcement
            </button>
          </div>
        </form>
        {announcements.length > 0 && (
          <ul className={`${styles.rows} ${styles.noticeRows}`}>
            {announcements.map((item) => (
              <li key={item.id} className={styles.notice}>
                <div className={styles.rowMain}>
                  <span className={styles.noticeTitle}>
                    {item.title}
                    {item.pinned && <span className={styles.pinned}>Pinned</span>}
                  </span>
                  <span className={styles.rowMeta}>{shortDate.format(item.publishedAt)}</span>
                  <p className={styles.noticeBody}>{item.body}</p>
                </div>
                <div className={styles.rowActions}>
                  <form action={setAnnouncementPinned}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="pinned" value={item.pinned ? "false" : "true"} />
                    <button type="submit" className={styles.secondarySmall}>
                      {item.pinned ? "Unpin" : "Pin"}
                    </button>
                  </form>
                  <ConfirmRemove action={removeAnnouncement} id={item.id} what="this announcement" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
