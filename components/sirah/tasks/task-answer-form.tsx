"use client";
import { useActionState, useState } from "react";
import { submitTaskAnswer } from "@/app/seerah/classroom/tasks/actions";
import s from "@/components/indigo/classroom/classroom.module.css";
import t from "./tasks.module.css";
import { DirectUpload } from "../uploads/direct-upload";

export function TaskAnswerForm({ taskId, initialAnswer, initialLink, initialSubmittedAt, attachments }: { taskId: string; initialAnswer: string; initialLink: string; initialSubmittedAt: string | null; attachments: { id: string; filename: string }[] }) {
  const [state, action, pending] = useActionState(submitTaskAnswer, {});
  const [answer, setAnswer] = useState(initialAnswer);
  const [link, setLink] = useState(initialLink);
  const submittedAt = state.submittedAt || initialSubmittedAt;
  return <>
    {state.error && <p role="alert">{state.error}</p>}
    {state.submittedAt && <p role="status">Your answer was submitted.</p>}
    <div className={t.submissionStatus}><span className={submittedAt ? t.statusSubmitted : t.statusPending}>{submittedAt ? "Submitted" : "Not submitted"}</span>{submittedAt && <time dateTime={submittedAt}>{new Date(submittedAt).toUTCString()}</time>}</div>
    <form action={action} className={t.studentForm} aria-busy={pending}><h2>Your submission</h2><input type="hidden" name="taskId" value={taskId} />
      <label>Your answer<textarea className={t.answer} name="answer" required maxLength={50000} value={answer} onChange={e => setAnswer(e.target.value)} /></label>
      <label>Link (optional)<input type="url" name="link" maxLength={1024} placeholder="https://..." value={link} onChange={e => setLink(e.target.value)} /></label>
      {attachments.length > 0 && <div><strong>Attached files</strong><ul>{attachments.map(file => <li key={file.id}><a href={`/api/sirah/tasks/attachments/${encodeURIComponent(file.id)}`}>{file.filename}</a></li>)}</ul></div>}
      <DirectUpload key={state.submittedAt || "initial"} purpose="task" scope={taskId} name="attachmentToken" multiple />
      <button type="submit" className={s.btnTeal} disabled={pending}>{pending ? "Submitting…" : submittedAt ? "Update submission" : "Submit answer"}</button>
    </form>
  </>;
}
