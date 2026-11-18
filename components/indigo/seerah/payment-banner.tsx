"use client";

import { useEffect, useState } from "react";
import { useSiteLinks } from "../site-links-context";
import s from "./seerah.module.css";

/* Same behaviour and copy as components/seerah/payment-received-banner.tsx
 * (live), restyled: shown on ?payment=received&reference=… (the return of an
 * admin custom payment link). Display only, since the Stripe webhook confirms
 * the payment. The query is dropped from the address bar so a refresh or a
 * shared link doesn't show it again. */
export function PaymentBanner({ reference }: { reference: string | null }) {
  const [open, setOpen] = useState(true);
  const site = useSiteLinks();
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("payment");
    url.searchParams.delete("reference");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  if (!open) return null;
  return (
    <div className={s.wrap}>
      <section className={s.paid} role="status" aria-labelledby="sirah-paid-title">
        <span className={s.paidMark} aria-hidden="true">
          ✓
        </span>
        <div>
          <h2 id="sirah-paid-title">Thank you, your payment has been received</h2>
          {reference ? (
            <p className={s.paidRef}>
              Reference: <strong>{reference}</strong>
            </p>
          ) : null}
          <p>
            We&apos;re confirming it with our payment provider now. This usually takes a few minutes. Your course access
            then activates automatically and we&apos;ll email you once your enrolment is confirmed.
          </p>
          <p>To see your registration, sign in with the account details the TGA team emailed you, or your existing account.</p>
          <a className={s.paidAction} href={`/login?next=${encodeURIComponent(site.register)}`}>
            Sign in to see your registration
          </a>
        </div>
        <button type="button" className={s.paidClose} aria-label="Dismiss payment confirmation" onClick={() => setOpen(false)}>
          ×
        </button>
      </section>
    </div>
  );
}
