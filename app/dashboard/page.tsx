import { redirect } from "next/navigation";
import StudentDashboard from "@/components/dashboard/student-dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { reconcileMissingStripeSubscriptions } from "@/services/payment.service";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  await reconcileMissingStripeSubscriptions({ userId: user.id, limit: 10 });
  const refreshedUser = await getCurrentUser();
  if (!refreshedUser) {
    redirect("/login");
  }

  return (
    <StudentDashboard
      user={{
        id: refreshedUser.id,
        fullName: refreshedUser.fullName,
        email: refreshedUser.email,
        phoneCountryCode: refreshedUser.phoneCountryCode,
        phoneNumber: refreshedUser.phoneNumber,
        studentProfile: refreshedUser.studentProfile
          ? {
              countryCode: refreshedUser.studentProfile.countryCode,
              countryName: refreshedUser.studentProfile.countryName,
              timezone: refreshedUser.studentProfile.timezone,
            }
          : null,
        enrollments: refreshedUser.enrollments.map((item) => ({
          status: item.status,
          activatedAt: item.activatedAt ? item.activatedAt.toISOString() : null,
          course: {
            slug: item.course.slug,
            title: item.course.title,
          },
        })),
        registrations: refreshedUser.registrations.map((item) => ({
          id: item.id,
          selectedCurrency: item.selectedCurrency,
          finalAmount: item.finalAmount,
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
                status: item.payment.status,
                paidAt: item.payment.paidAt ? item.payment.paidAt.toISOString() : null,
              }
            : null,
        })),
        subscriptions: refreshedUser.subscriptions.map((item) => ({
          status: item.status,
          currentPeriodEnd: item.currentPeriodEnd ? item.currentPeriodEnd.toISOString() : null,
          cancelAtPeriodEnd: item.cancelAtPeriodEnd,
        })),
      }}
    />
  );
}
