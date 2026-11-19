import type { Metadata, Viewport } from "next";
import { countries } from "countries-list";
import { IndigoRoot, INDIGO_THEME_COLOR } from "@/components/indigo/indigo-root";
import { SeerahPage } from "@/components/indigo/seerah/seerah-page";
import { activeCampaign, courseConfig } from "@/components/seerah/course-config";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import { methodAvailable } from "@/lib/sirah/config";
import { detectedResidence } from "@/lib/sirah/geolocation";
import { planAvailability } from "@/lib/sirah/payment-display";

export const dynamic = "force-dynamic";

const title = `${SIRAH_TITLE} | The Global Awakening`;
const description =
  "Study the life of the Prophet ﷺ through sources, decisions and community. Explore law, power, leadership and movement with The Global Awakening.";
const artwork = courseConfig.socialImage || courseConfig.hero;
const images = artwork
  ? [
      {
        url: artwork.src,
        width: artwork.width,
        height: artwork.height,
        alt: artwork.alt,
      },
    ]
  : [];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/seerah" },
  openGraph: { title, description, url: "/seerah", images },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: images.map((image) => image.url),
  },
};

/* As app/seerah/layout.tsx, plus the Indigo theme colour. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: INDIGO_THEME_COLOR,
};

// Admin custom payment links return to /seerah?payment=received&reference=…
// The reference is shown only in the exact format those links produce.
const SIRAH_REFERENCE = /^SIRAH-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

// Built here so the country dataset never ships to the browser.
const countryOptions = Object.entries(countries)
  .map(([code, c]) => [code, c.name] as [string, string])
  .sort((a, b) => a[1].localeCompare(b[1]));

export default async function SeerahRoute({
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
    <IndigoRoot>
      <SeerahPage
        visitorCountry={await detectedResidence()}
        availability={planAvailability()}
        initialCampaign={activeCampaign()}
        pakistanOnlineAvailable={
          methodAvailable("STRIPE", "PK", "PKR", "MONTHLY") || methodAvailable("PAYPAL", "PK", "PKR", "MONTHLY")
        }
        paymentReceived={paymentReceived}
        countryOptions={countryOptions}
      />
    </IndigoRoot>
  );
}
