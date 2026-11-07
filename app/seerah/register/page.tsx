import { detectedResidence } from "@/lib/sirah/geolocation";
import { sirahSchemaAvailable } from "@/lib/sirah/readiness";
import { countries } from "countries-list";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import LegacyRegistration from "@/components/sirah/legacy-registration";
import type { Metadata } from "next";
import SeerahPage from "@/components/seerah/seerah-page";
import { activeCampaign } from "@/components/seerah/course-config";
import { planAvailability } from "@/lib/sirah/payment-display";
import { methodAvailable } from "@/lib/sirah/config";
import { sirahFont } from "@/lib/sirah/font";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
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
    <div className={sirahFont.variable}>
      <SeerahPage
        initialCampaign={activeCampaign()}
        visitorCountry={await detectedResidence()}
        availability={planAvailability()}
        pakistanOnlineAvailable={methodAvailable(
          "STRIPE",
          "PK",
          "PKR",
          "MONTHLY",
        )}
        registrationEntry={{ country: initialCountry, plan: initialPlan, requireBillingCountry: Boolean(params.country && !initialCountry) }}
      />
    </div>
  );
}
