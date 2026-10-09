import { PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { missionPurposeIds } from "@/lib/mission-support";

const amountSchema = z
  .number()
  .finite()
  .min(1, "Amount must be at least £1.")
  .max(10000, "Amount is too large.")
  .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, "Use no more than two decimal places.");

export const missionSupportStripeCheckoutSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.string().trim().email("Please enter a valid email.").max(254),
  amountGbp: amountSchema,
  frequency: z.enum(["ONE_TIME", "MONTHLY"]),
  purpose: z.enum(missionPurposeIds),
  requestId: z.uuid(),
});

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
