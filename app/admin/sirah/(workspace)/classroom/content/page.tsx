import { redirect } from "next/navigation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { sirahFont } from "@/lib/sirah/font";
import { SIRAH_BATCH } from "@/lib/sirah/catalog";
import { SIRAH_DEFAULT_TIMEZONE } from "@/lib/sirah/classroom";
import { spacesConfigured } from "@/lib/sirah/spaces";
import { listCohorts } from "@/lib/lms/schedule";
import { adminCohortContent, lmsContentAvailable, type AdminResourceRow } from "@/lib/lms/content";
import { MaterialSource } from "@/components/sirah/classroom-material-source";
import { SelectField } from "@/components/sirah/classroom-pickers";
import "@/app/seerah/classroom/tokens.css";
import styles from "@/components/sirah/admin-classroom.module.css";
import {
  addResource,
  changeAnnouncementPublished,
  changeResourceVisibility,
  removeAnnouncement,
  removeResource,
  requestResourceUpload,
  saveAnnouncement,
} from "./actions";

export const dynamic = "force-dynamic";

/* LMS Phase 5: per-cohort resources (files and links) and announcements.
 * Everything starts hidden / as a draft; publishing shows it to the cohort's
 * enrolled students and notifies them once (in the classroom and by email). */

const listDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: SIRAH_DEFAULT_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function fileSize(bytes: bigint | null) {
  if (bytes === null) return "";
  const value = Number(bytes);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

const host = (url: string | null) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
};

/** Removal is a two-step disclosure: works without JavaScript, never one click. */
function ConfirmRemove({ action, id, cohortId, what }: { action: (form: FormData) => Promise<void>; id: string; cohortId: string; what: string }) {
  return (
    <details className={styles.confirm}>
      <summary className={styles.ghostDanger}>Remove</summary>
      <form action={action} className={styles.confirmPanel}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="cohortId" value={cohortId} />
        <span>Remove {what}? This cannot be undone.</span>
        <button type="submit" className={styles.danger}>
          Yes, remove
        </button>
      </form>
    </details>
  );
}

