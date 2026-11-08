"use client";
import { useState } from "react";
import { MAX_SIRAH_RECEIPT_BYTES } from "@/lib/sirah/registration-payment";
import styles from "./registration.module.css";

/** Shared by initial submission and a saved registration's receipt correction. */
export function ManualPaymentFields({
  payerName = "",
  amount,
  errors = {},
}: {
  payerName?: string;
  amount: string;
  errors?: Record<string, string[]>;
}) {
  const [receiptError, setReceiptError] = useState("");
  const error = (key: string) =>
    errors[key]?.[0] ? (
      <small className={styles.fieldError} role="alert">
        {errors[key][0]}
      </small>
    ) : null;
  return (
    <div className={styles.manualFields}>
      <label>
        Payment receipt (JPG, PNG or PDF, up to 4 MB)
        <input
          type="file"
          name="receipt"
          accept="image/jpeg,image/png,application/pdf"
          required
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            const problem =
              file &&
              (file.size > MAX_SIRAH_RECEIPT_BYTES ||
                !["image/jpeg", "image/png", "application/pdf"].includes(
                  file.type,
                ))
                ? "Choose a JPG, PNG or PDF receipt up to 4 MB."
                : "";
            setReceiptError(problem);
            if (problem) event.currentTarget.value = "";
          }}
        />
        {receiptError ? (
          <small className={styles.fieldError} role="alert">
            {receiptError}
          </small>
        ) : (
          error("receipt")
        )}
      </label>
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
