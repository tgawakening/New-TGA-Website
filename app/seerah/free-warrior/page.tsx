import type { Viewport } from "next";
import { countries } from "countries-list";
import { IndigoRoot, INDIGO_THEME_COLOR } from "@/components/indigo/indigo-root";
import { ScholarshipPage } from "@/components/indigo/scholarship/scholarship-page";
import type { ScholarshipCardOption } from "@/lib/sirah/scholarship-card";
import { scholarshipCardOption } from "@/lib/sirah/scholarship-card";
import { detectedResidence } from "@/lib/sirah/geolocation";

/* /seerah/scholarship and its aliases (/seerah/fee-waiver, /seerah/free-warrior,
 * /seerah/fee-warrior) all render this page. Rendered per request: whether a
 * country may pay by card reads the server's Sīrah Stripe route settings. */
export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: INDIGO_THEME_COLOR };

export default async function ScholarshipRoute() {
  const countryList = Object.entries(countries)
    .map(([code, value]) => ({ code, name: value.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  // Only the countries where the existing Stripe config allows a one-time card
  // checkout reach the browser; the server re-checks on submission.
  const cardOptions: Record<string, ScholarshipCardOption> = {};
  for (const { code } of countryList) {
    const option = scholarshipCardOption(code);
    if (option) cardOptions[code] = option;
  }
  return (
    <IndigoRoot>
      <ScholarshipPage countries={countryList} cardOptions={cardOptions} detectedCountry={await detectedResidence()} />
    </IndigoRoot>
  );
}
