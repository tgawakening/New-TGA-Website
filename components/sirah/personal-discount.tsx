"use client";
import { useEffect, useState } from "react";
import styles from "./registration.module.css";
export function PersonalDiscount({ email, country, plan, method, applied, disabled, onApply }: {
  email: string; country: string; plan: string; method: string; applied: boolean; disabled?: boolean; onApply: (code: string) => void;
}) {
  const [eligibleEmail, setEligibleEmail] = useState("");
  const [code, setCode] = useState("");
  const normalized = email.trim().toLowerCase();
  useEffect(() => {
    if (!normalized.includes("@")) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch("/api/sirah/discount-eligibility", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: normalized }), signal: controller.signal })
        .then(r => r.json()).then(data => { if (!controller.signal.aborted) setEligibleEmail(data.eligible ? normalized : ""); }).catch(() => {});
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [normalized]);
  if (eligibleEmail !== normalized || !normalized || country !== "PK" || plan !== "MONTHLY") return null;
  const manual = method === "BANK_TRANSFER" || method === "JAZZCASH";
  return <div className={styles.notice}>
    <label>Discount code<input name="couponCode" autoComplete="off" maxLength={64} value={code} onChange={event => setCode(event.target.value)} /></label>
    <button type="button" disabled={disabled || !manual || !code.trim() || applied} onClick={() => onApply(code.trim().toUpperCase())}>{applied ? "Discount applied" : "Apply code"}</button>
    <small>{applied ? "Your discounted monthly fee is shown above." : manual ? "Your fee updates after the code is verified." : "Choose Meezan Bank or JazzCash to use this code."}</small>
  </div>;
}
