import { redirect } from "next/navigation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import {
  SIRAH_DEFAULT_TIMEZONE,
  SIRAH_MATERIAL_KINDS,
  SIRAH_MATERIAL_LABELS,
  lessonStatus,
  utcToZonedLocal,
} from "@/lib/sirah/classroom";
import { getClassroomData, sirahClassroomAvailable } from "@/services/sirah-classroom.service";
import "@/components/sirah/admin-classroom-tokens.css";
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
  ["Europe/London", "London"],
  ["Asia/Karachi", "Pakistan"],
  ["Asia/Dubai", "Gulf"],
  ["Europe/Berlin", "Central Europe"],
  ["America/New_York", "US Eastern"],
  ["America/Chicago", "US Central"],
  ["America/Los_Angeles", "US Pacific"],
  ["Australia/Sydney", "Sydney"],
  ["UTC", "UTC"],
] as const;

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

type LessonDefaults = {
  id?: string;
  title?: string;
  summary?: string;
  weekNumber?: number;
  scheduledAt?: Date;
  zoomJoinUrl?: string | null;
  zoomMeetingId?: string | null;
};

function LessonFields({ lesson, idPrefix }: { lesson?: LessonDefaults; idPrefix: string }) {
  return (
    <>
      {lesson?.id && <input type="hidden" name="id" value={lesson.id} />}
      <label className={styles.wide}>
        Title
        <input name="title" required maxLength={191} defaultValue={lesson?.title} />
      </label>
      <label>
        Week
        <input name="weekNumber" type="number" min={1} max={60} required defaultValue={lesson?.weekNumber ?? ""} />
      </label>
      <label>
        Starts at
        <input
          name="scheduledLocal"
          type="datetime-local"
          required
          defaultValue={lesson?.scheduledAt ? utcToZonedLocal(lesson.scheduledAt, SIRAH_DEFAULT_TIMEZONE) : ""}
          aria-describedby={`${idPrefix}-zone-hint`}
        />
      </label>
      <label>
        Time zone of that time
        <select name="timeZone" defaultValue={SIRAH_DEFAULT_TIMEZONE}>
          {TIME_ZONES.map(([value, label]) => (
            <option key={value} value={value}>
              {label} ({value})
            </option>
          ))}
        </select>
        <span id={`${idPrefix}-zone-hint`} className={styles.hint}>
          Students see the time converted to their own zone.
        </span>
      </label>
      <label>
        Zoom meeting ID
        <input name="zoomMeetingId" maxLength={64} defaultValue={lesson?.zoomMeetingId ?? ""} inputMode="numeric" />
      </label>
      <label className={styles.wide}>
        Zoom join link
        <input
          name="zoomJoinUrl"
          type="url"
          maxLength={1024}
          placeholder="https://us02web.zoom.us/j/…"
          defaultValue={lesson?.zoomJoinUrl ?? ""}
        />
        <span className={styles.hint}>Students only receive it from 30 minutes before the start.</span>
      </label>
      <label className={styles.wide}>
        Summary
        <textarea name="summary" maxLength={5000} defaultValue={lesson?.summary} />
      </label>
    </>
  );
}

