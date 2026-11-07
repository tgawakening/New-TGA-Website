import { sirahSchemaAvailable } from "@/lib/sirah/readiness";
import { countries } from "countries-list";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import LegacyRegistration from "@/components/sirah/legacy-registration";
import type { Metadata } from "next";
import Link from "next/link";
import { sirahFont } from "@/lib/sirah/font";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import { SirahRegistrationForm } from "@/components/sirah/registration-form";
import styles from "@/components/sirah/registration.module.css";
export const metadata: Metadata = {
  title: `Register | ${SIRAH_TITLE}`,
  robots: { index: false, follow: false },
};
export default async function SirahRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string; country?: string; plan?: string }>;
}) {
  const params = await searchParams;
  const resume = params.resume;
  const country = params.country?.toUpperCase();
  const initialCountry =
    country && Object.hasOwn(countries, country) ? country : undefined;
  const initialPlan =
    params.plan === "ANNUAL"
      ? "ANNUAL"
      : params.plan === "MONTHLY"
        ? "MONTHLY"
        : undefined;
  if (resume) {
    const user = await getCurrentUser();
    if (!user || user.status !== "ACTIVE") redirect("/login");
    const registration = await prisma.registration.findFirst({
      where: {
        id: resume,
        userId: user.id,
        course: { slug: "seerah-course" },
        ...((await sirahSchemaAvailable()) ? { sirahOrder: null } : {}),
      },
      select: { id: true },
    });
    if (!registration) redirect("/seerah/register");
    return <LegacyRegistration />;
  }
  return (
    <main className={`${styles.page} ${sirahFont.variable}`}>
      <Link href="/seerah">← Back to the course</Link>
      <SirahRegistrationForm
        initialCountry={initialCountry}
        initialPlan={initialPlan}
        requireBillingCountry={Boolean(params.country && !initialCountry)}
      />
    </main>
  );
}
