import { sirahSchemaAvailable } from "@/lib/sirah/readiness";
import { prisma } from "@/lib/prisma";
import { SIRAH_PRICING_VERSION } from "@/lib/sirah/catalog";
import { redirect } from "next/navigation";
import StudentDashboard from "@/components/dashboard/student-dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { getPaymentPlanTypeFromSnapshot } from "@/lib/course-payment";
import {
  processDueManualSubscriptions,
  reconcileMissingStripeSubscriptions,
} from "@/services/payment.service";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  await processDueManualSubscriptions();
  await reconcileMissingStripeSubscriptions({ userId: user.id, limit: 10 });
  const refreshedUser = await getCurrentUser();
  if (!refreshedUser) {
    redirect("/login");
  }

  const currentRegistrationIds = new Set(
    refreshedUser.registrations
      .filter(
        (item) =>
          (item.pricingSnapshot as { pricingVersion?: string } | null)
            ?.pricingVersion === SIRAH_PRICING_VERSION,
      )
      .map((item) => item.id),
  );
  const legacyRegistrations = refreshedUser.registrations.filter(
    (item) => !currentRegistrationIds.has(item.id),
  );
  const hasCurrent =
    (await sirahSchemaAvailable()) &&
    (await prisma.sirahOrder.count({ where: { userId: refreshedUser.id } })) >
      0;
  return (
    <StudentDashboard
      user={{
        id: refreshedUser.id,
        currentSirahOnly:
          hasCurrent &&
          !legacyRegistrations.some(
            (item) => item.course.slug === "seerah-course",
          ),
        fullName: refreshedUser.fullName,
        email: refreshedUser.email,
        phoneCountryCode: refreshedUser.phoneCountryCode,
        phoneNumber: refreshedUser.phoneNumber,
        canManageStripeBilling: refreshedUser.subscriptions.some(
          (item) =>
            item.provider === "STRIPE" &&
            Boolean(item.providerCustomerId) &&
            item.status !== "CANCELED",
        ),
        studentProfile: refreshedUser.studentProfile
          ? {
              countryCode: refreshedUser.studentProfile.countryCode,
              countryName: refreshedUser.studentProfile.countryName,
              timezone: refreshedUser.studentProfile.timezone,
            }
          : null,
        enrollments: refreshedUser.enrollments
          .filter((item) => !currentRegistrationIds.has(item.registrationId))
          .map((item) => ({
            status: item.status,
            activatedAt: item.activatedAt
              ? item.activatedAt.toISOString()
              : null,
            course: {
              slug: item.course.slug,
              title: item.course.title,
            },
          })),
        registrations: legacyRegistrations.map((item) => ({
          id: item.id,
          selectedCurrency: item.selectedCurrency,
          finalAmount: item.finalAmount,
          paymentPlanType: getPaymentPlanTypeFromSnapshot(item.pricingSnapshot),
          status: item.status,
          paymentMethod: item.paymentMethod,
          paymentReference: item.paymentReference,
          createdAt: item.createdAt.toISOString(),
          course: {
            slug: item.course.slug,
            title: item.course.title,
          },
          payment: item.payment
            ? {
                amount: item.payment.amount,
                currency: item.payment.currency,
                status: item.payment.status,
                paidAt: item.payment.paidAt
                  ? item.payment.paidAt.toISOString()
                  : null,
              }
            : null,
        })),
        subscriptions: refreshedUser.subscriptions.map((item) => ({
          status: item.status,
          currentPeriodEnd: item.currentPeriodEnd
            ? item.currentPeriodEnd.toISOString()
            : null,
          cancelAtPeriodEnd: item.cancelAtPeriodEnd,
        })),
      }}
    />
  );
}
