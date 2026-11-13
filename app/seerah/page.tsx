import { detectedResidence } from "@/lib/sirah/geolocation";
import { planAvailability } from "@/lib/sirah/payment-display";
import { methodAvailable } from "@/lib/sirah/config";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
import type { Metadata } from "next";
import localFont from "next/font/local";
import SeerahPage from "@/components/seerah/seerah-page";
import {
  activeCampaign,
  courseConfig,
} from "@/components/seerah/course-config";

export const dynamic = "force-dynamic";

const montserrat = localFont({
  src: [
    { path: "../../public/fonts/montserrat/montserrat-400.ttf", weight: "400" },
    { path: "../../public/fonts/montserrat/montserrat-500.ttf", weight: "500" },
    { path: "../../public/fonts/montserrat/montserrat-600.ttf", weight: "600" },
    { path: "../../public/fonts/montserrat/montserrat-700.ttf", weight: "700" },
  ],
  variable: "--font-montserrat",
  display: "swap",
});
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

// Admin custom payment links return to /seerah?payment=received&reference=…
// The reference is shown only in the exact format those links produce.
const SIRAH_REFERENCE = /^SIRAH-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

export default async function SeerahRoute({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; reference?: string }>;
}) {
  const params = await searchParams;
  const paymentReceived =
    params.payment === "received"
      ? {
          reference:
            params.reference && SIRAH_REFERENCE.test(params.reference)
              ? params.reference
              : null,
        }
      : undefined;
  const visitorCountry = await detectedResidence();
  return (
    <div className={montserrat.variable}>
      <SeerahPage
        visitorCountry={visitorCountry}
        availability={planAvailability()}
        initialCampaign={activeCampaign()}
        pakistanOnlineAvailable={
          methodAvailable("STRIPE", "PK", "PKR", "MONTHLY") ||
          methodAvailable("PAYPAL", "PK", "PKR", "MONTHLY")
        }
        paymentReceived={paymentReceived}
      />
    </div>
  );
}
