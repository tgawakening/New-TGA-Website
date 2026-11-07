import "server-only";
import { headers } from "next/headers";
import { isIP } from "node:net";
import { open, type CountryResponse, type Reader } from "maxmind";
import { validResidence } from "./residence";
let database: Promise<Reader<CountryResponse>> | undefined;
// Trust must be configured by the operator at the edge; arbitrary incoming headers
// are never sufficient to identify a deployment or a visitor's residence.
export async function detectedResidence(): Promise<string | undefined> {
  return countryFromTrustedHeaders(
    await headers(),
    process.env.SIRAH_GEO_PROVIDER ||
      (process.env.VERCEL === "1" ? "VERCEL" : undefined),
    process.env.SIRAH_GEOIP_DATABASE_PATH,
  );
}
export async function countryFromTrustedHeaders(
  h: Pick<Headers, "get">,
  mode?: string,
  path?: string,
): Promise<string | undefined> {
  const country =
    mode === "CLOUDFLARE"
      ? h.get("cf-ipcountry")
      : mode === "VERCEL"
        ? h.get("x-vercel-ip-country")
        : null;
  if (country && validResidence(country.toUpperCase()))
    return country.toUpperCase();
  const ip =
    mode === "APP_PLATFORM" || mode === "CLOUDFLARE"
      ? h.get("do-connecting-ip")
      : mode === "DROPLET"
        ? h.get("x-real-ip")
        : null;
  if (!ip || !isIP(ip) || !path) return undefined;
  try {
    database ||= open<CountryResponse>(path);
    const code = (await database).get(ip)?.country?.iso_code;
    return validResidence(code) ? code : undefined;
  } catch {
    database = undefined;
    return undefined;
  }
}
