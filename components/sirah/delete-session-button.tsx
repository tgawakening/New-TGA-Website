"use client";

export function DeleteSessionButton({ action, id, cohort, title, className }: { action: (form: FormData) => void | Promise<void>; id: string; cohort: string; title: string; className: string }) {
  return (
    <form action={action} onSubmit={(event) => { if (!window.confirm(`Delete “${title}” and its attendance, recordings and linked resources? This cannot be undone.`)) event.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="cohortId" value={cohort} />
      <button type="submit" className={className}>Delete session</button>
    </form>
  );
}
