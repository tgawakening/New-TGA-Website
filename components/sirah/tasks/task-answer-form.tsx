"use client";
import { useActionState, useState } from "react";
import { submitTaskAnswer } from "@/app/seerah/classroom/tasks/actions";
import s from "@/components/indigo/classroom/classroom.module.css";
import t from "./tasks.module.css";

export function TaskAnswerForm({ taskId, initialAnswer, initialLink, initialSubmittedAt }: { taskId: string; initialAnswer: string; initialLink: string; initialSubmittedAt: string | null }) {
  const [state, action, pending] = useActionState(submitTaskAnswer, {});
  const [answer, setAnswer] = useState(initialAnswer);
  const [link, setLink] = useState(initialLink);
  const submittedAt = state.submittedAt || initialSubmittedAt;
  return <>
    {state.error && <p role="alert">{state.error}</p>}
    {state.submittedAt && <p role="status">Your answer was submitted.</p>}
    <p>{submittedAt ? <>Status: Submitted · <time dateTime={submittedAt}>{new Date(submittedAt).toUTCString()}</time></> : "Status: Not submitted"}</p>
    <form action={action} className={t.studentForm} aria-busy={pending}><input type="hidden" name="taskId" value={taskId} />
      <label>Your answer<textarea className={t.answer} name="answer" required maxLength={50000} value={answer} onChange={e => setAnswer(e.target.value)} /></label>
      <label>Link (optional)<input type="url" name="link" maxLength={1024} placeholder="https://..." value={link} onChange={e => setLink(e.target.value)} /></label>
      <button type="submit" className={s.btnTeal} disabled={pending}>{pending ? "Submitting…" : submittedAt ? "Update submission" : "Submit answer"}</button>
    </form>
  </>;
}
