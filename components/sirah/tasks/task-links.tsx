import Link from "next/link";
import s from "./tasks.module.css";

export type TaskLink = { id: string; title: string; submitted: boolean };
export function TaskLinks({ tasks }: { tasks?: TaskLink[] }) {
  if (!tasks?.length) return null;
  return <div className={s.taskLinks} aria-label="Class tasks">{tasks.map(task => <Link className={s.taskLink} key={task.id} href={`/seerah/classroom/tasks/${encodeURIComponent(task.id)}`}><span className={s.taskTitle}>{task.title}</span><span className={task.submitted ? s.statusSubmitted : s.statusPending}>{task.submitted ? "Submitted" : "Not submitted"}</span><span className={s.taskOpen}>Open task</span></Link>)}</div>;
}
