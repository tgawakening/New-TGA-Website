"use client";
import { useId, useState } from "react";
import type { CheckoutSummaryData } from "@/components/sirah/registration-form";
import { SealMark } from "../ornaments";
import s from "./order-summary.module.css";

/** The checkout's trust anchor. Presentational: every value comes from the
 * registration form's own state, and a line with no value is left out.
 * Desktop shows it in full; below 1024px it folds into a one-line bar. */
export function OrderSummary({ summary }: { summary: CheckoutSummaryData }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <aside
      className={s.panel}
      aria-label="Order summary"
      data-open={open}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className={s.toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
      >
        <span className={s.toggleLabel}>
          {open ? "Hide summary" : "Show summary"}
          <svg viewBox="0 0 24 24" className={s.chevron} aria-hidden="true" focusable="false">
            <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <strong className={s.togglePrice} data-state={summary.priceState}>
          {summary.priceText}
        </strong>
      </button>

      <div id={bodyId} className={s.body}>
        <SealMark className={s.seal} />
        <p className={s.kicker}>You&apos;re enrolling in</p>
        <p className={s.course}>{summary.courseTitle}</p>

        <dl className={s.lines}>
          <div>
            <dt>Plan</dt>
            <dd>{summary.planLabel}</dd>
          </div>
          {summary.firstClass && (
            <div>
              <dt>First class</dt>
              <dd>{summary.firstClass}</dd>
            </div>
          )}
          {summary.discountLabel && (
            <div>
              <dt>Discount</dt>
              <dd>{summary.discountLabel}</dd>
            </div>
          )}
        </dl>

        <div className={s.price} data-state={summary.priceState}>
          <span className={s.priceLabel}>Your fee</span>
          {summary.originalPriceText && <s>{summary.originalPriceText}</s>}
          {summary.priceText && <strong>{summary.priceText}</strong>}
          <span className={s.priceNote}>{summary.priceNote}</span>
        </div>

        <p className={s.reassure}>
          {summary.refundThrough
            ? `Course-start full-refund protection through ${summary.refundThrough} inclusive (Pakistan date). Statutory rights remain unchanged.`
            : "You can read the full refund and cancellation terms before you pay."}
        </p>

        <p className={s.secure}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span>
            <strong>Secure payment</strong>
            {summary.manualPayment
              ? "Your receipt and transfer details are private."
              : "Card details are entered on our payment provider’s secure page, never on this form."}
          </span>
        </p>
      </div>
    </aside>
  );
}
