import { z } from "zod";
import { countries } from "countries-list";
import { normalizeSirahPhone } from "./phone";
const country = z
  .string()
  .length(2)
  .toUpperCase()
  .refine((value) => value in countries, "Choose a valid country.");
export const sirahRegistrationSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(8).max(72).optional(),
    confirmPassword: z.string().optional(),
    phoneCountry: country,
    callingCode: z.string().regex(/^\+\d{1,4}$/),
    phone: z.string().trim().min(5).max(40),
    countryCode: country,
    plan: z.enum(["MONTHLY", "ANNUAL"]),
    requestKey: z.uuid(),
    couponCode: z.string().trim().max(64).optional(),
    method: z
      .enum(["STRIPE", "PAYPAL", "BANK_TRANSFER", "JAZZCASH"])
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.password && value.password !== value.confirmPassword)
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords must match.",
      });
    try {
      normalizeSirahPhone(value.phoneCountry, value.callingCode, value.phone);
    } catch (cause) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message:
          cause instanceof Error ? cause.message : "Invalid phone number.",
      });
    }
  });
export const sirahRepriceSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    couponCode: z.string().trim().max(64).optional(),
    countryCode: country,
    plan: z.enum(["MONTHLY", "ANNUAL"]),
    method: z
      .enum(["STRIPE", "PAYPAL", "BANK_TRANSFER", "JAZZCASH"])
      .nullable(),
  })
  .strict();
export const sirahEvidenceSchema = z
  .object({
    revision: z.coerce.number().int().nonnegative(),
    method: z.enum(["BANK_TRANSFER", "JAZZCASH"]),
    route: z.enum(["UPLOAD", "WHATSAPP"]),
    payerName: z.string().trim().min(2).max(120).optional().or(z.literal("")),
    senderAccount: z.string().trim().min(4).max(80).optional(),
    transactionReference: z.string().trim().max(120).optional(),
    paymentDate: z.string().date().optional().or(z.literal("")),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,3})?$/)
      .optional()
      .or(z.literal("")),
    note: z.string().trim().max(1500).optional(),
  })
  .strict();
export const sirahAdminActionSchema = z
  .object({
    orderId: z.string().min(1),
    revision: z.number().int().nonnegative(),
    action: z.enum([
      "APPROVE",
      "PENDING",
      "REJECT",
      "CANCEL",
      "COMPLETE",
      "REFUND",
      "RETRY_NOTIFICATIONS",
      "RECONCILE_PROVIDER",
      "QUOTE_ANNUAL_REFUND",
    ]),
    unusedEligibleMonths: z.number().int().min(0).max(12).optional(),
    note: z.string().trim().max(1500).optional(),
    verifiedAmount: z
      .string()
      .regex(/^\d+(\.\d{1,3})?$/)
      .optional(),
    currency: z.string().length(3).optional(),
    transactionReference: z.string().trim().max(150).optional(),
    paymentEventId: z.string().max(200).optional(),
    verifiedTransfer: z.boolean().optional(),
    manualMethod: z.enum(["BANK_TRANSFER", "JAZZCASH"]).optional(),
    providerReference: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .max(200)
      .optional(),
    refundReference: z.string().trim().max(150).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.action === "QUOTE_ANNUAL_REFUND" &&
      v.unusedEligibleMonths === undefined
    )
      ctx.addIssue({
        code: "custom",
        path: ["unusedEligibleMonths"],
        message: "Specify the staff-reviewed whole unused eligible months.",
      });
    if (["REFUND"].includes(v.action) && !v.note)
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "A reason is required.",
      });
    if (v.action === "APPROVE" && v.verifiedTransfer !== true)
      ctx.addIssue({
        code: "custom",
        path: ["verifiedTransfer"],
        message: "Confirm that the funds were received.",
      });
  });
