import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { taskAdminRole } from "@/lib/lms/task-admin-access";
import { tasksAvailable } from "@/lib/lms/tasks";
import { TaskEditor } from "@/components/sirah/tasks/task-editor";
import { sirahFont } from "@/lib/sirah/font";
import "@/app/seerah/classroom/tokens.css";
import { publishTask, updateTask } from "../actions";
import styles from "@/components/sirah/admin-classroom.module.css";

export const dynamic = "force-dynamic";
export default async function AdminTaskDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  if (!(await taskAdminRole())) redirect("/admin/sirah");
  if (!(await tasksAvailable())) notFound();
  const { id } = await params;
  const task = await prisma.lmsTask.findUnique({ where: { id }, include: { session: { select: { title: true } }, recording: { select: { session: { select: { title: true } } } }, externalRecording: { select: { title: true } }, submissions: { include: { student: { select: { fullName: true, email: true } } }, orderBy: { submittedAt: "desc" } } } });
  if (!task) notFound();
  const { notice, error } = await searchParams;
  return <section className={`${styles.screen} ${sirahFont.variable}`} data-theme="sirah-classroom">
    <p><Link href="/admin/sirah/classroom/tasks">All tasks</Link></p>
    <header className={styles.intro}><div><h2 className={styles.title}>{task.title}</h2><p className={styles.lede}>{task.session?.title || task.recording?.session.title || task.externalRecording?.title} · {task.publishedAt ? "Published" : "Draft"}</p></div></header>
    {notice && <p className={styles.flash} role="status">{notice}</p>}{error && <p className={styles.flashError} role="alert">{error}</p>}
    <section className={styles.card}><h3 className={styles.cardTitle}>Edit task</h3><form action={updateTask} className={styles.inlineForm}>
      <input type="hidden" name="id" value={task.id} />
      <label className={styles.field}>Title<input className={styles.input} name="title" defaultValue={task.title} required maxLength={191} /></label>
      <TaskEditor initial={task.body} /><button className={styles.primary}>Save changes</button>
    </form><form action={publishTask}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="publish" value={task.publishedAt ? "0" : "1"} /><button className={styles.secondary}>{task.publishedAt ? "Unpublish task" : "Publish task"}</button></form></section>
    <section className={styles.card}><h3 className={styles.cardTitle}>Submissions ({task.submissions.length})</h3>
      {task.submissions.length ? <ul className={styles.rows}>{task.submissions.map(submission => <li key={submission.id} className={styles.row}><div>
        <strong>{submission.student.fullName}</strong> · {submission.student.email}<p>Submitted <time dateTime={submission.submittedAt.toISOString()}>{submission.submittedAt.toUTCString()}</time></p>
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{submission.answer}</p>{submission.link && <p><a href={submission.link} target="_blank" rel="noopener noreferrer">Open submitted link</a></p>}
      </div></li>)}</ul> : <p>No submissions yet.</p>}
    </section>
  </section>;
}
