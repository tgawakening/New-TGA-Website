import {
  EnrollmentStatus,
  PaymentMethod,
  PaymentStatus,
  RegistrationStatus,
  type FreeWarriorApplicationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyAdmins, sendTransactionalEmail } from "@/lib/email";
import { adminConfirmManualPayment } from "@/services/payment.service";
import type { AdminRegistrationActionInput } from "@/lib/validations/admin";

function isMissingDatabaseStructureError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return error.code === "P2021" || error.code === "P2022";
}

async function loadMissionSupportForAdmin() {
  try {
    return await prisma.missionSupportDonation.findMany({
      include: { manualSubmission: true },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    if (isMissingDatabaseStructureError(error)) {
      return [];
    }

    throw error;
  }
}

export type AdminDashboardSnapshot = {
  summary: {
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
    revenuePence: number;
    pendingPence: number;
    feeWaivers: number;
    discountedOrders: number;
    studentCount: number;
    missionSupportCount: number;
    missionSupportRevenuePence: number;
  };
  registrations: Array<{
    id: string;
    paymentReference: string | null;
    createdAt: string;
    updatedAt: string;
    fullName: string;
    email: string;
    phone: string;
    countryName: string;
    courseTitle: string;
    courseSlug: string;
    amountLabel: string;
    rawAmount: number;
    rawCurrency: string;
    paymentMethod: string;
    paymentStatus: string;
    registrationStatus: string;
    enrollmentStatus: string;
    enrollmentActivatedAt: string | null;
    subscriptionStatus: string | null;
    hasDiscount: boolean;
    discountLabel: string | null;
    isFeeWaived: boolean;
    adminState: "COMPLETED" | "PENDING" | "CANCELLED";
    canManuallyComplete: boolean;
    adminNote: string | null;
  }>;
  students: Array<{
    id: string;
    fullName: string;
    email: string;
    phone: string;
    countryName: string | null;
    totalRegistrations: number;
    activeEnrollments: number;
    completedPayments: number;
    scholarshipCount: number;
    latestOrderDate: string | null;
  }>;
  freeWarriorApplications: Array<{
    id: string;
    fullName: string;
    email: string;
    whatsapp: string;
    cityCountry: string;
    occupation: string;
    knowledgeLevel: string;
    reasonForWaiver: string;
    courseTitle: string;
    listedPrice: string;
    status: FreeWarriorApplicationStatus;
    reviewNote: string | null;
    createdAt: string;
    whatDrawsYou: string;
    howItBenefits: string;
    mostInterestingTopic: string;
    whyThisTopic: string;
    canAttendRegularly: string;
    attendedOrientation: boolean;
    adabCommitment: boolean;
    genuineFinancialNeed: boolean;
  }>;
  missionSupportDonations: Array<{
    id: string;
    fullName: string;
    email: string;
    phone: string;
    amountLabel: string;
    rawAmount: number;
    paymentMethod: string;
    status: string;
    paymentReference: string | null;
    countryName: string | null;
    donorMessage: string | null;
    adminNote: string | null;
    createdAt: string;
    hasManualSubmission: boolean;
  }>;
};

export type AdminNotificationItem = {
  id: string;
  kind: "ORDER" | "ENROLLMENT" | "FEE_WAIVER" | "MISSION_SUPPORT";
  title: string;
  message: string;
  createdAt: string;
};

function formatAmount(amount: number, currency: string) {
  if (currency === "GBP") {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
    }).format(amount / 100);
  }

  return `${currency} ${amount.toLocaleString("en-GB")}`;
}

function getAdminOrderState({
  paymentStatus,
  registrationStatus,
  enrollmentStatus,
}: {
  paymentStatus: PaymentStatus;
  registrationStatus: RegistrationStatus;
  enrollmentStatus: EnrollmentStatus;
}) {
  if (
    paymentStatus === PaymentStatus.FAILED ||
    registrationStatus === RegistrationStatus.REJECTED ||
    enrollmentStatus === EnrollmentStatus.CANCELLED
  ) {
    return "CANCELLED" as const;
  }

  if (
    paymentStatus === PaymentStatus.SUCCEEDED ||
    paymentStatus === PaymentStatus.CONFIRMED ||
    registrationStatus === RegistrationStatus.ACTIVE ||
    registrationStatus === RegistrationStatus.PAID ||
    enrollmentStatus === EnrollmentStatus.ACTIVE ||
    enrollmentStatus === EnrollmentStatus.COMPLETED
  ) {
    return "COMPLETED" as const;
  }

  return "PENDING" as const;
}

