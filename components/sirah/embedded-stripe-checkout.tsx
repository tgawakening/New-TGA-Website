"use client";

import { useEffect, useRef, useState } from "react";
import type { StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js/pure";

export function EmbeddedStripeCheckout({
  publishableKey,
  clientSecret,
  onComplete,
}: {
  publishableKey: string;
  clientSecret: string;
  onComplete: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let active = true;
    let checkout: StripeEmbeddedCheckout | undefined;
    async function mount() {
      try {
        const stripe = await loadStripe(publishableKey);
        if (!active) return;
        if (!stripe) throw new Error("Stripe did not load.");
        const instance = await stripe.initEmbeddedCheckout({
          clientSecret,
          onComplete: () => {
            if (active) onComplete();
          },
        });
        if (!active || !container.current) {
          instance.destroy();
          return;
        }
        checkout = instance;
        instance.mount(container.current);
        setStatus("ready");
      } catch {
        if (active) setStatus("failed");
      }
    }
    void mount();
    return () => {
      active = false;
      checkout?.destroy();
    };
  }, [publishableKey, clientSecret, onComplete]);

  return (
    <>
      {status === "loading" && <p role="status">Loading secure card form…</p>}
      {status === "failed" && (
        <p role="alert">The secure card form did not load. Reload this page and resume your payment.</p>
      )}
      <div ref={container} />
    </>
  );
}
