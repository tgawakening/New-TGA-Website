"use client";
import { useId } from "react";
import type { SirahMethod } from "@/lib/sirah/catalog";
import styles from "./registration.module.css";

const labels: Record<SirahMethod, { title: string; processor: string }> = {
  STRIPE: { title: "Debit / credit card", processor: "Powered by Stripe" },
  PAYPAL: { title: "PayPal", processor: "Pay securely with PayPal" },
  BANK_TRANSFER: { title: "Bank transfer", processor: "Meezan Bank" },
  JAZZCASH: { title: "JazzCash", processor: "Manual receipt verification" },
};

/** Eligibility comes from the server; these controls never open a payment route. */
export function PaymentMethods({
  methods,
  value,
  onChange,
  disabled,
  describedBy,
  required,
}: {
  methods: SirahMethod[];
  value: SirahMethod | "";
  onChange: (method: SirahMethod) => void;
  disabled?: boolean;
  describedBy?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <fieldset
      className={styles.methodChoices}
      disabled={disabled}
      aria-describedby={describedBy}
    >
      <legend>Payment method</legend>
      <div className={styles.methodTabs}>
        {methods.map((method) => (
          <label
            key={method}
            className={styles.methodTab}
            data-selected={value === method}
          >
            <input
              type="radio"
              required={required}
              name={`payment-method-${id}`}
              value={method}
              checked={value === method}
              onChange={() => onChange(method)}
            />
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              {method === "BANK_TRANSFER" ? (
                <>
                  <path d="m3 9 9-6 9 6H3Zm0 12h18M5 11v7m7-7v7m7-7v7" />
                </>
              ) : method === "JAZZCASH" ? (
                <>
                  <rect x="6" y="2" width="12" height="20" rx="2" />
                  <path d="M10 18h4m-5-8 2 2 4-4" />
                </>
              ) : method === "PAYPAL" ? (
                <>
                  <path d="m6 21 3-18h6c7 0 6 10-1 10H9m2-6h4" />
                </>
              ) : (
                <>
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M2 10h20M5 15h4" />
                </>
              )}
            </svg>
            <span className={styles.methodTitle}>{labels[method].title}</span>
            <span className={styles.methodProcessor}>
              {labels[method].processor}
            </span>
          </label>
        ))}
      </div>
      {!methods.length && (
        <small>
          No verified payment method is available for this selection.
        </small>
      )}
    </fieldset>
  );
}
