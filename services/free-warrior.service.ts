import { PaymentMethod, PaymentStatus, RegistrationStatus, EnrollmentStatus, FreeWarriorApplicationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { notifyAdmins, sendTransactionalEmail } from "@/lib/email";
import type { FreeWarriorApplicationInput, FreeWarriorReviewInput } from "@/lib/validations/free-warrior";

function buildScholarshipReference() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `FREE-${y}${m}${d}-${random}`;
}

function buildTemporaryPassword() {
  const random = Math.random().toString(36).slice(2, 8);
  return `TGA-${random}#2026`;
}

function parseCountryFromCityCountry(cityCountry: string) {
  const parts = cityCountry.split(",").map((part) => part.trim()).filter(Boolean);
  const countryName = parts.at(-1) ?? cityCountry.trim();
  const normalized = countryName.toLowerCase();

  if (normalized === "pakistan") {
    return { countryCode: "PK", countryName: "Pakistan" };
  }
  if (normalized === "india") {
    return { countryCode: "IN", countryName: "India" };
  }
  if (normalized === "bangladesh") {
    return { countryCode: "BD", countryName: "Bangladesh" };
  }
  if (normalized === "afghanistan") {
    return { countryCode: "AF", countryName: "Afghanistan" };
  }

  return {
    countryCode: "GB",
    countryName,
  };
}

function parsePhoneParts(whatsapp: string) {
  const match = whatsapp.match(/^(\+\d{1,4})(\d{6,})$/);
  if (!match) {
    return { phoneCountryCode: "+44", phoneNumber: whatsapp.replace(/\D/g, "") };
  }

  return {
    phoneCountryCode: match[1],
    phoneNumber: match[2],
  };
}

