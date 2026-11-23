"use client";

import { useState } from "react";
import s from "./login.module.css";

/** A password input with a show/hide toggle inside it (presentation only).
 * Every attribute that reaches the form (name, id, autocomplete, limits) is
 * passed through unchanged, so server actions read the same fields. */
export function PasswordField({
  id,
  name,
  label,
  autoComplete,
  minLength,
  maxLength,
  describedBy,
  help,
  invalid,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
  maxLength?: number;
  describedBy?: string;
  help?: string;
  invalid?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const helpId = help ? `${id}-help` : undefined;
  const described = [helpId, describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <div className={s.field}>
      <label htmlFor={id}>{label}</label>
      <div className={s.passwordWrap}>
        <input
          className={`${s.input} ${s.passwordInput}`}
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          aria-describedby={described}
          aria-invalid={invalid ? true : undefined}
          required
        />
        <button
          type="button"
          className={s.reveal}
          onClick={() => setShown((value) => !value)}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={shown}
          aria-controls={id}
        >
          {shown ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17.9 17.9A10.4 10.4 0 0 1 12 19.5C5 19.5 1.5 12 1.5 12a18.6 18.6 0 0 1 4.6-5.9M9.9 4.7A9.6 9.6 0 0 1 12 4.5c7 0 10.5 7.5 10.5 7.5a18.8 18.8 0 0 1-2.2 3.3M14.1 14.1a3 3 0 1 1-4.2-4.2M1.5 1.5l21 21" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1.5 12S5 4.5 12 4.5 22.5 12 22.5 12 19 19.5 12 19.5 1.5 12 1.5 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {help ? (
        <span id={helpId} className={s.help}>
          {help}
        </span>
      ) : null}
    </div>
  );
}
