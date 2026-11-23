import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionIdentity } from "@/lib/auth/session";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import { spacesConfigured } from "@/lib/sirah/spaces";
import { prisma } from "@/lib/prisma";
import { hostMaySessionResources, lmsContentAvailable, sessionResources } from "@/lib/lms/content";
import { viewerTimeZone } from "@/lib/time/viewer-zone.server";
import { classroomClock } from "@/components/indigo/classroom/clock";
import { MaterialSource } from "@/components/sirah/classroom-material-source";
import { sirahFont } from "@/lib/sirah/font";
import "@/app/seerah/classroom/tokens.css";
import styles from "@/components/sirah/admin-classroom.module.css";
import { addHostResource, changeHostResourceVisibility, removeHostResource, requestHostResourceUpload } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Session resources | ${SIRAH_TITLE}`,
  robots: { index: false, follow: false },
};

/* A session host adds files and links to their own session and publishes
 * them to the session's students. Anyone but the assigned host gets a 404. */

const host = (url: string | null) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
};

export default async function HostResourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const identity = await getSessionIdentity();
  if (!identity) redirect("/login");
  if (!(await lmsContentAvailable())) notFound();
  const { sessionId } = await params;
  if (!(await hostMaySessionResources(identity, sessionId))) notFound();
  const { notice, error } = await searchParams;

  const session = await prisma.lmsSession.findUnique({ where: { id: sessionId }, select: { id: true, title: true, startsAt: true, cohortId: true } });
  if (!session) notFound();
  const resources = await sessionResources(sessionId);
  const profile = await prisma.studentProfile.findUnique({ where: { userId: identity.id }, select: { timezone: true } });
  const clock = classroomClock((await viewerTimeZone()) ?? profile?.timezone);

  return (
    <main data-theme="sirah-classroom" className={`${styles.screen} ${sirahFont.variable}`} style={{ maxWidth: "60rem", margin: "0 auto", padding: "1.5rem 1rem 4rem" }}>
      <header className={styles.intro}>
        <div>
          <h1 className={styles.title}>Resources for {session.title}</h1>
          <p className={styles.lede}>
            {clock.longDate.format(session.startsAt)} ({clock.zoneName}) · {session.cohortId}. Added files and links stay hidden until you publish them;
            publishing shows them to this session&rsquo;s enrolled students and notifies them once.
          </p>
        </div>
        <div className={styles.introActions}>
          <Link href="/seerah/classroom/teaching" className={styles.secondary}>
            My sessions
          </Link>
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

      <section className={styles.card} aria-labelledby="host-resources">
        <div className={styles.cardHead}>
          <h2 id="host-resources" className={styles.cardTitle}>
            Resources
          </h2>
        </div>
        {resources.length ? (
          <ul className={styles.rows}>
            {resources.map((resource) => {
              const published = resource.visibility === "PUBLISHED";
              return (
                <li key={resource.id} className={styles.row}>
                  <span className={`${styles.status} ${published ? styles.statusLive : ""}`}>{published ? "Published" : "Hidden"}</span>
                  <span className={styles.rowMain}>
                    <a
                      href={resource.kind === "FILE" ? `/seerah/classroom/teaching/files/${encodeURIComponent(resource.id)}` : (resource.url ?? "#")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.rowLink}
                    >
                      {resource.title}
                    </a>
                    <span className={styles.rowMeta}>
                      {resource.kind === "FILE" ? `File · ${resource.originalFilename ?? "file"}` : `Link · ${host(resource.url)}`} · added by {resource.uploadedBy}
                    </span>
                  </span>
                  <span className={styles.rowActions}>
                    <form action={changeHostResourceVisibility}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <input type="hidden" name="id" value={resource.id} />
                      <input type="hidden" name="visibility" value={published ? "HIDDEN" : "PUBLISHED"} />
                      <button type="submit" className={published ? styles.secondarySmall : styles.primary}>
                        {published ? "Hide" : "Publish"}
                      </button>
                    </form>
                    <details className={styles.confirm}>
                      <summary className={styles.ghostDanger}>Remove</summary>
                      <form action={removeHostResource} className={styles.confirmPanel}>
                        <input type="hidden" name="sessionId" value={session.id} />
                        <input type="hidden" name="id" value={resource.id} />
                        <span>Remove this resource? This cannot be undone.</span>
                        <button type="submit" className={styles.danger}>
                          Yes, remove
                        </button>
                      </form>
                    </details>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.emptyLine}>No resources for this session yet.</p>
        )}

        <form action={addHostResource} className={styles.inlineForm}>
          <input type="hidden" name="sessionId" value={session.id} />
          <input type="hidden" name="kind" value="FILE" />
          <p className={styles.inlineTitle}>Add a resource</p>
          <div className={styles.grid}>
            <label className={`${styles.field} ${styles.span2}`}>
              <span className={styles.label}>Title</span>
              <input className={styles.input} name="title" required maxLength={191} placeholder="Slides for this session" />
            </label>
            <MaterialSource idPrefix="host-resource" requestUpload={requestHostResourceUpload.bind(null, session.id)} uploadsEnabled={spacesConfigured()} />
            <div className={`${styles.field} ${styles.alignEnd}`}>
              <button type="submit" className={styles.secondary}>
                Add resource
              </button>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
