import { sirahSchemaAvailable } from "@/lib/sirah/readiness";
import { countries } from "countries-list";
import { redirect } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import LegacyRegistration from "@/components/sirah/legacy-registration";
import { RegisterPage } from "@/components/indigo/register/register-page";
import { previewLinks } from "@/components/indigo/site-links";
import { detectedResidence } from "@/lib/sirah/geolocation";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";

/* Hidden preview of the redesigned Sīrah registration. Not linked from the
 * live site; noindex here and in app/redesign/layout.tsx. The server logic
 * is app/seerah/register/page.tsx line for line (resume, country, plan,
 * billing-country flag), with two differences: a resume link that does not
 * belong to you returns to this preview instead of the live page, and a visit
 * with no ?country= starts from the detected country. */
export const metadata: Metadata = {
  title: `Register | ${SIRAH_TITLE} · preview`,
  robots: { index: false, follow: false },
};

/* As app/seerah/layout.tsx: the form's sticky bars use the safe-area insets. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141d33",
};

export default async function RedesignRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string; country?: string; plan?: string }>;
}) {
  const params = await searchParams;
  const resume = params.resume;
  const country = params.country?.toUpperCase();
  const initialCountry = country && Object.hasOwn(countries, country) ? country : undefined;
  const initialPlan = params.plan === "ANNUAL" ? "ANNUAL" : params.plan === "MONTHLY" ? "MONTHLY" : undefined;
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
    if (!registration) redirect("/redesign/register");
    return <LegacyRegistration />;
  }
  return (
    <RegisterPage
      initialCountry={initialCountry}
      initialPlan={initialPlan}
      requireBillingCountry={Boolean(params.country && !initialCountry)}
      detectedCountry={params.country ? undefined : await detectedResidence()}
      site={previewLinks}
    />
  );
}
