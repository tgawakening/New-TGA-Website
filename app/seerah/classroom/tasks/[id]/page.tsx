import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionIdentity } from "@/lib/auth/session";
import { studentTaskDetail } from "@/lib/lms/tasks";
import { TaskBody } from "@/components/sirah/tasks/task-body";
import { TaskAnswerForm } from "@/components/sirah/tasks/task-answer-form";
import { ClassroomHeader } from "@/components/indigo/classroom/parts";
import s from "@/components/indigo/classroom/classroom.module.css";

export const dynamic = "force-dynamic";
export default async function StudentTask({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionIdentity();
  if (!user) redirect("/login");
  const { id } = await params;
  const task = await studentTaskDetail(user.id, id);
  if (!task) notFound();
  const submission = task.submissions[0];
  return <div className={s.page}><ClassroomHeader home="/seerah/classroom" week={null} percent={null} back={{ href: "/seerah/classroom/schedule#recordings", label: "Classes" }} student={{ active: "live" }} />
    <main className={s.wrap}><section className={s.section}><p className={s.eyebrow}>Class task</p><h1>{task.title}</h1>
      <div className={s.card}><TaskBody body={task.body} /></div>
      <TaskAnswerForm taskId={task.id} initialAnswer={submission?.answer || ""} initialLink={submission?.link || ""} initialSubmittedAt={submission?.submittedAt.toISOString() || null} />
      <p><Link href="/seerah/classroom/schedule#recordings">Back to classes and recordings</Link></p>
    </section></main></div>;
}
