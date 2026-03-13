import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const paymentInitSchema = z.object({
  registrationId: z.string().min(1, "Registration id is required."),
});

export const manualPaymentSubmitSchema = z.object({
  registrationId: z.string().min(1, "Registration id is required."),
  method: z.enum([PaymentMethod.BANK_TRANSFER, PaymentMethod.NAYAPAY]),
  senderName: z.string().trim().min(2, "Sender name is required."),
  senderNumber: z.string().trim().regex(/^[0-9]{7,15}$/, "Sender number must be 7-15 digits."),
  referenceKey: z.string().trim().min(4, "Reference key is required."),
  notes: z.string().trim().max(500).optional(),
  screenshotUrl: z.string().url().optional(),
});

export const adminConfirmSchema = z.object({
  paymentId: z.string().min(1, "Payment id is required."),
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
});