function getDiscountLabel(row: {
  autoDiscountAmount: number;
  couponDiscountAmount: number;
  couponCode: string | null;
  selectedCountryCode: string;
  selectedCountryName: string;
  pricingSnapshot: unknown;
  finalAmount: number;
}) {
  const labels: string[] = [];
  if (row.autoDiscountAmount > 0) {
    if (["PK", "IN", "AF", "BD"].includes(row.selectedCountryCode)) {
      labels.push("South Asia family discount");
    } else {
      labels.push("Auto discount");
    }
  }

  if (row.couponDiscountAmount > 0) {
    labels.push(row.couponCode ? `Code ${row.couponCode}` : "Coupon");
  }

  if (row.finalAmount === 0) {
    labels.push("Fee waived");
  }

  if (labels.length === 0 && typeof row.pricingSnapshot === "object" && row.pricingSnapshot) {
    const snapshot = row.pricingSnapshot as Record<string, unknown>;
    if (snapshot.mode === "FREE_WARRIOR_SCHOLARSHIP") {
      labels.push("Fee Waiver scholarship");
    }
  }

  return labels.length > 0 ? labels.join(" • ") : null;
}

export async function getAdminDashboardSnapshot(): Promise<AdminDashboardSnapshot> {
  const [registrations, users, applications, missionSupport] = await Promise.all([
    prisma.registration.findMany({
      include: {
        user: true,
        course: true,
        payment: {
          include: {
            manualSubmission: true,
          },
        },
        enrollment: true,
        subscription: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: "STUDENT" },
      include: {
        studentProfile: true,
        registrations: {
          include: { payment: true },
          orderBy: { createdAt: "desc" },
        },
        enrollments: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.freeWarriorApplication.findMany({
      orderBy: { createdAt: "desc" },
    }),
    loadMissionSupportForAdmin(),
  ]);

  const mappedRegistrations = registrations.map((row) => {
    const discountLabel = getDiscountLabel(row);
    const adminState = getAdminOrderState({
      paymentStatus: row.payment?.status ?? PaymentStatus.INITIATED,
      registrationStatus: row.status,
      enrollmentStatus: row.enrollment?.status ?? EnrollmentStatus.PENDING,
    });

    return {
      id: row.id,
      paymentReference: row.paymentReference,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      fullName: row.user.fullName,
      email: row.user.email,
      phone: `${row.user.phoneCountryCode} ${row.user.phoneNumber}`,
      countryName: row.selectedCountryName,
      courseTitle: row.course.title,
      courseSlug: row.course.slug,
      amountLabel: formatAmount(row.finalAmount, row.selectedCurrency),
      rawAmount: row.finalAmount,
      rawCurrency: row.selectedCurrency,
      paymentMethod: row.paymentMethod,
      paymentStatus: row.payment?.status ?? "INITIATED",
      registrationStatus: row.status,
      enrollmentStatus: row.enrollment?.status ?? "PENDING",
      enrollmentActivatedAt: row.enrollment?.activatedAt?.toISOString() ?? null,
      subscriptionStatus: row.subscription?.status ?? null,
      hasDiscount: row.autoDiscountAmount > 0 || row.couponDiscountAmount > 0 || row.finalAmount === 0,
      discountLabel,
      isFeeWaived: row.finalAmount === 0,
      adminState,
      canManuallyComplete:
        row.paymentMethod === PaymentMethod.BANK_TRANSFER || row.paymentMethod === PaymentMethod.JAZZCASH,
      adminNote: row.payment?.manualNotes ?? row.payment?.manualSubmission?.reviewNote ?? null,
    };
  });

  const summary = {
    totalOrders: mappedRegistrations.length,
    completedOrders: mappedRegistrations.filter((item) => item.adminState === "COMPLETED").length,
    pendingOrders: mappedRegistrations.filter((item) => item.adminState === "PENDING").length,
    cancelledOrders: mappedRegistrations.filter((item) => item.adminState === "CANCELLED").length,
    revenuePence: mappedRegistrations
      .filter((item) => item.adminState === "COMPLETED" && item.rawCurrency === "GBP")
      .reduce((sum, item) => sum + item.rawAmount, 0),
    pendingPence: mappedRegistrations
      .filter((item) => item.adminState === "PENDING" && item.rawCurrency === "GBP")
      .reduce((sum, item) => sum + item.rawAmount, 0),
    feeWaivers: mappedRegistrations.filter((item) => item.isFeeWaived).length,
    discountedOrders: mappedRegistrations.filter((item) => item.hasDiscount).length,
    studentCount: users.length,
    missionSupportCount: missionSupport.length,
    missionSupportRevenuePence: missionSupport
      .filter((item) => item.status === PaymentStatus.SUCCEEDED || item.status === PaymentStatus.CONFIRMED)
      .reduce((sum, item) => sum + item.amount, 0),
  };

  return {
    summary,
    registrations: mappedRegistrations,
    students: users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: `${user.phoneCountryCode} ${user.phoneNumber}`,
      countryName: user.studentProfile?.countryName ?? null,
      totalRegistrations: user.registrations.length,
      activeEnrollments: user.enrollments.filter((item) => item.status === EnrollmentStatus.ACTIVE).length,
      completedPayments: user.registrations.filter(
        (item) => item.payment?.status === PaymentStatus.SUCCEEDED || item.payment?.status === PaymentStatus.CONFIRMED,
      ).length,
      scholarshipCount: user.registrations.filter((item) => item.finalAmount === 0).length,
      latestOrderDate: user.registrations[0]?.createdAt.toISOString() ?? null,
    })),
    freeWarriorApplications: applications.map((item) => ({
      id: item.id,
      fullName: item.fullName,
      email: item.email,
      whatsapp: item.whatsapp,
      cityCountry: item.cityCountry,
      occupation: item.occupation,
      knowledgeLevel: item.knowledgeLevel,
      reasonForWaiver: item.reasonForWaiver,
      courseTitle: item.courseTitle,
      listedPrice: item.listedPrice,
      status: item.status,
      reviewNote: item.reviewNote,
      createdAt: item.createdAt.toISOString(),
      whatDrawsYou: item.whatDrawsYou,
      howItBenefits: item.howItBenefits,
      mostInterestingTopic: item.mostInterestingTopic,
      whyThisTopic: item.whyThisTopic,
      canAttendRegularly: item.canAttendRegularly,
      attendedOrientation: item.attendedOrientation,
      adabCommitment: item.adabCommitment,
      genuineFinancialNeed: item.genuineFinancialNeed,
    })),
    missionSupportDonations: missionSupport.map((item) => ({
      id: item.id,
      fullName: item.fullName,
      email: item.email,
      phone: [item.phoneCountryCode, item.phoneNumber].filter(Boolean).join(" ").trim() || "N/A",
      amountLabel: formatAmount(item.amount, item.currency),
      rawAmount: item.amount,
      paymentMethod: item.paymentMethod,
      status: item.status,
      paymentReference: item.paymentReference,
      countryName: item.countryName,
      donorMessage: item.donorMessage,
      adminNote: item.manualNotes ?? item.manualSubmission?.reviewNote ?? null,
      createdAt: item.createdAt.toISOString(),
      hasManualSubmission: Boolean(item.manualSubmission),
    })),
  };
}

