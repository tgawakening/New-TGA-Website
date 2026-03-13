import { PaymentMethod, RegionGroup, type Coupon } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SOUTH_ASIA_DISCOUNT_COUNTRIES = new Set(["PK", "IN", "AF", "BD"]);
const MANUAL_PAYMENT_COUNTRIES = new Set(["PK"]);
const GBP_TO_PKR_APPROX = 376;
const HAS_DATABASE_URL = Boolean(process.env.DATABASE_URL);

function gbpPenceToPkr(pence: number): number {
  return Math.round((pence / 100) * GBP_TO_PKR_APPROX);
}

type CourseLike = {
  id: string;
  slug: string;
  basePrice: number;
  currency: string;
};

export type PricingInput = {
  courseSlug: string;
  countryCode: string;
  couponCode?: string;
};

export type PricingOutput = {
  courseId: string;
  courseSlug: string;
  regionGroup: RegionGroup;
  baseAmount: number;
  autoDiscountAmount: number;
  couponDiscountAmount: number;
  finalAmount: number;
  currency: string;
  autoDiscountApplied: boolean;
  canUseCoupon: boolean;
  couponCode?: string;
  allowedPaymentMethods: PaymentMethod[];
  display: {
    baseGbp: number;
    finalGbpApprox: number;
    exchangeRateApprox: number;
  };
};

function resolveRegionGroup(countryCode: string): RegionGroup {
  return SOUTH_ASIA_DISCOUNT_COUNTRIES.has(countryCode) ? RegionGroup.SOUTH_ASIA : RegionGroup.GLOBAL;
}

function getAllowedPaymentMethods(countryCode: string): PaymentMethod[] {
  const baseMethods: PaymentMethod[] = [PaymentMethod.STRIPE, PaymentMethod.PAYPAL];
  if (!MANUAL_PAYMENT_COUNTRIES.has(countryCode)) return baseMethods;
  return [...baseMethods, PaymentMethod.BANK_TRANSFER, PaymentMethod.NAYAPAY];
}

function applyCoupon(amount: number, coupon: Coupon): number {
  if (coupon.type === "PERCENT") {
    return Math.min(amount, Math.round((amount * coupon.value) / 100));
  }
  return Math.min(amount, coupon.value);
}

async function getCourse(courseSlug: string): Promise<CourseLike> {
  if (!HAS_DATABASE_URL) {
    if (courseSlug !== "seerah-course") {
      throw new Error("Course not found.");
    }
    return {
      id: "fallback-seerah-course",
      slug: "seerah-course",
      basePrice: 2000,
      currency: "GBP",
    };
  }

  const course = await prisma.course.findFirst({
    where: { slug: courseSlug, isActive: true },
  });

  if (!course) {
    throw new Error("Course not found or inactive.");
  }
  return course;
}

async function getActivePricingRule(courseId: string, countryCode: string) {
  if (!HAS_DATABASE_URL) return null;
  const now = new Date();
  return prisma.pricingRule.findFirst({
    where: {
      courseId,
      countryCode,
      OR: [{ activeFrom: null }, { activeFrom: { lte: now } }],
      AND: [{ OR: [{ activeTo: null }, { activeTo: { gte: now } }] }],
    },
  });
}

async function findValidCoupon({
  couponCode,
  courseId,
  regionGroup,
}: {
  couponCode?: string;
  courseId: string;
  regionGroup: RegionGroup;
}): Promise<Coupon | null> {
  if (!couponCode || !HAS_DATABASE_URL) return null;

  const now = new Date();
  const coupon = await prisma.coupon.findFirst({
    where: {
      code: couponCode,
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
    },
  });

  if (!coupon) return null;
  if (coupon.maxRedemptions !== null && coupon.usedCount >= coupon.maxRedemptions) return null;
  if (coupon.applicableCourseId && coupon.applicableCourseId !== courseId) return null;
  if (coupon.applicableRegion && coupon.applicableRegion !== regionGroup) return null;

  return coupon;
}

export async function calculatePricing(input: PricingInput): Promise<PricingOutput> {
  const countryCode = input.countryCode.toUpperCase();
  const course = await getCourse(input.courseSlug);
  const pricingRule = await getActivePricingRule(course.id, countryCode);
  const regionGroup = pricingRule?.regionGroup ?? resolveRegionGroup(countryCode);
  const allowedPaymentMethods = getAllowedPaymentMethods(countryCode);

  let currency = course.currency.toUpperCase();
  let baseAmount = course.basePrice;
  let autoDiscountAmount = 0;

  if (pricingRule) {
    currency = pricingRule.currency.toUpperCase();
    baseAmount = pricingRule.amount;
    autoDiscountAmount = pricingRule.isDiscounted
      ? Math.max(0, gbpPenceToPkr(course.basePrice) - pricingRule.amount)
      : 0;
  } else if (regionGroup === RegionGroup.SOUTH_ASIA) {
    const targetAmountPkr = 2000;
    currency = "PKR";
    baseAmount = targetAmountPkr;
    autoDiscountAmount = Math.max(0, gbpPenceToPkr(course.basePrice) - targetAmountPkr);
  }

  const canUseCoupon = regionGroup !== RegionGroup.SOUTH_ASIA;
  const couponCode = input.couponCode?.trim().toUpperCase();
  const coupon = canUseCoupon
    ? await findValidCoupon({ couponCode, courseId: course.id, regionGroup })
    : null;

  const couponDiscountAmount = coupon ? applyCoupon(baseAmount, coupon) : 0;
  const finalAmount = Math.max(0, baseAmount - couponDiscountAmount);

  return {
    courseId: course.id,
    courseSlug: course.slug,
    regionGroup,
    baseAmount,
    autoDiscountAmount,
    couponDiscountAmount,
    finalAmount,
    currency,
    autoDiscountApplied: regionGroup === RegionGroup.SOUTH_ASIA,
    canUseCoupon,
    couponCode: coupon?.code,
    allowedPaymentMethods,
    display: {
      baseGbp: course.basePrice / 100,
      finalGbpApprox: currency === "GBP" ? finalAmount / 100 : Number((finalAmount / GBP_TO_PKR_APPROX).toFixed(2)),
      exchangeRateApprox: GBP_TO_PKR_APPROX,
    },
  };
}