function MaterialForm({ lessonId }: { lessonId?: string }) {
  return (
    <form action={addMaterial} className={styles.form}>
      <input type="hidden" name="lessonId" value={lessonId ?? ""} />
      <label>
        Title
        <input name="title" required maxLength={191} />
      </label>
      <label>
        Kind
        <select name="kind" defaultValue="SLIDES">
          {SIRAH_MATERIAL_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {SIRAH_MATERIAL_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.wide}>
        Link
        <input name="url" type="url" required maxLength={1024} placeholder="https://" />
      </label>
      <label>
        Position
        <input name="order" type="number" min={0} max={999} defaultValue={0} />
        <span className={styles.hint}>Lower numbers are listed first.</span>
      </label>
      <div className={styles.actions}>
        <button type="submit" className={styles.secondary}>
          Add material
        </button>
      </div>
    </form>
  );
}

function MaterialRows({
  materials,
  anchor,
}: {
  materials: { id: string; title: string; kind: keyof typeof SIRAH_MATERIAL_LABELS; url: string }[];
  anchor: string;
}) {
  if (!materials.length) return <p className={styles.empty}>No materials yet.</p>;
  return (
    <ul className={styles.materials}>
      {materials.map((material) => (
        <li key={material.id}>
          <span className={styles.kind}>{SIRAH_MATERIAL_LABELS[material.kind]}</span>
          <a href={material.url} target="_blank" rel="noopener noreferrer">
            {material.title}
          </a>
          <form action={removeMaterial}>
            <input type="hidden" name="id" value={material.id} />
            <input type="hidden" name="anchor" value={anchor} />
            <button type="submit" className={styles.danger}>
              Remove
            </button>
          </form>
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

  if (!(await sirahClassroomAvailable())) {
    return (
      <section data-theme="sirah-workspace-classroom" className={styles.screen}>
        <div className={`${styles.panel} ${styles.head}`}>
          <h2>Classroom</h2>
          <p>
            The classroom tables are not in this database yet. Deploy the migration
            <code> 202611150001_sirah_classroom</code> and reload.
          </p>
        </div>
      </section>
    );
  }

  const { lessons, courseMaterials, announcements } = await getClassroomData();
  const now = new Date();

  return (
    <section data-theme="sirah-workspace-classroom" className={styles.screen}>
      <div className={`${styles.panel} ${styles.head}`}>
        <h2>Classroom</h2>
        <p>
          Sessions, joining links, materials and announcements for enrolled students. Times in this list are London time.{" "}
          <a href="/seerah/classroom" target="_blank" rel="noopener noreferrer">
            Open the student view
          </a>
        </p>
      </div>

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

      <div className={styles.panel}>
        <h3 className={styles.sectionTitle}>Sessions</h3>
        {lessons.length === 0 ? (
          <p className={styles.empty}>No sessions yet. Create the first one below.</p>
        ) : (
          <ol className={styles.ledger}>
            {lessons.map((lesson) => {
              const status = lessonStatus(lesson.scheduledAt, now);
              const anchor = `session-${lesson.id}`;
              return (
                <li key={lesson.id} id={anchor}>
                  <details className={styles.session}>
                    <summary>
                      <span className={styles.week}>Week {lesson.weekNumber}</span>
                      <span className={styles.sessionTitle}>{lesson.title}</span>
                      <span className={styles.meta}>
                        {listDate.format(lesson.scheduledAt)}, {STATUS_TEXT[status].toLowerCase()}
                        {lesson.zoomJoinUrl ? "" : ", no Zoom link"}
                      </span>
                    </summary>
                    <div className={styles.sessionBody}>
                      <form action={updateLesson} className={styles.form}>
                        <LessonFields lesson={lesson} idPrefix={anchor} />
                        <div className={styles.actions}>
                          <button type="submit" className={styles.primary}>
                            Save session
                          </button>
                        </div>
                      </form>
                      <div>
                        <h4 className={styles.subTitle}>Materials and recording</h4>
                        <MaterialRows materials={lesson.materials} anchor={anchor} />
                      </div>
                      <MaterialForm lessonId={lesson.id} />
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className={styles.panel} id="new-session">
        <h3 className={styles.sectionTitle}>New session</h3>
        <form action={createLesson} className={styles.form}>
          <LessonFields idPrefix="new-session" />
          <div className={styles.actions}>
            <button type="submit" className={styles.primary}>
              Create session
            </button>
          </div>
        </form>
      </div>

      <div className={styles.panel} id="course-materials">
        <h3 className={styles.sectionTitle}>Course-wide materials</h3>
        <MaterialRows materials={courseMaterials} anchor="course-materials" />
        <div className={styles.spaced}>
          <MaterialForm />
        </div>
      </div>

      <div className={styles.panel} id="announcements">
        <h3 className={styles.sectionTitle}>Announcements</h3>
        <form action={postAnnouncement} className={styles.form}>
          <label className={styles.wide}>
            Title
            <input name="title" required maxLength={191} />
          </label>
          <label className={styles.wide}>
            Message
            <textarea name="body" required maxLength={5000} />
          </label>
          <label className={styles.check}>
            <input type="checkbox" name="pinned" />
            Pin to the top of the classroom
          </label>
          <div className={styles.actions}>
            <button type="submit" className={styles.primary}>
              Post announcement
            </button>
          </div>
        </form>
        {announcements.length > 0 && (
          <ul className={styles.notices}>
            {announcements.map((item) => (
              <li key={item.id}>
                <div>
                  <h4>
                    {item.title}
                    {item.pinned ? " (pinned)" : ""}
                  </h4>
                  <p>{item.body}</p>
                </div>
                <div className={styles.rowActions}>
                  <form action={setAnnouncementPinned}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="pinned" value={item.pinned ? "false" : "true"} />
                    <button type="submit" className={styles.secondary}>
                      {item.pinned ? "Unpin" : "Pin"}
                    </button>
                  </form>
                  <form action={removeAnnouncement}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className={styles.danger}>
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
