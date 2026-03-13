import { PaymentStatus, RegistrationStatus, type PaymentMethod } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { notifyAdmins, sendTransactionalEmail } from "@/lib/email";
import { calculatePricing } from "@/lib/pricing";
import type { RegistrationInput } from "@/lib/validations/registration";

function buildPaymentReference() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SEERAH-${y}${m}${d}-${random}`;
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

  if (!pricing.allowedPaymentMethods.includes(input.paymentMethod)) {
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
        pricingSnapshot: pricing,
      },
    });

    await tx.payment.create({
      data: {
        registrationId: registration.id,
        provider: input.paymentMethod as PaymentMethod,
        amount: pricing.finalAmount,
        currency: pricing.currency,
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
    };
  });

  await Promise.allSettled([
    sendTransactionalEmail({
      userId: result.userId,
      to: input.email,
      subject: "Registration received for Prophetic Seerah and Planning",
      emailType: "REGISTRATION_RECEIVED",
      html: `
        <p>Assalam-u-Alaikum ${input.fullName},</p>
        <p>Your registration has been created for Prophetic Seerah and Planning.</p>
        <p>Reference: <strong>${result.paymentReference}</strong></p>
        <p>Current status: pending payment.</p>
        <p>Once payment is completed and confirmed, your dashboard access will be activated.</p>
      `,
      text: [
        `Assalam-u-Alaikum ${input.fullName},`,
        "Your registration has been created for Prophetic Seerah and Planning.",
        `Reference: ${result.paymentReference}`,
        "Current status: pending payment.",
        "Once payment is completed and confirmed, your dashboard access will be activated.",
      ].join("\n"),
    }),
    notifyAdmins({
      subject: `New registration: ${input.fullName}`,
      emailType: "ADMIN_NEW_REGISTRATION",
      html: `
        <p>New registration received.</p>
        <p>Name: <strong>${input.fullName}</strong></p>
        <p>Email: ${input.email}</p>
        <p>Country: ${input.countryName}</p>
        <p>Payment method: ${input.paymentMethod}</p>
        <p>Reference: ${result.paymentReference}</p>
      `,
      text: [
        "New registration received.",
        `Name: ${input.fullName}`,
        `Email: ${input.email}`,
        `Country: ${input.countryName}`,
        `Payment method: ${input.paymentMethod}`,
        `Reference: ${result.paymentReference}`,
      ].join("\n"),
    }),
  ]);

  return result;
}
