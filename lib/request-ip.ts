import "server-only";
import { isIP } from "node:net";

/**
 * Best-effort client IP for rate-limiting buckets only — never for
 * authorization. Prefers the header the hosting platform sets from the real
 * connection (matching lib/sirah/geolocation.ts), then common proxy headers.
 * Spoofable fallbacks only widen an attacker's own bucketing; the per-email
 * limits remain the real brute-force bound.
 */
export function clientIp(headers: Pick<Headers, "get">): string | null {
  const mode =
    process.env.SIRAH_GEO_PROVIDER ||
    (process.env.VERCEL === "1" ? "VERCEL" : undefined);
  const ordered = [
    mode === "CLOUDFLARE" || mode === "APP_PLATFORM"
      ? headers.get("do-connecting-ip")
      : null,
    mode === "DROPLET" ? headers.get("x-real-ip") : null,
    headers.get("x-real-ip"),
    (headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || null,
  ];
  for (const value of ordered) {
    if (!value) continue;
    const ip = value.trim();
    if (isIP(ip)) return ip;
  }
  return null;
}
