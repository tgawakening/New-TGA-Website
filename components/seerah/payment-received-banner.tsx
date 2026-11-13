"use client";
import { useEffect, useState } from "react";
import styles from "./payment-received-banner.module.css";

/**
 * Shown on /seerah?payment=received&reference=… — the return address of an
 * admin custom payment link. Display only: the payment itself is confirmed by
 * the Stripe webhook, which also sends the confirmation email.
 */
export function PaymentReceivedBanner({ reference }: { reference: string | null }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    // One-time confirmation: keep it on screen, but drop it from the address
    // bar so a refresh or a shared link doesn't show it again.
    const url = new URL(window.location.href);
    url.searchParams.delete("payment");
    url.searchParams.delete("reference");
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search + url.hash,
    );
  }, []);
  if (!open) return null;
  return (
    <div className={styles.wrap}>
      <section
        className={styles.banner}
        role="status"
        aria-labelledby="sirah-payment-received-title"
      >
        <span className={styles.mark} aria-hidden="true">
          ✓
        </span>
        <div className={styles.body}>
          <h2 id="sirah-payment-received-title">
            Thank you, your payment has been received
          </h2>
          {reference && (
            <p className={styles.reference}>
              Reference: <strong>{reference}</strong>
            </p>
          )}
          <p>
            We&apos;re confirming it with our payment provider now. This usually
            takes a few minutes. Your course access then activates automatically
            and we&apos;ll email you once your enrolment is confirmed.
          </p>
          <p>
            To see your registration, sign in with the account details the TGA
            team emailed you, or your existing account.
          </p>
          <a
            className={styles.action}
            href={`/login?next=${encodeURIComponent("/seerah/register")}`}
          >
            Sign in to see your registration
          </a>
        </div>
        <button
          type="button"
          className={styles.dismiss}
          aria-label="Dismiss payment confirmation"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </section>
    </div>
  );
}
