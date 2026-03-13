import { redirect } from "next/navigation";
import StudentDashboard from "@/components/dashboard/student-dashboard";
import { getCurrentUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <StudentDashboard
      user={{
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneCountryCode: user.phoneCountryCode,
        phoneNumber: user.phoneNumber,
        studentProfile: user.studentProfile
          ? {
              countryCode: user.studentProfile.countryCode,
              countryName: user.studentProfile.countryName,
              timezone: user.studentProfile.timezone,
            }
          : null,
        enrollments: user.enrollments.map((item) => ({
          status: item.status,
          activatedAt: item.activatedAt ? item.activatedAt.toISOString() : null,
          course: {
            slug: item.course.slug,
            title: item.course.title,
          },
        })),
        registrations: user.registrations.map((item) => ({
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
        subscriptions: user.subscriptions.map((item) => ({
          status: item.status,
          currentPeriodEnd: item.currentPeriodEnd ? item.currentPeriodEnd.toISOString() : null,
          cancelAtPeriodEnd: item.cancelAtPeriodEnd,
        })),
      }}
    />
  );
}
