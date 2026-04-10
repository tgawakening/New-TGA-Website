import { PaymentStatus, Prisma, RegistrationStatus, type PaymentMethod } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  COURSE_DURATION_MONTHS,
  getPaymentMethodsForPlan,
  paymentPlanTypeLabels,
} from "@/lib/course-payment";
import { notifyAdmins, sendTransactionalEmail } from "@/lib/email";
import { calculatePricing, SOUTH_ASIA_ONLINE_AMOUNT_PENCE } from "@/lib/pricing";
import type { PendingRegistrationUpdateInput, RegistrationInput } from "@/lib/validations/registration";

function buildPaymentReference() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SEERAH-${y}${m}${d}-${random}`;
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function formatAmount(amount: number, currency: string) {
  if (currency === "GBP") {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount / 100);
  }

  return `${currency} ${amount.toLocaleString("en-GB")}`;
}

function getPaymentRecordAmount(
  pricing: Awaited<ReturnType<typeof calculatePricing>>,
  paymentPlanType: RegistrationInput["paymentPlanType"],
  paymentMethod: RegistrationInput["paymentMethod"],
) {
  const isOnlinePayment = paymentMethod === "STRIPE" || paymentMethod === "PAYPAL";
  const isFullCoursePayment = paymentPlanType === "FULL_COURSE";

  if (isOnlinePayment && pricing.autoDiscountApplied) {
    return {
      amount: isFullCoursePayment
        ? SOUTH_ASIA_ONLINE_AMOUNT_PENCE * COURSE_DURATION_MONTHS
        : SOUTH_ASIA_ONLINE_AMOUNT_PENCE,
      currency: "GBP",
    };
  }

  return {
    amount: isFullCoursePayment ? pricing.fullCourseAmount : pricing.finalAmount,
    currency: pricing.currency,
  };
}

export async function registerStudent(input: RegistrationInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error("Email is already registered. Please log in.");
  }

  const pricing = await calculatePricing({
    courseSlug: input.courseSlug,
    countryCode: input.countryCode,
    couponCode: input.couponCode,
  });
  const allowedPaymentMethods = getPaymentMethodsForPlan(pricing.allowedPaymentMethodsByPlan, input.paymentPlanType);

  if (!allowedPaymentMethods.includes(input.paymentMethod)) {
    throw new Error("Selected payment method is not available for this country.");
  }

  const coupon = pricing.couponCode
    ? await prisma.coupon.findUnique({
        where: { code: pricing.couponCode },
        select: { id: true },
      })
    : null;

  const passwordHash = await bcrypt.hash(input.password, 12);
  const paymentReference = buildPaymentReference();
  const paymentRecord = getPaymentRecordAmount(pricing, input.paymentPlanType, input.paymentMethod);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        phoneCountryCode: input.phoneCountryCode,
        phoneNumber: input.phoneNumber,
        passwordHash,
      },
    });

    await tx.studentProfile.create({
      data: {
        userId: user.id,
        countryCode: input.countryCode,
        countryName: input.countryName,
        timezone: input.timezone,
      },
    });

    const registration = await tx.registration.create({
      data: {
        userId: user.id,
        courseId: pricing.courseId,
        selectedCountryCode: input.countryCode,
        selectedCountryName: input.countryName,
        selectedCurrency: pricing.currency,
        baseAmount: pricing.baseAmount,
        autoDiscountAmount: pricing.autoDiscountAmount,
        couponDiscountAmount: pricing.couponDiscountAmount,
        finalAmount: pricing.finalAmount,
        paymentMethod: input.paymentMethod as PaymentMethod,
        paymentReference,
        status: RegistrationStatus.PENDING_PAYMENT,
        couponId: coupon?.id,
        couponCode: pricing.couponCode,
        pricingSnapshot: {
          ...pricing,
          selectedPaymentPlanType: input.paymentPlanType,
          chargeAmount: paymentRecord.amount,
          chargeCurrency: paymentRecord.currency,
        },
      },
    });

    await tx.payment.create({
      data: {
        registrationId: registration.id,
        provider: input.paymentMethod as PaymentMethod,
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        status: PaymentStatus.INITIATED,
      },
    });

    await tx.enrollment.create({
      data: {
        userId: user.id,
        courseId: pricing.courseId,
        registrationId: registration.id,
      },
    });

    return {
      userId: user.id,
      registrationId: registration.id,
      pricing,
      paymentReference,
      paymentRecord,
    };
  });

  const isManualPayment =
    input.paymentMethod === "BANK_TRANSFER" || input.paymentMethod === "JAZZCASH";

  if (isManualPayment) {
    const appUrl = getAppUrl();
    const adminDashboardUrl = `${appUrl}/admin`;
    const orderAmount = formatAmount(result.paymentRecord.amount, result.paymentRecord.currency);
    const paymentPlanLabel = paymentPlanTypeLabels[input.paymentPlanType];

    await Promise.allSettled([
      sendTransactionalEmail({
        userId: result.userId,
        to: input.email,
        subject: "Registration received for Prophetic Seerah and Planning",
        emailType: "REGISTRATION_RECEIVED",
        html: `
          <p>Assalam-u-Alaikum ${input.fullName},</p>
          <p>Your registration has been created for <strong>Prophetic Seerah and Planning</strong>.</p>
          <p><strong>Reference:</strong> ${result.paymentReference}</p>
          <p><strong>Email:</strong> ${input.email}</p>
          <p><strong>Phone:</strong> ${input.phoneCountryCode} ${input.phoneNumber}</p>
          <p><strong>Country:</strong> ${input.countryName}</p>
          <p><strong>Payment plan:</strong> ${paymentPlanLabel}</p>
          <p><strong>Payment method:</strong> ${input.paymentMethod}</p>
          <p><strong>Status:</strong> Pending manual review</p>
          <p><strong>Amount:</strong> ${orderAmount}</p>
          <p>Once your manual payment is verified, your dashboard access will be activated automatically.</p>
        `,
        text: [
          `Assalam-u-Alaikum ${input.fullName},`,
          "Your registration has been created for Prophetic Seerah and Planning.",
          `Reference: ${result.paymentReference}`,
          `Email: ${input.email}`,
          `Phone: ${input.phoneCountryCode} ${input.phoneNumber}`,
          `Country: ${input.countryName}`,
          `Payment plan: ${paymentPlanLabel}`,
          `Payment method: ${input.paymentMethod}`,
          "Status: Pending manual review",
          `Amount: ${orderAmount}`,
          "Once your manual payment is verified, your dashboard access will be activated automatically.",
        ].join("\n"),
      }),
      notifyAdmins({
        subject: `New registration: ${input.fullName}`,
        emailType: "ADMIN_NEW_REGISTRATION",
        html: `
          <p>A new manual registration has been received on your platform.</p>
          <p><strong>Name:</strong> ${input.fullName}</p>
          <p><strong>Email:</strong> ${input.email}</p>
          <p><strong>Phone:</strong> ${input.phoneCountryCode} ${input.phoneNumber}</p>
          <p><strong>Country:</strong> ${input.countryName}</p>
          <p><strong>Payment plan:</strong> ${paymentPlanLabel}</p>
          <p><strong>Payment mode:</strong> Pending</p>
          <p><strong>Payment method:</strong> ${input.paymentMethod}</p>
          <p><strong>Amount:</strong> ${orderAmount}</p>
          <p><strong>Reference:</strong> ${result.paymentReference}</p>
          <p style="margin: 24px 0;">
            <a href="${adminDashboardUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#0f5e91;color:#ffffff;text-decoration:none;font-weight:700;">Review in Dashboard</a>
          </p>
        `,
        text: [
          "A new manual registration has been received on your platform.",
          `Name: ${input.fullName}`,
          `Email: ${input.email}`,
          `Phone: ${input.phoneCountryCode} ${input.phoneNumber}`,
          `Country: ${input.countryName}`,
          `Payment plan: ${paymentPlanLabel}`,
          "Payment mode: Pending",
          `Payment method: ${input.paymentMethod}`,
          `Amount: ${orderAmount}`,
          `Reference: ${result.paymentReference}`,
          `Review in dashboard: ${adminDashboardUrl}`,
        ].join("\n"),
      }),
    ]);
  }

  return result;
}
export async function updatePendingRegistration(input: PendingRegistrationUpdateInput & { userId: string }) {
  const registration = await prisma.registration.findFirst({
    where: {
      id: input.registrationId,
      userId: input.userId,
    },
    include: {
      payment: true,
      subscription: true,
    },
  });

  if (!registration || !registration.payment) {
    throw new Error("Pending registration not found.");
  }

  const payment = registration.payment;

  if (
    registration.payment.status === PaymentStatus.SUCCEEDED ||
    registration.payment.status === PaymentStatus.CONFIRMED ||
    registration.status === RegistrationStatus.ACTIVE ||
    registration.status === RegistrationStatus.PAID
  ) {
    throw new Error("This registration is already completed.");
  }

  if (
    registration.payment.status === PaymentStatus.UNDER_REVIEW ||
    registration.status === RegistrationStatus.MANUAL_REVIEW
  ) {
    throw new Error("This payment is already under manual review and cannot be changed now.");
  }

  const pricing = await calculatePricing({
    courseSlug: input.courseSlug,
    countryCode: input.countryCode,
    couponCode: input.couponCode,
  });
  const allowedPaymentMethods = getPaymentMethodsForPlan(pricing.allowedPaymentMethodsByPlan, input.paymentPlanType);

  if (!allowedPaymentMethods.includes(input.paymentMethod)) {
    throw new Error("Selected payment method is not available for this country.");
  }

  const coupon = pricing.couponCode
    ? await prisma.coupon.findUnique({
        where: { code: pricing.couponCode },
        select: { id: true },
      })
    : null;

  const paymentRecord = getPaymentRecordAmount(pricing, input.paymentPlanType, input.paymentMethod);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: {
        fullName: input.fullName,
        phoneCountryCode: input.phoneCountryCode,
        phoneNumber: input.phoneNumber,
      },
    });

    await tx.studentProfile.upsert({
      where: { userId: input.userId },
      update: {
        countryCode: input.countryCode,
        countryName: input.countryName,
        timezone: input.timezone || null,
      },
      create: {
        userId: input.userId,
        countryCode: input.countryCode,
        countryName: input.countryName,
        timezone: input.timezone || null,
      },
    });

    await tx.registration.update({
      where: { id: registration.id },
      data: {
        selectedCountryCode: input.countryCode,
        selectedCountryName: input.countryName,
        selectedCurrency: pricing.currency,
        baseAmount: pricing.baseAmount,
        autoDiscountAmount: pricing.autoDiscountAmount,
        couponDiscountAmount: pricing.couponDiscountAmount,
        finalAmount: pricing.finalAmount,
        paymentMethod: input.paymentMethod as PaymentMethod,
        status: RegistrationStatus.PENDING_PAYMENT,
        couponId: coupon?.id ?? null,
        couponCode: pricing.couponCode ?? null,
        pricingSnapshot: {
          ...pricing,
          selectedPaymentPlanType: input.paymentPlanType,
          chargeAmount: paymentRecord.amount,
          chargeCurrency: paymentRecord.currency,
        } as Prisma.InputJsonValue,
      },
    });

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        provider: input.paymentMethod as PaymentMethod,
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        status: PaymentStatus.INITIATED,
        providerOrderId: null,
        providerPaymentId: null,
        paidAt: null,
        rawPayloadJson: Prisma.JsonNull,
        manualNotes: null,
      },
    });

    await tx.manualPaymentSubmission.deleteMany({
      where: { paymentId: payment.id },
    });
  });

  return {
    registrationId: registration.id,
    paymentReference: registration.paymentReference,
    pricing,
    paymentRecord,
  };
}

