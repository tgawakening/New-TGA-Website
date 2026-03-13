import { z } from "zod";

export const pricingRequestSchema = z.object({
  courseSlug: z.string().trim().default("seerah-course"),
  countryCode: z
    .string()
    .trim()
    .length(2, "Country code must be a 2-letter ISO code.")
    .transform((value) => value.toUpperCase()),
  couponCode: z
    .string()
    .trim()
    .min(3, "Coupon code is too short.")
    .max(32, "Coupon code is too long.")
    .optional()
    .or(z.literal("")),
});

export type PricingRequestInput = z.infer<typeof pricingRequestSchema>;
