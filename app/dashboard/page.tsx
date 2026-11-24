import { sirahSchemaAvailable } from "@/lib/sirah/readiness";
import { orderCycle } from "@/lib/sirah/billing-cycle";
import { prisma } from "@/lib/prisma";
import { SIRAH_PRICING_VERSION, SIRAH_SLUG } from "@/lib/sirah/catalog";
import { redirect } from "next/navigation";
import StudentDashboard from "@/components/dashboard/student-dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { canSeeDashboardAdminLink } from "@/lib/auth/dashboard-admin-link";
import { getPaymentPlanTypeFromSnapshot } from "@/lib/course-payment";
import { hostsForIdentity, lmsSessionsAvailable, studentSchedule } from "@/lib/lms/schedule";
import { lmsContentAvailable } from "@/lib/lms/content";
import { unreadCount } from "@/lib/lms/notifications";
import { INBOX_PATH } from "@/lib/lms/student-phase5";
import { viewerTimeZone } from "@/lib/time/viewer-zone.server";
import { classroomClock } from "@/components/indigo/classroom/clock";
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
  // Read-only: the student's Sīrah bookings, so an unpaid one is visible here.
  const sirahOrders = (await sirahSchemaAvailable())
    ? await prisma.sirahOrder.findMany({
        where: { userId: refreshedUser.id, course: { slug: SIRAH_SLUG }, archivedAt: null },
        select: {
          id: true,
          reference: true,
          plan: true,
          method: true,
          currency: true,
          amountMinor: true,
          paymentState: true,
          enrolmentState: true,
          createdAt: true,
          paidCount: true,
          cancelledAt: true,
          nextBillingAt: true,
          accessEndsAt: true,
          cycleBillingDay: true,
          cycleGraceDay: true,
          cycleFirstDueAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const hasCurrent = sirahOrders.length > 0;
  // Tied to the signed-in account; the admin cookie alone is browser-wide.
  const showAdminLink = canSeeDashboardAdminLink(
    refreshedUser,
    (await getCurrentAdmin())?.email,
  );
  // Teacher portal link: same host-email rule as the portal and the start route.
  const showTeachingLink =
    refreshedUser.status === "ACTIVE" &&
    (await lmsSessionsAvailable()) &&
    (await hostsForIdentity({ email: refreshedUser.email })).length > 0;
  // Read-only, for the Overview's "Your next live class" card and the top
  // bar's bell: the same paid + active rule the classroom pages use (not
  // allowed -> no sessions and no inbox are read).
  const now = new Date();
  const schedule = (await lmsSessionsAvailable()) ? await studentSchedule(refreshedUser.id, now) : null;
  const next = schedule?.allowed ? schedule.next : null;
  const clock = classroomClock((await viewerTimeZone()) ?? refreshedUser.studentProfile?.timezone);
  const nextLiveClass = next
    ? {
        title: next.title,
        startsAt: next.startsAt.toISOString(),
        when: clock.longDate.format(next.startsAt),
        zone: clock.zoneName,
        live: next.phase === "live",
        joinable: next.joinable,
        joinPath: next.joinPath,
      }
    : null;
  const inbox =
    schedule?.allowed && (await lmsContentAvailable())
      ? { href: INBOX_PATH, unread: await unreadCount(refreshedUser.id) }
      : null;
  return (
    <StudentDashboard
      nextLiveClass={nextLiveClass}
      inbox={inbox}
      user={{
        id: refreshedUser.id,
        currentSirahOnly:
          hasCurrent &&
          !legacyRegistrations.some(
            (item) => item.course.slug === "seerah-course",
          ),
        showAdminLink,
        showTeachingLink,
        sirahOrders: sirahOrders.map(
          ({ cycleBillingDay, cycleGraceDay, cycleFirstDueAt, cancelledAt, nextBillingAt, accessEndsAt, ...order }) => ({
            ...order,
            createdAt: order.createdAt.toISOString(),
            cancelled: !!cancelledAt,
            nextBillingAt: nextBillingAt?.toISOString() ?? null,
            accessEndsAt: accessEndsAt?.toISOString() ?? null,
            renewalCycle: orderCycle({ cycleBillingDay, cycleGraceDay, cycleFirstDueAt })
              ? { billingDay: cycleBillingDay!, graceDay: cycleGraceDay! }
              : null,
          }),
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
