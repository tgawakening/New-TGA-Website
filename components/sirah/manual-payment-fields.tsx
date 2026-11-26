"use client";
import { useState } from "react";
import { DirectUpload } from "./uploads/direct-upload";
import { useRegistrationStyles } from "./registration-styles";

/** Shared by initial submission and a saved registration's receipt correction. */
export function ManualPaymentFields({
  payerName = "",
  amount,
  errors = {},
  orderId,
  onScope,
}: {
  payerName?: string;
  amount: string;
  errors?: Record<string, string[]>;
  orderId?: string;
  onScope?: (scope: string) => void;
}) {
  const styles = useRegistrationStyles();
  const [scope] = useState(() => orderId || crypto.randomUUID());
  const error = (key: string) =>
    errors[key]?.[0] ? (
      <small className={styles.fieldError} role="alert">
        {errors[key][0]}
      </small>
    ) : null;
  return (
    <div className={styles.manualFields}>
      <div>
        <span>Payment receipt (JPG, PNG, WebP or PDF)</span>
        {scope && <DirectUpload purpose={orderId ? "evidence" : "registration"} scope={scope} name="receiptToken" required={Boolean(orderId)} onScope={onScope} />}
        <small>Keep the amount and transaction reference readable.</small>
        {error("receipt")}
      </div>
      <div className={styles.grid}>
        <label>
          Sender name
          <input
            name="payerName"
            defaultValue={payerName}
            required
            minLength={2}
            maxLength={120}
            autoComplete="off"
          />
          {error("payerName")}
        </label>
        <label>
          Sender account / wallet number
          <input
            name="senderAccount"
            required
            minLength={4}
            maxLength={80}
            autoComplete="off"
          />
          {error("senderAccount")}
        </label>
        <label>
          Transaction reference
          <input
            name="transactionReference"
            required
            minLength={2}
            maxLength={120}
            autoComplete="off"
          />
          {error("transactionReference")}
        </label>
        <label>
          Transfer date
          <input type="date" name="paymentDate" required />
          {error("paymentDate")}
        </label>
      </div>
      <label>
        Amount due
        <input name="amount" value={amount} readOnly />
      </label>
      <small>
        Your receipt and transfer details are private. Enrolment follows TGA’s
        verification of received funds.
      </small>
    </div>
  );
}
