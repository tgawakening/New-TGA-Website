"use client";
import { useState } from "react";
import styles from "./registration.module.css";
export function PersonalDiscount({ country, plan, method, applied, disabled, onApply }: {
  email?: string; country: string; plan: string; method: string; applied: boolean; disabled?: boolean; onApply: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  // Never hidden behind an email pre-check; validation happens server-side.
  // Pakistan monthly: bank transfer / JazzCash codes (original) or card codes.
  // Every other market: card codes, applied to the Stripe checkout.
  const pkMonthly = country === "PK" && plan === "MONTHLY";
  const manual = pkMonthly && (method === "BANK_TRANSFER" || method === "JAZZCASH");
  const card = method === "STRIPE";
  // Outside PK monthly, show the box only once card checkout is the selected
  // route (Stripe is preselected wherever it is offered).
  if (!country || !(pkMonthly || card)) return null;
  return <div className={styles.notice}>
    <label>Discount code<input name="couponCode" autoComplete="off" maxLength={64} value={code} onChange={event => setCode(event.target.value)} /></label>
    <button type="button" disabled={disabled || !(manual || card) || !code.trim() || applied} onClick={() => onApply(code.trim().toUpperCase())}>{applied ? "Discount applied" : "Apply code"}</button>
    <small>{applied
      ? plan === "ANNUAL" ? "Your discounted price is shown above." : "Your discounted monthly fee is shown above."
      : pkMonthly && !card
        ? "Have a discount code? Enter it and choose JazzCash or Meezan Bank to apply it."
        : "Have a discount code? Choose card payment, then enter it to apply."}</small>
  </div>;
}
