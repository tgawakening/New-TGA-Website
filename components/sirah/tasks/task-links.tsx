import Link from "next/link";
import s from "./tasks.module.css";

export type TaskLink = { id: string; title: string; submitted: boolean };
export function TaskLinks({ tasks }: { tasks?: TaskLink[] }) {
  if (!tasks?.length) return null;
  return <div className={s.taskLinks} aria-label="Class tasks">{tasks.map(task => <Link key={task.id} href={`/seerah/classroom/tasks/${encodeURIComponent(task.id)}`}>{task.title} · {task.submitted ? "Submitted" : "Task"}</Link>)}</div>;
}
