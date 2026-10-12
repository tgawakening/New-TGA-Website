import { z } from "zod";
import { donationCountry } from "@/lib/mission-payment-options";

export const divineBondsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform(value => value.toLowerCase()),
  countryCode: z.string().refine(code => !!donationCountry(code), "Choose a valid country."),
  phone: z.string().trim().regex(/^[0-9 ()-]{6,20}$/).refine(value => value.replace(/\D/g, "").length >= 6 && value.replace(/\D/g, "").length <= 15),
  interest: z.enum(["Finding a life partner", "Marriage preparation", "Family support", "Learning more"]),
  reason: z.string().trim().min(10).max(1500),
  consent: z.literal(true),
  website: z.string().max(200).optional(),
}).refine(data => ((donationCountry(data.countryCode)?.dialCode.replace(/\D/g, "") ?? "") + data.phone.replace(/\D/g, "")).length <= 15, { path: ["phone"], message: "Phone number is too long." });
