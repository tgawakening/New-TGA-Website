import "server-only";
import { cookies } from "next/headers";
import { VIEWER_TZ_COOKIE, cleanTimeZone } from "./viewer-zone";

/** The zone the viewer's browser reported, or null before it has reported one. */
export async function viewerTimeZone(): Promise<string | null> {
  return cleanTimeZone((await cookies()).get(VIEWER_TZ_COOKIE)?.value);
}
