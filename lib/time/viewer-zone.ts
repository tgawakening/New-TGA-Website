/** The viewer's own IANA time zone, as their browser reports it. The browser
 * writes it to this cookie (components/viewer-time-zone-sync.tsx) and the
 * server reads it back (lib/time/viewer-zone.server.ts), so server-rendered
 * class times are shown in the viewer's zone, not a site default. */
export const VIEWER_TZ_COOKIE = "tga_tz";

/** A usable IANA zone name, or null. Never throws. */
export function cleanTimeZone(value: string | null | undefined): string | null {
  if (!value || value.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(value)) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** "Pakistan Standard Time" for Asia/Karachi; the zone id when Intl has no name. */
export function timeZoneLongName(timeZone: string, at = new Date()) {
  return (
    new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "long" }).formatToParts(at).find((part) => part.type === "timeZoneName")
      ?.value || timeZone
  );
}