function ResourceRows({ resources, cohortId }: { resources: AdminResourceRow[]; cohortId: string }) {
  if (!resources.length) return <p className={styles.emptyLine}>No resources yet. Add the first one below.</p>;
  return (
    <ul className={styles.rows}>
      {resources.map((resource) => {
        const published = resource.visibility === "PUBLISHED";
        return (
          <li key={resource.id} id={`resource-${resource.id}`} className={styles.row}>
            <span className={`${styles.status} ${published ? styles.statusLive : ""}`}>{published ? "Published" : "Hidden"}</span>
            <span className={styles.rowMain}>
              <a
                href={resource.kind === "FILE" ? `/admin/sirah/classroom/content/files/${encodeURIComponent(resource.id)}` : (resource.url ?? "#")}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.rowLink}
              >
                {resource.title}
              </a>
              <span className={styles.rowMeta}>
                {resource.kind === "FILE"
                  ? `File · ${resource.originalFilename ?? "file"}${resource.sizeBytes !== null ? ` · ${fileSize(resource.sizeBytes)}` : ""}`
                  : `Link · ${host(resource.url)}`}
                {" · "}
                {resource.recordingTitle ? `Recording: ${resource.recordingTitle}` : resource.sessionTitle ? `Session: ${resource.sessionTitle}` : "Whole cohort"}
                {" · "}
                {published && resource.publishedAt ? `Published ${listDate.format(resource.publishedAt)}` : `Added ${listDate.format(resource.createdAt)}`} by{" "}
                {resource.uploadedBy}
              </span>
            </span>
            <span className={styles.rowActions}>
              <form action={changeResourceVisibility}>
                <input type="hidden" name="id" value={resource.id} />
                <input type="hidden" name="cohortId" value={cohortId} />
                <input type="hidden" name="visibility" value={published ? "HIDDEN" : "PUBLISHED"} />
                <button type="submit" className={published ? styles.secondarySmall : styles.primary}>
                  {published ? "Hide" : "Publish"}
                </button>
              </form>
              <ConfirmRemove action={removeResource} id={resource.id} cohortId={cohortId} what="this resource" />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default async function LmsContentAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string; notice?: string; error?: string }>;
}) {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  if (!(access.role === "SUPER_ADMIN" || access.role === "MANAGER")) redirect("/admin/sirah");
  const { cohort: requested, notice, error } = await searchParams;
  const themed = `${styles.screen} ${sirahFont.variable}`;

  if (!(await lmsContentAvailable())) {
    return (
      <section data-theme="sirah-classroom" className={themed}>
        <header className={styles.intro}>
          <div>
            <h2 className={styles.title}>Resources and announcements</h2>
            <p className={styles.lede}>
              The resource, announcement and notification tables are not in this database yet. Deploy the LMS Phase 5 migration and reload this page.
            </p>
          </div>
        </header>
      </section>
    );
  }

  const cohorts = await listCohorts();
  const cohortId =
    cohorts.find((c) => c.batchCode === requested)?.batchCode ??
    cohorts.find((c) => c.batchCode === SIRAH_BATCH)?.batchCode ??
    cohorts[0]?.batchCode ??
    null;
  const data = cohortId ? await adminCohortContent(cohortId) : null;
  const targets = [
    { value: "cohort", label: "Whole cohort" },
    ...(data?.recordings ?? []).map((r) => ({ value: `recording:${r.id}`, label: `Recording: ${r.title}` })),
    ...(data?.sessions ?? []).filter((s) => s.status !== "CANCELLED").map((s) => ({ value: s.id, label: `Session: ${s.title}`, hint: listDate.format(s.startsAt) })),
  ];

  return (
    <section data-theme="sirah-classroom" className={themed}>
      <header className={styles.intro}>
        <div>
          <h2 className={styles.title}>Resources and announcements</h2>
          <p className={styles.lede}>
            {cohortId
              ? `Files, links and notices for ${cohortId}. Everything starts hidden; publishing shows it to the cohort's enrolled students and notifies them once, in the classroom and by email.`
              : "No cohort exists yet."}
          </p>
        </div>
        <div className={styles.introActions}>
          <a href="#new-resource" className={styles.primary}>
            Add resource
          </a>
          <a href="#new-announcement" className={styles.secondary}>
            New announcement
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

      {cohorts.length > 1 ? (
        <form method="get" className={styles.inlineForm} aria-label="Choose a cohort">
          <div className={styles.grid}>
            <div className={`${styles.field} ${styles.span2}`}>
              <span id="cohort-pick" className={styles.label}>
                Cohort
              </span>
              <SelectField name="cohort" labelId="cohort-pick" options={cohorts.map((c) => ({ value: c.batchCode, label: c.batchCode }))} defaultValue={cohortId ?? ""} />
            </div>
            <div className={`${styles.field} ${styles.alignEnd}`}>
              <button type="submit" className={styles.secondary}>
                Show
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {data && cohortId ? (
        <>
          <section className={styles.card} id="resources" aria-labelledby="resources-title">
            <div className={styles.cardHead}>
              <h3 id="resources-title" className={styles.cardTitle}>
                Resources
              </h3>
              <p className={styles.cardLede}>
                Newest first. Students open files through a short-lived signed link after their enrolment is checked; the storage bucket stays private.
              </p>
            </div>
            <ResourceRows resources={data.resources} cohortId={cohortId} />

            <form action={addResource} className={styles.inlineForm} id="new-resource">
              <input type="hidden" name="cohortId" value={cohortId} />
              {/* MaterialSource reads a "kind" field; file rules follow the file's own type. */}
              <input type="hidden" name="kind" value="FILE" />
              <p className={styles.inlineTitle}>Add a resource</p>
              <div className={styles.grid}>
                <label className={`${styles.field} ${styles.span2}`}>
                  <span className={styles.label}>Title</span>
                  <input className={styles.input} name="title" required maxLength={191} placeholder="Reading for week 3" />
                </label>
                <div className={`${styles.field} ${styles.span2}`}>
                  <span id="resource-target" className={styles.label}>
                    For
                  </span>
                  <SelectField name="target" labelId="resource-target" options={targets} defaultValue="cohort" />
                </div>
                <MaterialSource idPrefix="new-resource" requestUpload={requestResourceUpload} uploadsEnabled={spacesConfigured()} />
                <div className={`${styles.field} ${styles.alignEnd}`}>
                  <button type="submit" className={styles.secondary}>
                    Add resource
                  </button>
                </div>
              </div>
              <p className={styles.help}>Added hidden. Publish it from the list when it is ready.</p>
            </form>
          </section>

          <section className={styles.card} id="announcements" aria-labelledby="announcements-title">
            <div className={styles.cardHead}>
              <h3 id="announcements-title" className={styles.cardTitle}>
                Announcements
              </h3>
              <p className={styles.cardLede}>Students see published announcements in the classroom, newest first. Drafts are visible only here.</p>
            </div>

            <form action={saveAnnouncement} className={styles.inlineForm} id="new-announcement">
              <input type="hidden" name="cohortId" value={cohortId} />
              <p className={styles.inlineTitle}>New announcement</p>
              <div className={styles.grid}>
                <label className={`${styles.field} ${styles.span4}`}>
                  <span className={styles.label}>Title</span>
                  <input className={styles.input} name="title" required maxLength={191} />
                </label>
                <label className={`${styles.field} ${styles.span4}`}>
                  <span className={styles.label}>Message</span>
                  <textarea className={styles.textarea} name="body" required maxLength={10000} />
                </label>
              </div>
              <div className={styles.formFoot}>
                <div className={styles.checks}>
                  <label className={styles.check}>
                    <input type="checkbox" name="publish" className={styles.checkbox} aria-describedby="publish-help" />
                    <span>Publish now</span>
                  </label>
                  <span id="publish-help" className={styles.help}>
                    Publishing notifies every enrolled student in this cohort once, in the classroom and by email. Unticked, it is saved as a draft.
                  </span>
                </div>
                <button type="submit" className={styles.primary}>
                  Save announcement
                </button>
              </div>
            </form>

            {data.announcements.length ? (
              <ul className={`${styles.rows} ${styles.noticeRows}`}>
                {data.announcements.map((item) => (
                  <li key={item.id} id={`announcement-${item.id}`} className={styles.notice}>
                    <div className={styles.rowMain}>
                      <span className={styles.noticeTitle}>
                        {item.title}
                        <span className={item.publishedAt ? styles.pinned : styles.tag}>{item.publishedAt ? "Published" : "Draft"}</span>
                      </span>
                      <span className={styles.rowMeta}>
                        {item.publishedAt ? `Published ${listDate.format(item.publishedAt)}` : `Saved ${listDate.format(item.createdAt)}`} by {item.createdBy}
                      </span>
                      <p className={styles.noticeBody}>{item.body}</p>
                      <details className={styles.confirm}>
                        <summary className={styles.secondarySmall}>Edit</summary>
                        <form action={saveAnnouncement} className={styles.inlineForm}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="cohortId" value={cohortId} />
                          <div className={styles.grid}>
                            <label className={`${styles.field} ${styles.span4}`}>
                              <span className={styles.label}>Title</span>
                              <input className={styles.input} name="title" required maxLength={191} defaultValue={item.title} />
                            </label>
                            <label className={`${styles.field} ${styles.span4}`}>
                              <span className={styles.label}>Message</span>
                              <textarea className={styles.textarea} name="body" required maxLength={10000} defaultValue={item.body} />
                            </label>
                          </div>
                          <div className={styles.formFoot}>
                            <span className={styles.help}>Saving an edit does not notify students again.</span>
                            <button type="submit" className={styles.primary}>
                              Save changes
                            </button>
                          </div>
                        </form>
                      </details>
                    </div>
                    <div className={styles.rowActions}>
                      <form action={changeAnnouncementPublished}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="cohortId" value={cohortId} />
                        <input type="hidden" name="publish" value={item.publishedAt ? "0" : "1"} />
                        <button type="submit" className={item.publishedAt ? styles.secondarySmall : styles.primary}>
                          {item.publishedAt ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                      <ConfirmRemove action={removeAnnouncement} id={item.id} cohortId={cohortId} what="this announcement" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyLine}>No announcements for this cohort yet.</p>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
