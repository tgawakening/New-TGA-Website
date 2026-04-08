import { z } from "zod";
import { PaymentMethod } from "@prisma/client";
import { DEFAULT_PAYMENT_PLAN_TYPE, PAYMENT_PLAN_TYPES } from "@/lib/course-payment";

const countryCodeSchema = z
  .string()
  .trim()
  .length(2, "Country code must be a 2-letter ISO code.")
  .transform((value) => value.toUpperCase());

export const registrationSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name is required."),
    email: z.email("Valid email is required.").transform((value) => value.toLowerCase()),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password is too long."),
    confirmPassword: z.string(),
    phoneCountryCode: z.string().trim().regex(/^\+\d{1,4}$/, "Use country code like +44 or +92."),
    phoneNumber: z.string().trim().regex(/^[0-9]{7,15}$/, "Use digits only with length 7-15."),
    countryCode: countryCodeSchema,
    countryName: z.string().trim().min(2, "Country name is required."),
    timezone: z.string().trim().optional(),
    courseSlug: z.string().trim().default("seerah-course"),
    paymentPlanType: z.enum(PAYMENT_PLAN_TYPES).default(DEFAULT_PAYMENT_PLAN_TYPE),
    paymentMethod: z.nativeEnum(PaymentMethod),
    couponCode: z
      .string()
      .trim()
      .min(3, "Coupon code is too short.")
      .max(32, "Coupon code is too long.")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  })
  .transform((data) => ({
    ...data,
    couponCode: data.couponCode ? data.couponCode.toUpperCase() : undefined,
  }));

export type RegistrationInput = z.infer<typeof registrationSchema>;
export const pendingRegistrationUpdateSchema = z.object({
  registrationId: z.string().trim().min(1, "Registration id is required."),
  fullName: z.string().trim().min(2, "Full name is required."),
  phoneCountryCode: z.string().trim().regex(/^\+\d{1,4}$/, "Use country code like +44 or +92."),
  phoneNumber: z.string().trim().regex(/^[0-9]{7,15}$/, "Use digits only with length 7-15."),
  countryCode: countryCodeSchema,
  countryName: z.string().trim().min(2, "Country name is required."),
  timezone: z.string().trim().optional(),
  courseSlug: z.string().trim().default("seerah-course"),
  paymentPlanType: z.enum(PAYMENT_PLAN_TYPES).default(DEFAULT_PAYMENT_PLAN_TYPE),
  paymentMethod: z.nativeEnum(PaymentMethod),
  couponCode: z
    .string()
    .trim()
    .min(3, "Coupon code is too short.")
    .max(32, "Coupon code is too long.")
    .optional()
    .or(z.literal("")),
}).transform((data) => ({
  ...data,
  couponCode: data.couponCode ? data.couponCode.toUpperCase() : undefined,
}));

export type PendingRegistrationUpdateInput = z.infer<typeof pendingRegistrationUpdateSchema>;

export const loginSchema = z.object({
  email: z.email("Valid email is required.").transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Password is required."),
});

export type LoginInput = z.infer<typeof loginSchema>;

