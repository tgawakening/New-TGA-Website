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

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);
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

  const isManualPayment =
    input.paymentMethod === "BANK_TRANSFER" || input.paymentMethod === "JAZZCASH";

  if (isManualPayment) {
    const appUrl = getAppUrl();
    const adminDashboardUrl = `${appUrl}/admin`;
    const orderAmount = formatAmount(result.pricing.finalAmount, result.pricing.currency);

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
