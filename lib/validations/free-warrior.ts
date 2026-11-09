import { z } from "zod";
import { SIRAH_SCHOLARSHIP_BATCH } from "@/lib/sirah/scholarship";

const response = z.string().trim().min(20, "Please provide a little more detail (at least 20 characters).").max(2000, "Please keep your answer within 2,000 characters.");
export const sirahScholarshipDetailsSchema = z.object({
  seerahReflection: response,
  arabicLevel: z.enum(["STARTING", "FOUNDATIONAL", "INTERMEDIATE", "ADVANCED"]),
  arabicExperience: response,
  deenUnderstanding: response,
  communityContribution: response,
  missionSupport: response,
  skillsResources: response,
  skillsStatus: z.enum(["CURRENT_SKILLS", "LEARNING_REQUIRED"]),
  skillLearningPlan: z.string().trim().max(2000).optional().default(""),
  skillsLearningCommitment: z.literal(true, "Please confirm your commitment to developing useful skills where needed."),
  actionPlan: response,
  weeklyHours: z.coerce.number().min(0.5, "Please indicate your weekly time commitment.").max(80),
  missionCommitment: z.literal(true, "Please confirm your commitment to learning and service."),
  selectionAcknowledgement: z.literal(true, "Please acknowledge the ten-place selection process."),
}).superRefine((value, ctx) => {
  if (value.skillsStatus === "LEARNING_REQUIRED" && value.skillLearningPlan.length < 20) {
    ctx.addIssue({ code: "custom", path: ["skillLearningPlan"], message: "Please describe a useful skill you will start learning and your first step (at least 20 characters)." });
  }
});
export type SirahScholarshipDetails = z.infer<typeof sirahScholarshipDetailsSchema>;


export const freeWarriorApplicationSchema = z
  .object({
    scholarshipBatch: z.literal(SIRAH_SCHOLARSHIP_BATCH),
    scholarshipDetails: sirahScholarshipDetailsSchema,
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
    previousSeerahStudy: response,
    currentInvolvement: z.string().trim().optional().or(z.literal("")),
    whatDrawsYou: z.string().trim().min(1, "Please share what draws you to this course."),
    howItBenefits: z.string().trim().min(1, "Please explain how this course will benefit you."),
    mostInterestingTopic: z.string().trim().min(2, "Please select or write a topic."),
    whyThisTopic: z.string().trim().min(1, "Please explain why this topic matters to you."),
    canAttendRegularly: z.string().trim().min(2, "Please tell us about your commitment."),
    attendedOrientation: z.boolean(),
    contributionPreference: z.enum(["FULL_SCHOLARSHIP", "PARTIAL_CONTRIBUTION"]),
    monthlyContributionPkr: z.enum(["500", "1000"]).optional().or(z.literal("")),
    manualSenderName: z.string().trim().optional().or(z.literal("")),
    manualSenderNumber: z.string().trim().optional().or(z.literal("")),
    manualReferenceKey: z.string().trim().optional().or(z.literal("")),
    manualNotes: z.string().trim().optional().or(z.literal("")),
    reasonForWaiver: z.string().trim().min(1, "Please explain your fee waiver need."),
    howHeard: z.string().trim().optional().or(z.literal("")),
    adabCommitment: z.literal(true, "You must commit to adab and etiquette."),
    genuineFinancialNeed: z.literal(true, "Please confirm genuine financial need."),
    courseSlug: z.string().trim().default("seerah-course"),
    courseTitle: z.string().trim().default("Prophetic Strategies (Seerah)"),
    listedPrice: z.string().trim().default("GBP 20/mo"),
  })
  .superRefine((value, ctx) => {
    if (value.contributionPreference === "PARTIAL_CONTRIBUTION" && !value.monthlyContributionPkr) {
      ctx.addIssue({
        code: "custom",
        path: ["monthlyContributionPkr"],
        message: "Please choose how much you are willing to pay monthly.",
      });
    }

    if (value.contributionPreference === "FULL_SCHOLARSHIP" && value.monthlyContributionPkr) {
      ctx.addIssue({
        code: "custom",
        path: ["monthlyContributionPkr"],
        message: "Monthly contribution should only be selected when partial payment is chosen.",
      });
    }

    if (value.contributionPreference === "PARTIAL_CONTRIBUTION" && !value.manualSenderName) {
      ctx.addIssue({
        code: "custom",
        path: ["manualSenderName"],
        message: "Please provide sender name for payment verification.",
      });
    }

    if (value.contributionPreference === "PARTIAL_CONTRIBUTION" && !value.manualSenderNumber) {
      ctx.addIssue({
        code: "custom",
        path: ["manualSenderNumber"],
        message: "Please provide sender number for payment verification.",
      });
    }

    if (value.contributionPreference === "PARTIAL_CONTRIBUTION" && !value.manualReferenceKey) {
      ctx.addIssue({
        code: "custom",
        path: ["manualReferenceKey"],
        message: "Please provide transfer reference ID before submitting.",
      });
    }

  });

export type FreeWarriorApplicationInput = z.infer<typeof freeWarriorApplicationSchema>;

export const freeWarriorReviewSchema = z.object({
  applicationId: z.string().trim().min(1),
  approve: z.boolean(),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type FreeWarriorReviewInput = z.infer<typeof freeWarriorReviewSchema>;
