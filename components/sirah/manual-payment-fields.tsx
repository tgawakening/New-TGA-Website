"use client";
import { useState } from "react";
import { SIRAH_RECEIPT_ACCEPT, sirahReceiptSelectionError } from "@/lib/sirah/receipt-upload";
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
        Payment receipt (JPG, PNG, WebP or PDF)
        <input
          type="file"
          name="receipt"
          accept={SIRAH_RECEIPT_ACCEPT}
          required
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            const problem = file ? sirahReceiptSelectionError(file) : "";
            setReceiptError(problem);
            if (problem) event.currentTarget.value = "";
          }}
        />
        <small>Images up to 20 MB are resized automatically. PDFs: up to 4 MB. Keep the amount and transaction reference readable.</small>
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
