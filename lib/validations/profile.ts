import { z } from "zod";

const countryCodeSchema = z
  .string()
  .trim()
  .length(2, "Country code must be a 2-letter ISO code.")
  .transform((value) => value.toUpperCase());

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  phoneCountryCode: z.string().trim().regex(/^\+\d{1,4}$/, "Use country code like +44 or +92."),
  phoneNumber: z.string().trim().regex(/^[0-9]{7,15}$/, "Use digits only with length 7-15."),
  countryCode: countryCodeSchema,
  countryName: z.string().trim().min(2, "Country name is required."),
  timezone: z.string().trim().max(100, "Timezone is too long.").optional().or(z.literal("")),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
