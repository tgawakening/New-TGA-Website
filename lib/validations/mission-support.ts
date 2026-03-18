import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

const amountSchema = z
  .number()
  .min(1, "Amount must be at least £1.")
  .max(10000, "Amount is too large.");

export const missionSupportCheckoutSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  email: z.string().trim().email("Valid email is required."),
  phoneCountryCode: z.string().trim().optional(),
  phoneNumber: z.string().trim().optional(),
  countryName: z.string().trim().optional(),
  amountGbp: amountSchema,
  paymentMethod: z.enum([PaymentMethod.STRIPE, PaymentMethod.PAYPAL, PaymentMethod.BANK_TRANSFER, PaymentMethod.JAZZCASH]),
  donorMessage: z.string().trim().max(500).optional(),
  senderName: z.string().trim().optional(),
  senderNumber: z.string().trim().optional(),
  referenceKey: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const missionSupportPaypalCaptureSchema = z.object({
  donationId: z.string().min(1),
  orderId: z.string().min(1),
});

export const missionSupportAdminStatusSchema = z.object({
  donationId: z.string().min(1),
  action: z.enum(["CONFIRM", "PENDING", "CANCEL"]),
  note: z.string().trim().max(500).optional(),
});

export type MissionSupportCheckoutInput = z.infer<typeof missionSupportCheckoutSchema>;
