import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { taskAdminRole } from "@/lib/lms/task-admin-access";
import { tasksAvailable } from "@/lib/lms/tasks";
import { TaskEditor } from "@/components/sirah/tasks/task-editor";
import { sirahFont } from "@/lib/sirah/font";
import "@/app/seerah/classroom/tokens.css";
import { createTask } from "./actions";
import styles from "@/components/sirah/admin-classroom.module.css";

export const dynamic = "force-dynamic";
export default async function AdminTasks({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  if (!(await taskAdminRole())) redirect("/admin/sirah");
  const { notice, error } = await searchParams;
  if (!(await tasksAvailable())) return <section className={styles.card}><h2>Class tasks</h2><p>Tasks will be available after the tasks database migration is deployed.</p></section>;
  const [tasks, sessions, recordings, external] = await Promise.all([
    prisma.lmsTask.findMany({ include: { session: { select: { title: true } }, recording: { select: { session: { select: { title: true } } } }, externalRecording: { select: { title: true } }, _count: { select: { submissions: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.lmsSession.findMany({ select: { id: true, title: true, cohortId: true, startsAt: true }, orderBy: { startsAt: "desc" } }),
    prisma.recording.findMany({ select: { id: true, session: { select: { title: true, cohortId: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.lmsResource.findMany({ where: { kind: "LINK", contentType: "video/x-external-recording", parentRecordingId: null, OR: [{ sessionId: { not: null } }, { sessionId: null, cohortId: null }] }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return <section className={`${styles.screen} ${sirahFont.variable}`} data-theme="sirah-classroom">
    <header className={styles.intro}><div><h2 className={styles.title}>Class tasks</h2><p className={styles.lede}>Create a task for a session or recording. Drafts are private until published.</p></div></header>
    {notice && <p className={styles.flash} role="status">{notice}</p>}{error && <p className={styles.flashError} role="alert">{error}</p>}
    <section className={styles.card}><h3 className={styles.cardTitle}>New task</h3><form action={createTask} className={styles.inlineForm}>
      <label className={styles.field}>Class or recording<select className={styles.input} name="target" required defaultValue=""><option value="" disabled>Choose a class or recording</option>
        {sessions.map(item => <option key={item.id} value={`session:${item.id}`}>Session: {item.title} · {item.cohortId} · {item.startsAt.toISOString().slice(0, 10)}</option>)}
        {recordings.map(item => <option key={item.id} value={`recording:${item.id}`}>Zoom recording: {item.session.title} · {item.session.cohortId}</option>)}
        {external.map(item => <option key={item.id} value={`external:${item.id}`}>Recording: {item.title}</option>)}
      </select></label>
      <label className={styles.field}>Title<input className={styles.input} name="title" required maxLength={191} /></label>
      <TaskEditor /><button type="submit" className={styles.primary}>Create draft</button>
    </form></section>
    <section className={styles.card}><h3 className={styles.cardTitle}>Tasks</h3>{tasks.length ? <ul className={styles.rows}>{tasks.map(task => <li className={styles.row} key={task.id}><div><Link href={`/admin/sirah/classroom/tasks/${task.id}`}><strong>{task.title}</strong></Link><p>{task.session?.title || task.recording?.session.title || task.externalRecording?.title || "Class unavailable"} · {task.publishedAt ? "Published" : "Draft"} · {task._count.submissions} submissions</p></div></li>)}</ul> : <p>No tasks yet.</p>}</section>
  </section>;
}
