"use client";
import { useState } from "react";
import styles from "./registration.module.css";
function Eye({ visible }: { visible: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {visible && <path d="m3 3 18 18" />}
    </svg>
  );
}
export function PasswordFields({
  errors,
  onEdit,
  onPassword,
}: {
  errors: Record<string, string[]>;
  onEdit: (name: string) => void;
  onPassword: (value: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const strong =
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
  function generate() {
    const alphabet =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#%+-";
    const values = crypto.getRandomValues(new Uint32Array(16));
    const next =
      "Aa7!" +
      Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
    setPassword(next);
    setConfirmation(next);
    onPassword(next);
    onEdit("password");
    onEdit("confirmPassword");
  }
  return (
    <>
      <div className={styles.passwordField}>
        <label htmlFor="sirah-create-password">Create password</label>
        <div className={styles.passwordControl}>
          <input
            id="sirah-create-password"
            name="password"
            aria-label="Create password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              onPassword(event.target.value);
              onEdit("password");
            }}
            aria-invalid={Boolean(errors.password)}
            aria-describedby="sirah-password-hint"
          />
          <button
            type="button"
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            onClick={() => setShow(!show)}
          >
            <Eye visible={show} />
          </button>
        </div>
        <small
          id="sirah-password-hint"
          className={
            password && password.length < 8
              ? styles.fieldError
              : strong
                ? styles.validHint
                : styles.passwordHint
          }
          aria-live="polite"
        >
          {password
            ? password.length < 8
              ? "Weak password · at least 8 characters needed"
              : strong
                ? "Strong password"
                : "Fair password · add length and mixed characters for strength"
            : "At least 8 characters. A longer, mixed password is stronger."}
        </small>
        {password && (
          <meter
            className={styles.strengthMeter}
            min={0}
            max={3}
            value={password.length < 8 ? 1 : strong ? 3 : 2}
            aria-label="Password strength"
          />
        )}
        <button
          type="button"
          className={styles.suggestPassword}
          onClick={generate}
        >
          Suggest a strong password
        </button>
        {errors.password && (
          <small className={styles.fieldError} role="alert">
            {errors.password.join(" ")}
          </small>
        )}
      </div>
      <div className={styles.passwordField}>
        <label htmlFor="sirah-confirm-password">Confirm password</label>
        <div className={styles.passwordControl}>
          <input
            id="sirah-confirm-password"
            name="confirmPassword"
            aria-label="Confirm password"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              onEdit("confirmPassword");
            }}
            aria-invalid={
              Boolean(errors.confirmPassword) ||
              Boolean(confirmation && password !== confirmation)
            }
            aria-describedby="sirah-confirm-hint"
          />
          <button
            type="button"
            aria-label={
              showConfirm
                ? "Hide confirmation password"
                : "Show confirmation password"
            }
            aria-pressed={showConfirm}
            onClick={() => setShowConfirm(!showConfirm)}
          >
            <Eye visible={showConfirm} />
          </button>
        </div>
        <small
          id="sirah-confirm-hint"
          aria-live="polite"
          className={
            confirmation && password === confirmation
              ? styles.validHint
              : confirmation
                ? styles.fieldError
                : styles.passwordHint
          }
        >
          {confirmation
            ? password === confirmation
              ? "Passwords match"
              : "Passwords do not match"
            : "Enter your password again."}
        </small>
        {errors.confirmPassword && (
          <small className={styles.fieldError} role="alert">
            {errors.confirmPassword.join(" ")}
          </small>
        )}
      </div>
    </>
  );
}
