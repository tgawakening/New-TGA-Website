import { z } from "zod";
import { sirahEvidenceSchema, sirahRegistrationSchema } from "./validation";

export const sirahManualSenderSchema = z
  .object({
    payerName: z.string().trim().min(2, "Enter the sender’s name.").max(120),
    senderAccount: z
      .string()
      .trim()
      .min(4, "Enter the sender’s account or wallet number.")
      .max(80),
    transactionReference: z
      .string()
      .trim()
      .min(2, "Enter the bank or wallet transaction reference.")
      .max(120),
    paymentDate: z.string().date("Choose the transfer date."),
    note: z.string().trim().max(1500).optional(),
  })
  .strict();

/** New public registrations always declare a server-eligible payment method. */
export const sirahPaymentRegistrationSchema = sirahRegistrationSchema
  .safeExtend({
    method: z.enum(["STRIPE", "PAYPAL", "BANK_TRANSFER", "JAZZCASH"], {
      error: "Choose an available payment method.",
    }),
    acceptedTermsVersion: z
      .string()
      .trim()
      .min(1, "Accept the payment and access terms."),
    earlyServiceRequested: z.boolean().optional(),
    digitalContentConsented: z.boolean().optional(),
    manualPayment: sirahManualSenderSchema.optional(),
    manualAmountConfirmed: z.boolean().optional(),
    residenceConfirmed: z.literal(true),
  })
  .superRefine((value, ctx) => {
    const manual = ["BANK_TRANSFER", "JAZZCASH"].includes(value.method);
    if (manual && !value.manualPayment)
      ctx.addIssue({
        code: "custom",
        path: ["manualPayment"],
        message: "Enter your transfer details and upload its receipt.",
      });
    if (manual && value.manualAmountConfirmed !== true)
      ctx.addIssue({
        code: "custom",
        path: ["manualAmountConfirmed"],
        message: "Confirm the manual payment amount.",
      });
    if (!manual && value.manualPayment)
      ctx.addIssue({
        code: "custom",
        path: ["manualPayment"],
        message: "Transfer evidence is only used for a manual payment.",
      });
  });

/** Existing saved registrations must provide the same complete manual evidence. */
export const sirahRequiredEvidenceSchema = sirahEvidenceSchema.extend({
  route: z.literal("UPLOAD"),
  ...sirahManualSenderSchema.shape,
});
export const MAX_SIRAH_RECEIPT_BYTES = 4 * 1024 * 1024;
