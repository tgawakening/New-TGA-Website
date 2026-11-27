import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const paymentInitSchema = z.object({
  registrationId: z.string().min(1, "Registration id is required."),
});

export const manualPaymentSubmitSchema = z.object({
  registrationId: z.string().min(1, "Registration id is required."),
  method: z.enum([PaymentMethod.BANK_TRANSFER, PaymentMethod.JAZZCASH]),
  senderName: z.string().trim().min(2, "Sender name is required."),
  senderNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{7,15}$/, "Sender number must be 7-15 digits.")
    .optional()
    .or(z.literal("")),
  referenceKey: z.string().trim().min(4, "Reference key is required."),
  notes: z.string().trim().max(500).optional(),
  receiptToken: z.string({ error: "Please attach your payment receipt to continue." }).trim().min(1, "Please attach your payment receipt to continue.").max(8192),
});

export const adminConfirmSchema = z.object({
  paymentId: z.string().min(1, "Payment id is required."),
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
});
