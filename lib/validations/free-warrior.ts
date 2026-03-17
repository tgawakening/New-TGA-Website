import { z } from "zod";

export const freeWarriorApplicationSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required."),
  email: z.email("Valid email is required.").transform((value) => value.toLowerCase()),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\+\d{7,15}$/, "Use WhatsApp number with country code, for example +923001234567."),
  age: z.coerce.number().int().min(10).max(120),
  cityCountry: z.string().trim().min(3, "City and country are required."),
  occupation: z.string().trim().min(2, "Occupation is required."),
  knowledgeLevel: z.string().trim().min(2, "Knowledge level is required."),
  previousSeerahStudy: z.string().trim().optional().or(z.literal("")),
  currentInvolvement: z.string().trim().optional().or(z.literal("")),
  whatDrawsYou: z.string().trim().min(1, "Please share what draws you to this course."),
  howItBenefits: z.string().trim().min(1, "Please explain how this course will benefit you."),
  mostInterestingTopic: z.string().trim().min(2, "Please select or write a topic."),
  whyThisTopic: z.string().trim().min(1, "Please explain why this topic matters to you."),
  canAttendRegularly: z.string().trim().min(2, "Please tell us about your commitment."),
  attendedOrientation: z.boolean(),
  reasonForWaiver: z.string().trim().min(1, "Please explain your fee waiver need."),
  howHeard: z.string().trim().optional().or(z.literal("")),
  adabCommitment: z.literal(true, "You must commit to adab and etiquette."),
  genuineFinancialNeed: z.literal(true, "Please confirm genuine financial need."),
  courseSlug: z.string().trim().default("seerah-course"),
  courseTitle: z.string().trim().default("Prophetic Strategies (Seerah)"),
  listedPrice: z.string().trim().default("£20/mo"),
});

export type FreeWarriorApplicationInput = z.infer<typeof freeWarriorApplicationSchema>;

export const freeWarriorReviewSchema = z.object({
  applicationId: z.string().trim().min(1),
  approve: z.boolean(),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type FreeWarriorReviewInput = z.infer<typeof freeWarriorReviewSchema>;
