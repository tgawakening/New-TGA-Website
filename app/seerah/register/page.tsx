import { sirahSchemaAvailable } from "@/lib/sirah/readiness";
import { countries } from "countries-list";
import { redirect } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { IndigoRoot, INDIGO_THEME_COLOR } from "@/components/indigo/indigo-root";
import { RegisterPage } from "@/components/indigo/register/register-page";
import { detectedResidence } from "@/lib/sirah/geolocation";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";

export const metadata: Metadata = {
  title: `Register | ${SIRAH_TITLE}`,
  robots: { index: false, follow: false },
};

/* As app/seerah/layout.tsx: the form's sticky bars use the safe-area insets. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: INDIGO_THEME_COLOR,
};

export default async function SirahRegisterPage({
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
    if (!registration) redirect("/seerah/register");
  }
  // A dedicated page: no course landing page behind it and no dialog. The
  // form reads ?order=, #payment= and the session itself, exactly as before.
  // A visit with no ?country= starts from the detected country.
  return (
    <IndigoRoot>
      <RegisterPage
        initialCountry={initialCountry}
        initialPlan={initialPlan}
        requireBillingCountry={Boolean(params.country && !initialCountry)}
        detectedCountry={params.country ? undefined : await detectedResidence()}
        resumeId={resume}
      />
    </IndigoRoot>
  );
}
