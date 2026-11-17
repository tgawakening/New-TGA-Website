"use client";

import type { ReactNode } from "react";
import type { MissionPurpose } from "@/lib/mission-support";
import { gbp, useGiving } from "./giving-state";
import s from "./support.module.css";

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" className={s.icon} aria-hidden="true">
      <path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Moves to the form (live: scrollToGiving), optionally setting a preference or monthly. */
export function GiveButton({ purpose, monthly, variant = "teal", children }: { purpose?: MissionPurpose; monthly?: boolean; variant?: "teal" | "ghost"; children: ReactNode }) {
  const { scrollToGiving } = useGiving();
  return (
    <button type="button" className={variant === "teal" ? s.btnTeal : s.btnGhost} onClick={() => scrollToGiving(purpose, monthly)}>
      <span>{children}</span>
      <Arrow />
    </button>
  );
}

/** A funding area's own button: shows when it is the chosen preference. */
export function CausePick({ id }: { id: MissionPurpose }) {
  const { purpose, scrollToGiving } = useGiving();
  const on = purpose === id;
  return (
    <button type="button" className={s.causePick} aria-pressed={on} onClick={() => scrollToGiving(id)}>
      <span>{on ? "Preference selected" : "Support this area"}</span>
      <Arrow />
    </button>
  );
}

/** Marks the chosen area's card. A wrapper, so the card's reveal class is never overwritten. */
export function CauseMark({ id, children }: { id: MissionPurpose; children: ReactNode }) {
  const { purpose } = useGiving();
  return (
    <div className={s.causeInner} data-on={purpose === id ? "" : undefined}>
      {children}
    </div>
  );
}

/** Back from checkout: the live confirmation band. */
export function ReturnStatus() {
  const { confirmationMessage, receipt, managementToken, manageSupport, loading, error } = useGiving();
  if (!confirmationMessage && !managementToken) return null;
  return (
    <section className={s.returnBand} aria-label="Your contribution">
      <div className={s.wrap}>
        {confirmationMessage && <p role="status">{confirmationMessage}</p>}
        {receipt && <p><strong>{gbp(receipt.amountGbp)}</strong> · {receipt.purpose} · {receipt.frequency === "MONTHLY" ? "Monthly" : "One-time"} · Reference {receipt.reference}</p>}
        {managementToken && <button type="button" className={s.btnTeal} onClick={() => void manageSupport()} disabled={loading}><span>Manage monthly support</span><Arrow /></button>}
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
}

/** Phone bar once the form has scrolled away (live: ms-mobile-action). */
export function StickyGive() {
  const { stickyVisible, formattedAmount, frequency, scrollToGiving } = useGiving();
  return (
    <div className={s.sticky} data-on={stickyVisible ? "" : undefined} aria-hidden={stickyVisible ? undefined : true} inert={!stickyVisible}>
      <span className={s.stickyAmount}>
        {formattedAmount}
        <small>{frequency === "MONTHLY" ? "Monthly support" : "One-time support"}</small>
      </span>
      <button type="button" className={s.btnTeal} onClick={() => scrollToGiving()}>
        <span>Make a contribution</span>
        <Arrow />
      </button>
    </div>
  );
}
