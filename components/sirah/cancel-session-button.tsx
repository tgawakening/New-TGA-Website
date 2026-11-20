"use client";
import { useRef, type FormEvent } from "react";
import { confirmDialog } from "@/components/confirm-dialog";

/** Cancel a live session: the branded confirm dialog first, then the server
 * action. Only an explicit "Cancel session" press submits the form. */
export function CancelSessionButton({
  action,
  sessionId,
  cohortId,
  title,
  when,
  className,
}: {
  action: (form: FormData) => Promise<void>;
  sessionId: string;
  cohortId: string;
  title: string;
  when: string;
  className?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmed.current) return;
    event.preventDefault();
    const ok = await confirmDialog({
      title: "Cancel this session?",
      message: `"${title}" on ${when} will be cancelled and its Zoom meeting deleted. Students will see it as cancelled. This cannot be undone.`,
      confirmLabel: "Cancel session",
      cancelLabel: "Keep it",
      tone: "danger",
    });
    if (!ok) return;
    confirmed.current = true;
    form.current?.requestSubmit();
  }

  return (
    <form ref={form} action={action} onSubmit={onSubmit}>
      <input type="hidden" name="id" value={sessionId} />
      <input type="hidden" name="cohortId" value={cohortId} />
      <button type="submit" className={className}>
        Cancel session
      </button>
    </form>
  );
}
