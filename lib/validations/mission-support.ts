import { PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { missionPurposeIds } from "@/lib/mission-support";
import { allowsManualDonation, donationCountry } from "@/lib/mission-payment-options";

const donorContact = {
  countryCode: z.string().length(2).refine(code => Boolean(donationCountry(code)), "Choose a country."),
  phoneCountryCode: z.string().regex(/^\+\d{1,4}$/),
  phoneNumber: z.string().trim().regex(/^[0-9 ()-]{6,20}$/, "Enter a valid phone number.").refine(value => { const length = value.replace(/\D/g, "").length; return length >= 6 && length <= 15; }, "Enter 6 to 15 phone digits."),
};

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
  // Optional for compatibility with existing Stripe callers; the new form requires them.
  countryCode: donorContact.countryCode.optional(),
  phoneCountryCode: donorContact.phoneCountryCode.optional(),
  phoneNumber: donorContact.phoneNumber.optional(),
});

export const missionSupportPaymentSchema = missionSupportStripeCheckoutSchema.extend({
  ...donorContact,
  amountGbp: amountSchema.optional(),
  paymentMethod: z.enum(["STRIPE", "PAYPAL", "BANK_TRANSFER", "JAZZCASH"]),
  manualAmountPkr: z.number().finite().min(1).max(10000000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < .000001).optional(),
  senderName: z.string().trim().min(2).max(120).optional(),
  referenceKey: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
}).superRefine((input, ctx) => {
  if (["STRIPE", "PAYPAL"].includes(input.paymentMethod) && input.amountGbp === undefined) ctx.addIssue({ code: "custom", path: ["amountGbp"], message: "Enter your contribution amount." });
  if (donationCountry(input.countryCode)?.dialCode !== input.phoneCountryCode) ctx.addIssue({ code: "custom", path: ["phoneCountryCode"], message: "Country and calling code must match." });
  if (input.paymentMethod === "PAYPAL" && input.frequency !== "ONE_TIME") ctx.addIssue({ code: "custom", path: ["frequency"], message: "PayPal donations are one-time. Use Stripe for automatic monthly giving." });
  if (["BANK_TRANSFER", "JAZZCASH"].includes(input.paymentMethod)) {
    if (!allowsManualDonation(input.countryCode, input.phoneCountryCode)) ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Manual payment is available for Pakistan (+92) only." });
    if (!input.senderName || !input.referenceKey || !input.manualAmountPkr) ctx.addIssue({ code: "custom", path: ["referenceKey"], message: "Enter the transfer amount, sender name and transaction reference." });
  }
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
