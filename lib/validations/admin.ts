import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const adminRegistrationActionSchema = z.object({
  registrationId: z.string().min(1),
  action: z.enum(["COMPLETE", "PENDING", "CANCEL"]),
  note: z.string().max(400).optional(),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminRegistrationActionInput = z.infer<typeof adminRegistrationActionSchema>;
