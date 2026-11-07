import { headers } from "next/headers";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { countryFromTrustedHeaders } from "@/lib/sirah/geolocation";
import { resolveResidence, validResidence } from "@/lib/sirah/residence";

export const dynamic = "force-dynamic";

// Per-request, country-only diagnostics. Never return/log the client IP or
// environment values such as database paths, keys or connection strings.
export async function GET() {
  const h = await headers();
  const mode =
    process.env.SIRAH_GEO_PROVIDER ||
    (process.env.VERCEL === "1" ? "VERCEL" : undefined);
  const detected = await countryFromTrustedHeaders(
    h,
    mode,
    process.env.SIRAH_GEOIP_DATABASE_PATH,
  );
  const cfCountry = h.get("cf-ipcountry")?.toUpperCase();
  return NextResponse.json(
    {
      suggestedCountry: resolveResidence(null, null, detected),
      detected: Boolean(detected),
      provider: mode || "UNCONFIGURED",
      signals: {
        // Presence alone does not make this a trusted pricing-country source.
        cfIpCountry: validResidence(cfCountry) ? cfCountry : null,
        doConnectingIpPresent: Boolean(isIP(h.get("do-connecting-ip") || "")),
      },
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