export async function getAdminNotifications(limit = 20): Promise<AdminNotificationItem[]> {
  const snapshot = await getAdminDashboardSnapshot();

  const notifications: AdminNotificationItem[] = [
    ...snapshot.registrations.map((row) => ({
      id: `order-${row.id}`,
      kind: "ORDER" as const,
      title: "New order received",
      message: `${row.fullName} placed an order for ${row.courseTitle}.`,
      createdAt: row.createdAt,
    })),
    ...snapshot.registrations
      .filter((row) => row.enrollmentStatus === "ACTIVE" && row.enrollmentActivatedAt)
      .map((row) => ({
        id: `enrollment-${row.id}`,
        kind: "ENROLLMENT" as const,
        title: "New student enrolled",
        message: `${row.fullName} is now enrolled in ${row.courseTitle}.`,
        createdAt: row.enrollmentActivatedAt as string,
      })),
    ...snapshot.freeWarriorApplications.map((row) => ({
      id: `fee-waiver-${row.id}`,
      kind: "FEE_WAIVER" as const,
      title: "New Fee Waiver application",
      message: `${row.fullName} submitted a Fee Waiver application.`,
      createdAt: row.createdAt,
    })),
    ...snapshot.missionSupportDonations.map((row) => ({
      id: `mission-support-${row.id}`,
      kind: "MISSION_SUPPORT" as const,
      title: "New mission support submission",
      message: `${row.fullName} submitted a mission support contribution.`,
      createdAt: row.createdAt,
    })),
  ];

  return notifications
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export async function adminUpdateRegistrationRecord(input: AdminRegistrationActionInput) {
  const registration = await prisma.registration.findUnique({
    where: { id: input.registrationId },
    include: {
      user: true,
      course: true,
      payment: {
        include: {
          manualSubmission: true,
        },
      },
      enrollment: true,
    },
  });

  if (!registration || !registration.payment || !registration.enrollment) {
    throw new Error("Registration record is incomplete.");
  }

  const payment = registration.payment;
  const enrollment = registration.enrollment;

  if (
    input.action === "COMPLETE" &&
    (payment.provider === PaymentMethod.BANK_TRANSFER || payment.provider === PaymentMethod.JAZZCASH) &&
    payment.status === PaymentStatus.UNDER_REVIEW
  ) {
    return adminConfirmManualPayment({
      paymentId: payment.id,
      approve: true,
      note: input.note,
    });
  }

  const now = new Date();

  if (input.action === "COMPLETE") {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: payment.provider === PaymentMethod.STRIPE || payment.provider === PaymentMethod.PAYPAL
            ? PaymentStatus.SUCCEEDED
            : PaymentStatus.CONFIRMED,
          manualNotes: input.note ?? payment.manualNotes,
          paidAt: payment.paidAt ?? now,
        },
      });

      await tx.registration.update({
        where: { id: registration.id },
        data: {
          status: RegistrationStatus.ACTIVE,
        },
      });

      await tx.enrollment.update({
        where: { registrationId: registration.id },
        data: {
          status: EnrollmentStatus.ACTIVE,
          activatedAt: enrollment.activatedAt ?? now,
        },
      });
    });

    await Promise.allSettled([
      sendTransactionalEmail({
        userId: registration.userId,
        to: registration.user.email,
        subject: "Enrollment activated by admin",
        emailType: "ADMIN_STATUS_COMPLETED",
        html: `
          <p>Assalam-u-Alaikum ${registration.user.fullName},</p>
          <p>Your registration for ${registration.course.title} has been marked as completed by admin.</p>
          <p>Reference: <strong>${registration.paymentReference ?? "N/A"}</strong></p>
          <p>Your dashboard access is ready.</p>
        `,
        text: [
          `Assalam-u-Alaikum ${registration.user.fullName},`,
          `Your registration for ${registration.course.title} has been marked as completed by admin.`,
          `Reference: ${registration.paymentReference ?? "N/A"}`,
          "Your dashboard access is ready.",
        ].join("\n"),
      }),
      notifyAdmins({
        subject: `Admin completed order: ${registration.user.fullName}`,
        emailType: "ADMIN_ORDER_COMPLETED",
        html: `<p>Order marked completed by admin for <strong>${registration.user.fullName}</strong>.</p>`,
        text: `Order marked completed by admin for ${registration.user.fullName}.`,
      }),
    ]);

    return { status: "COMPLETED" as const };
  }

  if (input.action === "PENDING") {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status:
            payment.provider === PaymentMethod.BANK_TRANSFER ||
            payment.provider === PaymentMethod.JAZZCASH
              ? PaymentStatus.UNDER_REVIEW
              : PaymentStatus.PENDING,
          manualNotes: input.note ?? payment.manualNotes,
          paidAt: null,
        },
      });

      await tx.registration.update({
        where: { id: registration.id },
        data: {
          status:
            payment.provider === PaymentMethod.BANK_TRANSFER ||
            payment.provider === PaymentMethod.JAZZCASH
              ? RegistrationStatus.MANUAL_REVIEW
              : RegistrationStatus.PENDING_PAYMENT,
        },
      });

      await tx.enrollment.update({
        where: { registrationId: registration.id },
        data: {
          status: EnrollmentStatus.PENDING,
          activatedAt: null,
        },
      });
    });

    return { status: "PENDING" as const };
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        manualNotes: input.note ?? payment.manualNotes,
      },
    });

    await tx.registration.update({
      where: { id: registration.id },
      data: {
        status: RegistrationStatus.REJECTED,
      },
    });

    await tx.enrollment.update({
      where: { registrationId: registration.id },
      data: {
        status: EnrollmentStatus.CANCELLED,
      },
    });
  });

  await Promise.allSettled([
    sendTransactionalEmail({
      userId: registration.userId,
      to: registration.user.email,
      subject: "Registration update from admin",
      emailType: "ADMIN_STATUS_CANCELLED",
      html: `
        <p>Assalam-u-Alaikum ${registration.user.fullName},</p>
        <p>Your registration for ${registration.course.title} has been marked as cancelled.</p>
        <p>Reference: <strong>${registration.paymentReference ?? "N/A"}</strong></p>
        ${input.note ? `<p>Admin note: ${input.note}</p>` : ""}
      `,
      text: [
        `Assalam-u-Alaikum ${registration.user.fullName},`,
        `Your registration for ${registration.course.title} has been marked as cancelled.`,
        `Reference: ${registration.paymentReference ?? "N/A"}`,
        input.note ? `Admin note: ${input.note}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    notifyAdmins({
      subject: `Admin cancelled order: ${registration.user.fullName}`,
      emailType: "ADMIN_ORDER_CANCELLED",
      html: `<p>Order marked cancelled by admin for <strong>${registration.user.fullName}</strong>.</p>`,
      text: `Order marked cancelled by admin for ${registration.user.fullName}.`,
    }),
  ]);

  return { status: "CANCELLED" as const };
}
