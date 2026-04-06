import { PaymentMethod } from "@prisma/client";

export const COURSE_DURATION_MONTHS = 8;

export const PAYMENT_PLAN_TYPES = ["SUBSCRIPTION", "FULL_COURSE"] as const;

export type PaymentPlanType = (typeof PAYMENT_PLAN_TYPES)[number];

export const DEFAULT_PAYMENT_PLAN_TYPE: PaymentPlanType = "SUBSCRIPTION";

export const paymentPlanTypeLabels: Record<PaymentPlanType, string> = {
  SUBSCRIPTION: "Monthly subscription",
  FULL_COURSE: "Full course payment",
};

export type PaymentMethodsByPlan = {
  subscription: PaymentMethod[];
  fullCourse: PaymentMethod[];
};

export function getPaymentMethodsForPlan(
  methodsByPlan: PaymentMethodsByPlan,
  paymentPlanType: PaymentPlanType,
) {
  return paymentPlanType === "FULL_COURSE" ? methodsByPlan.fullCourse : methodsByPlan.subscription;
}

