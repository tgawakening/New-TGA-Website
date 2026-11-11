"use client";
import { useState } from "react";
import styles from "./registration.module.css";
export function PersonalDiscount({ country, plan, method, applied, disabled, onApply }: {
  email?: string; country: string; plan: string; method: string; applied: boolean; disabled?: boolean; onApply: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  // Always available on PK monthly — never hidden behind an email pre-check.
  // Validation happens server-side when the code is applied.
  if (country !== "PK" || plan !== "MONTHLY") return null;
  const manual = method === "BANK_TRANSFER" || method === "JAZZCASH";
  return <div className={styles.notice}>
    <label>Discount code<input name="couponCode" autoComplete="off" maxLength={64} value={code} onChange={event => setCode(event.target.value)} /></label>
    <button type="button" disabled={disabled || !manual || !code.trim() || applied} onClick={() => onApply(code.trim().toUpperCase())}>{applied ? "Discount applied" : "Apply code"}</button>
    <small>{applied ? "Your discounted monthly fee is shown above." : "Have a discount code? Enter it and choose JazzCash or Meezan Bank to apply it."}</small>
  </div>;
}
