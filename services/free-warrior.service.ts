import { PaymentMethod, PaymentStatus, RegistrationStatus, EnrollmentStatus, FreeWarriorApplicationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { validateSirahReceipt } from "./sirah-receipts.service";
import { SirahError } from "./sirah-registration.service";
import { scholarshipSubmissionEmail } from "@/lib/sirah/scholarship-email";
import { prisma } from "@/lib/prisma";
import { notifyAdmins, sendTransactionalEmail } from "@/lib/email";
import { parseFreeWarriorContribution } from "@/lib/free-warrior";
import { SIRAH_TITLE, SIRAH_SLUG } from "@/lib/sirah/catalog";
import { SIRAH_SCHOLARSHIP_BATCH, SIRAH_SCHOLARSHIP_LIMIT } from "@/lib/sirah/scholarship";
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

export async function submitFreeWarriorApplication(input: FreeWarriorApplicationInput, file: { data: Uint8Array; name: string } | null = null) {
  const partial = input.contributionPreference === "PARTIAL_CONTRIBUTION";
  if (partial && (!file || !input.manualPaymentMethod)) throw new SirahError("Select Meezan Bank or JazzCash and upload your payment receipt.");
  if (!partial && file) throw new SirahError("Receipt evidence is only needed for a manual contribution.");
  const receipt = file ? await validateSirahReceipt(file.data, file.name) : null;
  const existingPending = await prisma.freeWarriorApplication.findFirst({
    where: {
      email: input.email,
      courseSlug: SIRAH_SLUG,
      scholarshipBatch: SIRAH_SCHOLARSHIP_BATCH,
      status: { in: [FreeWarriorApplicationStatus.PENDING, FreeWarriorApplicationStatus.APPROVED] },
    },
    select: { id: true },
  });

  if (existingPending) {
    throw new Error("A Batch 4 scholarship application is already pending or approved for this email.");
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
    courseSlug: SIRAH_SLUG,
    courseTitle: SIRAH_TITLE,
    listedPrice: "Approved regional fees — see /seerah",
    reasonForWaiver: [contributionSummary, manualPaymentSummary, input.reasonForWaiver].filter(Boolean).join("\n\n"),
  };

  Reflect.deleteProperty(applicationInput, "contributionPreference");
  Reflect.deleteProperty(applicationInput, "monthlyContributionPkr");
  Reflect.deleteProperty(applicationInput, "manualPaymentMethod");
  Reflect.deleteProperty(applicationInput, "manualSenderName");
  Reflect.deleteProperty(applicationInput, "manualSenderNumber");
  Reflect.deleteProperty(applicationInput, "manualReferenceKey");
  Reflect.deleteProperty(applicationInput, "manualNotes");
  const application = await prisma.freeWarriorApplication.create({
    data: {
      ...applicationInput,
      receipt: receipt ? { create: { ...receipt, method: input.manualPaymentMethod! } } : undefined,
      previousSeerahStudy: input.previousSeerahStudy || null,
      currentInvolvement: input.currentInvolvement || null,
      howHeard: input.howHeard || null,
    },
  });

  const admins = [...new Set((process.env.ADMIN_NOTIFICATION_EMAIL || "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean))];
  await Promise.allSettled([
    sendTransactionalEmail({
      to: input.email,
      emailType: admins.includes(input.email.toLowerCase()) ? "ADMIN_FREE_WARRIOR_APPLICATION" : "FREE_WARRIOR_RECEIVED",
      idempotencyKey: `scholarship-${application.id}-student`,
      ...scholarshipSubmissionEmail(input, application, receipt, admins.includes(input.email.toLowerCase())),
    }),
    ...admins.filter(email => email !== input.email.toLowerCase()).map(email => sendTransactionalEmail({
      to: email,
      emailType: "ADMIN_FREE_WARRIOR_APPLICATION",
      idempotencyKey: `scholarship-${application.id}-admin-${createHash("sha256").update(email).digest("hex").slice(0, 20)}`,
      ...scholarshipSubmissionEmail(input, application, receipt, true),
    })),
  ]);

  return { applicationId: application.id };
}

export async function listFreeWarriorApplicationsForAdmin() {
  return prisma.freeWarriorApplication.findMany({
    include: { receipt: { select: { filename: true, mime: true, method: true } } },
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
    const rejected = await prisma.freeWarriorApplication.updateMany({
      where: { id: application.id, status: FreeWarriorApplicationStatus.PENDING },
      data: {
        status: FreeWarriorApplicationStatus.REJECTED,
        reviewNote: input.note || null,
        reviewedAt: new Date(),
      },
    });

    if (!rejected.count) throw new Error("This application has already been reviewed.");

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

    return prisma.freeWarriorApplication.findUniqueOrThrow({ where: { id: application.id } });
  }

  const course = await prisma.course.findUnique({
    where: { slug: application.courseSlug },
    select: { id: true, title: true },
  });

  if (!course) {
    throw new Error("Course not found for this application.");
  }

  const contribution = parseFreeWarriorContribution(application.reasonForWaiver);
  const evidence = await prisma.freeWarriorReceipt.findUnique({ where: { applicationId: application.id }, select: { method: true } });
  const manualMethod = evidence?.method === "JAZZCASH" ? PaymentMethod.JAZZCASH : PaymentMethod.BANK_TRANSFER;
  const scholarshipReference = buildScholarshipReference();
  const temporaryPassword = buildTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const country = parseCountryFromCityCountry(application.cityCountry);
  const phone = parsePhoneParts(application.whatsapp);
  const approvedAt = new Date();
  const isFullScholarship = contribution.contributionPreference === "FULL_SCHOLARSHIP";
  const approvedAmountPence = contribution.monthlyContributionGbp
    ? Math.round(contribution.monthlyContributionGbp * 100)
    : 0;
  const registrationStatus = isFullScholarship ? RegistrationStatus.ACTIVE : RegistrationStatus.MANUAL_REVIEW;
  const paymentStatus = isFullScholarship ? PaymentStatus.CONFIRMED : PaymentStatus.UNDER_REVIEW;
  const enrollmentStatus = isFullScholarship ? EnrollmentStatus.ACTIVE : EnrollmentStatus.PENDING;
  const adminPaymentNote = isFullScholarship
    ? "Approved fee warrior application with full scholarship."
    : `Approved fee warrior application with partial contribution: ${contribution.amountLabel}.`;

  const result = await prisma.$transaction(async (tx) => {
    // Serialize awards on the course row so concurrent reviewers cannot award place 11.
    await tx.$queryRaw`SELECT id FROM Course WHERE id = ${course.id} FOR UPDATE`;
    const current = await tx.freeWarriorApplication.findUniqueOrThrow({ where: { id: application.id } });
    if (current.status !== FreeWarriorApplicationStatus.PENDING) throw new Error("This application has already been reviewed.");
    if (current.scholarshipBatch === SIRAH_SCHOLARSHIP_BATCH) {
      const awarded = await tx.freeWarriorApplication.count({ where: { scholarshipBatch: SIRAH_SCHOLARSHIP_BATCH, status: FreeWarriorApplicationStatus.APPROVED } });
      if (awarded >= SIRAH_SCHOLARSHIP_LIMIT) throw new Error("All 10 Batch 4 scholarship places have been awarded. This application remains pending.");
    }
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
        payment: { select: { id: true, status: true } },
        enrollment: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // A scholarship review must never overwrite a real paid registration or provider checkout.
    if (existingRegistration && (existingRegistration.payment?.status === PaymentStatus.CONFIRMED || await tx.sirahOrder.findUnique({ where: { registrationId: existingRegistration.id }, select: { id: true } }))) {
      throw new Error("This student already has a paid registration or a current Sīrah payment record. Review that record before awarding a scholarship; no payment has been changed.");
    }
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
            autoDiscountAmount: Math.max(2000 - approvedAmountPence, 0),
            couponDiscountAmount: 0,
            finalAmount: approvedAmountPence,
            paymentMethod: manualMethod,
            paymentReference: scholarshipReference,
            status: registrationStatus,
            pricingSnapshot: {
              mode: "FREE_WARRIOR_SCHOLARSHIP",
              originalPrice: application.listedPrice,
              approvedAt: approvedAt.toISOString(),
              contributionPreference: contribution.contributionPreference,
              monthlyContributionPkr: contribution.monthlyContributionPkr,
              monthlyContributionGbp: contribution.monthlyContributionGbp,
              contributionLabel: contribution.contributionLabel,
            },
          },
        });

        const payment = await tx.payment.create({
          data: {
            registrationId: registration.id,
            provider: manualMethod,
            amount: approvedAmountPence,
            currency: "GBP",
            status: paymentStatus,
            manualNotes: adminPaymentNote,
            paidAt: isFullScholarship ? approvedAt : null,
            rawPayloadJson: {
              source: "FREE_WARRIOR_APPLICATION",
              applicationId: application.id,
              contributionPreference: contribution.contributionPreference,
              monthlyContributionPkr: contribution.monthlyContributionPkr,
              monthlyContributionGbp: contribution.monthlyContributionGbp,
            },
          },
        });

        if (!isFullScholarship && contribution.senderName && contribution.senderNumber && contribution.referenceKey) {
          await tx.manualPaymentSubmission.create({
            data: {
              paymentId: payment.id,
              method: manualMethod,
              senderName: contribution.senderName,
              senderNumber: contribution.senderNumber,
              referenceKey: contribution.referenceKey,
              notes: contribution.manualNotes,
              submittedAt: approvedAt,
            },
          });
        }

        await tx.enrollment.create({
          data: {
            userId: user.id,
            courseId: course.id,
            registrationId: registration.id,
            status: enrollmentStatus,
            activatedAt: isFullScholarship ? approvedAt : null,
          },
        });

        registrationId = registration.id;
      } else {
        await tx.registration.update({
          where: { id: existingRegistration.id },
          data: {
            selectedCountryCode: country.countryCode,
            selectedCountryName: country.countryName,
            selectedCurrency: "GBP",
            baseAmount: 2000,
            autoDiscountAmount: Math.max(2000 - approvedAmountPence, 0),
            couponDiscountAmount: 0,
            finalAmount: approvedAmountPence,
            paymentMethod: manualMethod,
            paymentReference: scholarshipReference,
            status: registrationStatus,
            pricingSnapshot: {
              mode: "FREE_WARRIOR_SCHOLARSHIP",
              originalPrice: application.listedPrice,
              approvedAt: approvedAt.toISOString(),
              contributionPreference: contribution.contributionPreference,
              monthlyContributionPkr: contribution.monthlyContributionPkr,
              monthlyContributionGbp: contribution.monthlyContributionGbp,
              contributionLabel: contribution.contributionLabel,
            },
          },
        });

        if (existingRegistration.enrollment) {
          await tx.enrollment.update({
            where: { registrationId: existingRegistration.id },
            data: {
              status: enrollmentStatus,
              activatedAt: isFullScholarship ? approvedAt : null,
            },
          });
        } else {
          await tx.enrollment.create({
            data: {
              userId: user.id,
              courseId: course.id,
              registrationId: existingRegistration.id,
              status: enrollmentStatus,
              activatedAt: isFullScholarship ? approvedAt : null,
            },
          });
        }

        if (existingRegistration.payment) {
          await tx.payment.update({
            where: { registrationId: existingRegistration.id },
            data: {
              provider: manualMethod,
              status: paymentStatus,
              amount: approvedAmountPence,
              currency: "GBP",
              manualNotes: adminPaymentNote,
              paidAt: isFullScholarship ? approvedAt : null,
              rawPayloadJson: {
                source: "FREE_WARRIOR_APPLICATION",
                applicationId: application.id,
                contributionPreference: contribution.contributionPreference,
                monthlyContributionPkr: contribution.monthlyContributionPkr,
                monthlyContributionGbp: contribution.monthlyContributionGbp,
              },
            },
          });

          if (!isFullScholarship && contribution.senderName && contribution.senderNumber && contribution.referenceKey) {
            await tx.manualPaymentSubmission.upsert({
              where: { paymentId: existingRegistration.payment.id },
              update: {
                method: manualMethod,
                senderName: contribution.senderName,
                senderNumber: contribution.senderNumber,
                referenceKey: contribution.referenceKey,
                notes: contribution.manualNotes,
              },
              create: {
                paymentId: existingRegistration.payment.id,
                method: manualMethod,
                senderName: contribution.senderName,
                senderNumber: contribution.senderNumber,
                referenceKey: contribution.referenceKey,
                notes: contribution.manualNotes,
                submittedAt: approvedAt,
              },
            });
          }
        } else {
          const payment = await tx.payment.create({
            data: {
              registrationId: existingRegistration.id,
              provider: manualMethod,
              amount: approvedAmountPence,
              currency: "GBP",
              status: paymentStatus,
              manualNotes: adminPaymentNote,
              paidAt: isFullScholarship ? approvedAt : null,
              rawPayloadJson: {
                source: "FREE_WARRIOR_APPLICATION",
                applicationId: application.id,
                contributionPreference: contribution.contributionPreference,
                monthlyContributionPkr: contribution.monthlyContributionPkr,
                monthlyContributionGbp: contribution.monthlyContributionGbp,
              },
            },
          });

          if (!isFullScholarship && contribution.senderName && contribution.senderNumber && contribution.referenceKey) {
            await tx.manualPaymentSubmission.create({
              data: {
                paymentId: payment.id,
                method: manualMethod,
                senderName: contribution.senderName,
                senderNumber: contribution.senderNumber,
                referenceKey: contribution.referenceKey,
                notes: contribution.manualNotes,
                submittedAt: approvedAt,
              },
            });
          }
        }
      }

    const changed = await tx.freeWarriorApplication.updateMany({
      where: { id: application.id, status: FreeWarriorApplicationStatus.PENDING },
      data: {
        status: FreeWarriorApplicationStatus.APPROVED,
        reviewNote: input.note || null,
        reviewedAt: new Date(),
        approvedUserId: user.id,
      },
    });

    if (!changed.count) throw new Error("This application has already been reviewed.");
    return {
      application: await tx.freeWarriorApplication.findUniqueOrThrow({ where: { id: application.id } }),
      user,
      registrationId,
      temporaryPassword: createdNewUser ? temporaryPassword : null,
      contribution,
      scholarshipReference,
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
        <p>${
          isFullScholarship
            ? "Your scholarship has been fully waived and your student access is now active."
            : `Your reduced monthly contribution has been approved at <strong>${contribution.amountLabel}</strong>. Your order is now awaiting admin payment confirmation.`
        }</p>
        ${
          result.temporaryPassword
            ? `<p>Temporary password: <strong>${result.temporaryPassword}</strong></p>`
            : isFullScholarship
              ? "<p>Your existing account has been activated for this course.</p>"
              : "<p>Your existing account is ready. Access will be activated after payment confirmation.</p>"
        }
        <p>${
          isFullScholarship
            ? "You can log in and access your dashboard now."
            : "You can log in now, and the dashboard will unlock fully once admin marks the payment as complete."
        }</p>
      `,
      text: [
        `Assalam-u-Alaikum ${application.fullName},`,
        `Your Fee Waiver application for ${application.courseTitle} has been approved.`,
        isFullScholarship
          ? "Your scholarship has been fully waived and your student access is now active."
          : `Your reduced monthly contribution has been approved at ${contribution.amountLabel}. Your order is now awaiting admin payment confirmation.`,
        result.temporaryPassword
          ? `Temporary password: ${result.temporaryPassword}`
          : isFullScholarship
            ? "Your existing account has been activated for this course."
            : "Your existing account is ready. Access will be activated after payment confirmation.",
        isFullScholarship
          ? "You can log in and access your dashboard now."
          : "You can log in now, and the dashboard will unlock fully once admin marks the payment as complete.",
      ].join("\n"),
    }),
    notifyAdmins({
      subject: `Fee Waiver approved: ${application.fullName}`,
      emailType: "ADMIN_FREE_WARRIOR_APPROVED",
      html: `
        <p>Fee Waiver application approved.</p>
        <p>Name: <strong>${application.fullName}</strong></p>
        <p>Email: ${application.email}</p>
        <p>Contribution: ${contribution.contributionLabel}</p>
        <p>Scholarship reference: ${result.scholarshipReference}</p>
      `,
      text: [
        "Fee Waiver application approved.",
        `Name: ${application.fullName}`,
        `Email: ${application.email}`,
        `Contribution: ${contribution.contributionLabel}`,
        `Scholarship reference: ${result.scholarshipReference}`,
      ].join("\n"),
    }),
  ]);

  return result.application;
}
