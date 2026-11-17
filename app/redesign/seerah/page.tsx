import type { Metadata } from "next";
import { previewLinks } from "@/components/indigo/site-links";
import { countries } from "countries-list";
import { SeerahPage } from "@/components/indigo/seerah/seerah-page";
import { activeCampaign } from "@/components/seerah/course-config";
import { methodAvailable } from "@/lib/sirah/config";
import { detectedResidence } from "@/lib/sirah/geolocation";
import { planAvailability } from "@/lib/sirah/payment-display";

/* Hidden preview of the redesigned Sīrah course page. Not linked from the
 * live site; noindex here and in app/redesign/layout.tsx. The live /seerah is
 * unchanged. Server wiring is identical to app/seerah/page.tsx. */
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sīrah: Beyond Chronology · preview",
  robots: { index: false, follow: false },
};

// Admin custom payment links return to …?payment=received&reference=…
const SIRAH_REFERENCE = /^SIRAH-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

// Built here so the country dataset never ships to the browser.
const countryOptions = Object.entries(countries)
  .map(([code, c]) => [code, c.name] as [string, string])
  .sort((a, b) => a[1].localeCompare(b[1]));

export default async function RedesignSeerahPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; reference?: string }>;
}) {
  const params = await searchParams;
  const paymentReceived =
    params.payment === "received"
      ? { reference: params.reference && SIRAH_REFERENCE.test(params.reference) ? params.reference : null }
      : undefined;
  return (
    <SeerahPage
      visitorCountry={await detectedResidence()}
      availability={planAvailability()}
      initialCampaign={activeCampaign()}
      pakistanOnlineAvailable={
        methodAvailable("STRIPE", "PK", "PKR", "MONTHLY") || methodAvailable("PAYPAL", "PK", "PKR", "MONTHLY")
      }
      paymentReceived={paymentReceived}
      countryOptions={countryOptions}
      site={previewLinks}
    />
  );
}
