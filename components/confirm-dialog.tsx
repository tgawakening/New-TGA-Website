"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import styles from "./confirm-dialog.module.css";

/**
 * Branded replacement for the browser's native confirm and prompt dialogs, site-wide.
 *
 *   if (!(await confirmDialog({ title, message, tone: "danger" }))) return;
 *   const reason = await promptDialog({ title, label });  // null = cancelled
 *
 * One <ConfirmDialogHost /> is mounted in app/layout.tsx. It renders a native
 * modal <dialog> (focus trapped, Escape cancels, focus returns to the button
 * that opened it). The promise resolves to true / the entered text ONLY when
 * the Confirm button is pressed; Cancel, Escape, the backdrop and a missing
 * host all resolve to false / null, so nothing can run without an explicit
 * confirm. Light on the admin, brand navy on the public site.
 */

type Tone = "danger" | "default";
type Request = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
  /** prompt mode: a required text answer */
  input?: { label: string; placeholder?: string; multiline?: boolean };
  resolve: (value: string | null) => void;
};

let openRequest: ((request: Request) => void) | null = null;

function ask(request: Omit<Request, "resolve">) {
  return new Promise<string | null>((resolve) => {
    if (!openRequest) return resolve(null); // no host: never confirm by default
    openRequest({ ...request, resolve });
  });
}

export async function confirmDialog(options: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}) {
  return (await ask(options)) !== null;
}

export function promptDialog(options: {
  title: string;
  message?: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}) {
  const { label, placeholder, multiline, ...rest } = options;
  return ask({ ...rest, input: { label, placeholder, multiline } });
}

export function ConfirmDialogHost({ className = "" }: { className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [request, setRequest] = useState<Request | null>(null);
  const [value, setValue] = useState("");
  const [light, setLight] = useState(false);
  const titleId = useId();
  const messageId = useId();
  const inputId = useId();

  useEffect(() => {
    openRequest = (next) => {
      // A second request while one is open cancels the first (never confirms it).
      setRequest((current) => {
        current?.resolve(null);
        return next;
      });
      setValue("");
      setLight(!!document.querySelector('[data-theme="indigo-admin"]'));
    };
    return () => {
      openRequest = null;
    };
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (request && element && !element.open) element.showModal();
  }, [request]);

  function finish(result: string | null) {
    request?.resolve(result);
    setRequest(null);
    if (dialog.current?.open) dialog.current.close();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!request) return;
    if (request.input) {
      const answer = value.trim();
      if (!answer) return;
      finish(answer);
    } else finish("");
  }

  const danger = request?.tone === "danger";
  const answerMissing = !!request?.input && !value.trim();
  return (
    <dialog
      ref={dialog}
      className={`${styles.dialog} ${light ? styles.light : styles.dark} ${className}`}
      aria-labelledby={titleId}
      aria-describedby={request?.message ? messageId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        finish(null);
      }}
      onClick={(event) => {
        // A click on the backdrop (the dialog box itself, outside the panel) cancels.
        if (event.target === event.currentTarget) finish(null);
      }}
    >
      {request && (
        <form className={styles.panel} onSubmit={submit}>
          <h2 id={titleId} className={styles.title}>
            {request.title}
          </h2>
          {request.message && (
            <p id={messageId} className={styles.message}>
              {request.message}
            </p>
          )}
          {request.input && (
            <label className={styles.field} htmlFor={inputId}>
              {request.input.label}
              {request.input.multiline ? (
                <textarea
                  id={inputId}
                  className={styles.input}
                  rows={3}
                  maxLength={1000}
                  required
                  autoFocus
                  placeholder={request.input.placeholder}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              ) : (
                <input
                  id={inputId}
                  className={styles.input}
                  required
                  autoFocus
                  maxLength={1000}
                  placeholder={request.input.placeholder}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              )}
            </label>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancel}
              // Destructive questions start on the safe choice.
              autoFocus={!request.input}
              onClick={() => finish(null)}
            >
              {request.cancelLabel || "Cancel"}
            </button>
            <button
              type="submit"
              className={danger ? styles.danger : styles.confirm}
              disabled={answerMissing}
            >
              {request.confirmLabel || "Confirm"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
