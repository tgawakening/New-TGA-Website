import "server-only";
import { cookies } from "next/headers";
import { VIEWER_TZ_COOKIE, cleanTimeZone } from "./viewer-zone";

/** The zone the viewer's browser reported, or null before it has reported one.
 * Also null outside a request scope (cookies() throws there, e.g. when a page
 * is rendered by a test or at build time), so callers fall back as usual. */
export async function viewerTimeZone(): Promise<string | null> {
  try {
    return cleanTimeZone((await cookies()).get(VIEWER_TZ_COOKIE)?.value);
  } catch {
    return null;
  }
}
