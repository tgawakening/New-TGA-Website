import "server-only";
import { prisma } from "@/lib/prisma";
import { getUser, ZOOM_LICENSED_USER_TYPE, type ZoomUser } from "@/lib/zoom/client";
import { zoomApiEnv } from "@/lib/zoom/env";

/**
 * Zoom host registration. Sessions are created under a ZoomHost row, which
 * mirrors one Zoom user on the account (resolved through the users API so the
 * stored zoomUserId and licensed flag come from Zoom, not from config).
 */

export type ResolvedZoomHost = { zoomUserId: string; email: string; licensed: boolean };

export function toResolvedHost(user: ZoomUser): ResolvedZoomHost {
  return { zoomUserId: user.id, email: user.email, licensed: user.type === ZOOM_LICENSED_USER_TYPE };
}

/** Look up ZOOM_DEFAULT_HOST_USER_ID (a Zoom user ID or email) in Zoom. Reads only. */
export async function resolveDefaultZoomHost(): Promise<ResolvedZoomHost> {
  const { ZOOM_DEFAULT_HOST_USER_ID } = zoomApiEnv();
  return toResolvedHost(await getUser(ZOOM_DEFAULT_HOST_USER_ID));
}

/**
 * Create or refresh the ZoomHost for ZOOM_DEFAULT_HOST_USER_ID. Idempotent:
 * keyed on the Zoom user ID, so re-running only refreshes email/licensed and
 * re-activates the row. Writes to whichever database DATABASE_URL points at.
 */
export async function registerDefaultZoomHost() {
  const host = await resolveDefaultZoomHost();
  return prisma.zoomHost.upsert({
    where: { zoomUserId: host.zoomUserId },
    create: { ...host, active: true },
    update: { email: host.email, licensed: host.licensed, active: true },
  });
}