export async function submitFreeWarriorApplication(input: FreeWarriorApplicationInput) {
  const existingPending = await prisma.freeWarriorApplication.findFirst({
    where: {
      email: input.email,
      courseSlug: input.courseSlug,
      status: FreeWarriorApplicationStatus.PENDING,
    },
    select: { id: true },
  });

  if (existingPending) {
    throw new Error("A Fee Waiver application is already pending for this email.");
  }

  const contributionSummary =
    input.contributionPreference === "FULL_SCHOLARSHIP"
      ? "Contribution preference: No, I need complete scholarship."
      : `Contribution preference: I can afford some fees monthly (${input.monthlyContributionPkr} PKR monthly).`;

  const manualPaymentSummary =
    input.contributionPreference === "PARTIAL_CONTRIBUTION"
      ? [
          `Sender name: ${input.manualSenderName}`,
          `Sender number: ${input.manualSenderNumber}`,
          `Transfer reference: ${input.manualReferenceKey}`,
          input.manualNotes ? `Manual notes: ${input.manualNotes}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  const applicationInput = {
    ...input,
    reasonForWaiver: [contributionSummary, manualPaymentSummary, input.reasonForWaiver].filter(Boolean).join("\n\n"),
  };

  Reflect.deleteProperty(applicationInput, "contributionPreference");
  Reflect.deleteProperty(applicationInput, "monthlyContributionPkr");
  Reflect.deleteProperty(applicationInput, "manualSenderName");
  Reflect.deleteProperty(applicationInput, "manualSenderNumber");
  Reflect.deleteProperty(applicationInput, "manualReferenceKey");
  Reflect.deleteProperty(applicationInput, "manualNotes");
  Reflect.deleteProperty(applicationInput, "transactionScreenshotName");
  Reflect.deleteProperty(applicationInput, "transactionScreenshotData");

  const application = await prisma.freeWarriorApplication.create({
    data: {
      ...applicationInput,
      transactionScreenshotData: input.transactionScreenshotData || null,
      transactionScreenshotName: input.transactionScreenshotName || null,
      previousSeerahStudy: input.previousSeerahStudy || null,
      currentInvolvement: input.currentInvolvement || null,
      howHeard: input.howHeard || null,
    },
  });

  await Promise.allSettled([
    sendTransactionalEmail({
      to: input.email,
      subject: "Fee Waiver application received",
      emailType: "FREE_WARRIOR_RECEIVED",
      html: `
        <p>Assalam-u-Alaikum ${input.fullName},</p>
        <p>We have received your Fee Waiver application for ${input.courseTitle}.</p>
        <p>Your application is now under review. We will email you once the review is complete.</p>
      `,
      text: [
        `Assalam-u-Alaikum ${input.fullName},`,
        `We have received your Fee Waiver application for ${input.courseTitle}.`,
        "Your application is now under review. We will email you once the review is complete.",
      ].join("\n"),
    }),
    notifyAdmins({
      subject: `New Fee Waiver application: ${input.fullName}`,
      emailType: "ADMIN_FREE_WARRIOR_APPLICATION",
      html: `
        <p>New Fee Waiver application received.</p>
        <p>Name: <strong>${input.fullName}</strong></p>
        <p>Email: ${input.email}</p>
        <p>WhatsApp: ${input.whatsapp}</p>
        <p>City & Country: ${input.cityCountry}</p>
        <p>Occupation: ${input.occupation}</p>
        <p>Knowledge Level: ${input.knowledgeLevel}</p>
        <p>${contributionSummary}</p>
        ${manualPaymentSummary ? `<p style="white-space: pre-line;">${manualPaymentSummary}</p>` : ""}
        <p>Reason for waiver: ${input.reasonForWaiver}</p>
      `,
      text: [
        "New Fee Waiver application received.",
        `Name: ${input.fullName}`,
        `Email: ${input.email}`,
        `WhatsApp: ${input.whatsapp}`,
        `City & Country: ${input.cityCountry}`,
        `Occupation: ${input.occupation}`,
        `Knowledge Level: ${input.knowledgeLevel}`,
        contributionSummary,
        manualPaymentSummary,
        `Reason for waiver: ${input.reasonForWaiver}`,
      ].join("\n"),
    }),
  ]);

  return { applicationId: application.id };
}

export async function listFreeWarriorApplicationsForAdmin() {
  return prisma.freeWarriorApplication.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function reviewFreeWarriorApplication(input: FreeWarriorReviewInput) {
  const application = await prisma.freeWarriorApplication.findUnique({
    where: { id: input.applicationId },
  });

  if (!application) {
    throw new Error("Fee Waiver application not found.");
  }

  if (application.status !== FreeWarriorApplicationStatus.PENDING) {
    throw new Error("This application has already been reviewed.");
  }

  if (!input.approve) {
    const rejected = await prisma.freeWarriorApplication.update({
      where: { id: application.id },
      data: {
        status: FreeWarriorApplicationStatus.REJECTED,
        reviewNote: input.note || null,
        reviewedAt: new Date(),
      },
    });

    await Promise.allSettled([
      sendTransactionalEmail({
        to: application.email,
        subject: "Fee Waiver application update",
        emailType: "FREE_WARRIOR_REJECTED",
        html: `
          <p>Assalam-u-Alaikum ${application.fullName},</p>
          <p>Your Fee Waiver application has been reviewed.</p>
          <p>At this time, we could not approve the waiver request.</p>
          ${input.note ? `<p>Admin note: ${input.note}</p>` : ""}
        `,
        text: [
          `Assalam-u-Alaikum ${application.fullName},`,
          "Your Fee Waiver application has been reviewed.",
          "At this time, we could not approve the waiver request.",
          input.note ? `Admin note: ${input.note}` : "",
        ].filter(Boolean).join("\n"),
      }),
      notifyAdmins({
        subject: `Fee Waiver application rejected: ${application.fullName}`,
        emailType: "ADMIN_FREE_WARRIOR_REJECTED",
        html: `
          <p>Fee Waiver application rejected.</p>
          <p>Name: <strong>${application.fullName}</strong></p>
          <p>Email: ${application.email}</p>
          ${input.note ? `<p>Admin note: ${input.note}</p>` : ""}
        `,
        text: [
          "Fee Waiver application rejected.",
          `Name: ${application.fullName}`,
          `Email: ${application.email}`,
          input.note ? `Admin note: ${input.note}` : "",
        ].filter(Boolean).join("\n"),
      }),
    ]);

    return rejected;
  }

  const course = await prisma.course.findUnique({
    where: { slug: application.courseSlug },
    select: { id: true, title: true },
  });

  if (!course) {
    throw new Error("Course not found for this application.");
  }

  const scholarshipReference = buildScholarshipReference();
  const temporaryPassword = buildTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const country = parseCountryFromCityCountry(application.cityCountry);
  const phone = parsePhoneParts(application.whatsapp);

  const result = await prisma.$transaction(async (tx) => {
    let createdNewUser = false;
    let user = await tx.user.findUnique({
      where: { email: application.email },
      include: {
        enrollments: {
          where: { courseId: course.id },
        },
      },
    });

    if (!user) {
      createdNewUser = true;
      user = await tx.user.create({
        data: {
          fullName: application.fullName,
          email: application.email,
          phoneCountryCode: phone.phoneCountryCode,
          phoneNumber: phone.phoneNumber,
          passwordHash,
        },
        include: {
          enrollments: {
            where: { courseId: course.id },
          },
        },
      });

      await tx.studentProfile.create({
        data: {
          userId: user.id,
          countryCode: country.countryCode,
          countryName: country.countryName,
        },
      });
    }

    const existingRegistration = await tx.registration.findFirst({
      where: {
        userId: user.id,
        courseId: course.id,
      },
      select: {
        id: true,
        payment: { select: { id: true } },
        enrollment: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    let registrationId = existingRegistration?.id ?? null;

    if (!existingRegistration) {
      const registration = await tx.registration.create({
        data: {
          userId: user.id,
          courseId: course.id,
          selectedCountryCode: country.countryCode,
          selectedCountryName: country.countryName,
          selectedCurrency: "GBP",
          baseAmount: 2000,
          autoDiscountAmount: 2000,
          couponDiscountAmount: 0,
          finalAmount: 0,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          paymentReference: scholarshipReference,
          status: RegistrationStatus.ACTIVE,
          pricingSnapshot: {
            mode: "FREE_WARRIOR_SCHOLARSHIP",
            originalPrice: application.listedPrice,
            approvedAt: new Date().toISOString(),
          },
        },
      });

      await tx.payment.create({
        data: {
          registrationId: registration.id,
          provider: PaymentMethod.BANK_TRANSFER,
          amount: 0,
          currency: "GBP",
          status: PaymentStatus.CONFIRMED,
          manualNotes: "Approved fee waiver scholarship with full waiver.",
          paidAt: new Date(),
          rawPayloadJson: {
            source: "FREE_WARRIOR_APPLICATION",
            applicationId: application.id,
          },
        },
      });

      await tx.enrollment.create({
        data: {
          userId: user.id,
          courseId: course.id,
          registrationId: registration.id,
          status: EnrollmentStatus.ACTIVE,
          activatedAt: new Date(),
        },
      });

      registrationId = registration.id;
    } else {
      await tx.registration.update({
        where: { id: existingRegistration.id },
        data: {
          status: RegistrationStatus.ACTIVE,
        },
      });

      if (existingRegistration.enrollment) {
        await tx.enrollment.update({
          where: { registrationId: existingRegistration.id },
          data: {
            status: EnrollmentStatus.ACTIVE,
            activatedAt: new Date(),
          },
        });
      }

      if (existingRegistration.payment) {
        await tx.payment.update({
          where: { registrationId: existingRegistration.id },
          data: {
            status: PaymentStatus.CONFIRMED,
            amount: 0,
            currency: "GBP",
            manualNotes: "Approved fee waiver scholarship with full waiver.",
            paidAt: new Date(),
          },
        });
      }
    }

    const reviewedApplication = await tx.freeWarriorApplication.update({
      where: { id: application.id },
      data: {
        status: FreeWarriorApplicationStatus.APPROVED,
        reviewNote: input.note || null,
        reviewedAt: new Date(),
        approvedUserId: user.id,
      },
    });

    return {
      application: reviewedApplication,
      user,
      registrationId,
      temporaryPassword: createdNewUser ? temporaryPassword : null,
    };
  });

  await Promise.allSettled([
    sendTransactionalEmail({
      userId: result.user.id,
      to: application.email,
      subject: "Fee Waiver application approved",
      emailType: "FREE_WARRIOR_APPROVED",
      html: `
        <p>Assalam-u-Alaikum ${application.fullName},</p>
        <p>Your Fee Waiver application for ${application.courseTitle} has been approved.</p>
        <p>Your scholarship has been fully waived and your student access is now active.</p>
        ${
          result.temporaryPassword
            ? `<p>Temporary password: <strong>${result.temporaryPassword}</strong></p>`
            : "<p>Your existing account has been activated for this course.</p>"
        }
        <p>You can log in and access your dashboard now.</p>
      `,
      text: [
        `Assalam-u-Alaikum ${application.fullName},`,
        `Your Fee Waiver application for ${application.courseTitle} has been approved.`,
        "Your scholarship has been fully waived and your student access is now active.",
        result.temporaryPassword ? `Temporary password: ${result.temporaryPassword}` : "Your existing account has been activated for this course.",
        "You can log in and access your dashboard now.",
      ].join("\n"),
    }),
    notifyAdmins({
      subject: `Fee Waiver approved: ${application.fullName}`,
      emailType: "ADMIN_FREE_WARRIOR_APPROVED",
      html: `
        <p>Fee Waiver application approved.</p>
        <p>Name: <strong>${application.fullName}</strong></p>
        <p>Email: ${application.email}</p>
        <p>Scholarship reference: ${scholarshipReference}</p>
      `,
      text: [
        "Fee Waiver application approved.",
        `Name: ${application.fullName}`,
        `Email: ${application.email}`,
        `Scholarship reference: ${scholarshipReference}`,
      ].join("\n"),
    }),
  ]);

  return result.application;
}
