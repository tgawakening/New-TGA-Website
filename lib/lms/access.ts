import "server-only";
import type { LmsSession, ZoomHost } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SIRAH_BATCH, SIRAH_SLUG } from "@/lib/sirah/catalog";
import { sirahEnrolmentAllows } from "@/lib/sirah/classroom";
import { canAccessSirah } from "@/services/sirah-confirmation.service";

/**
 * Who may join or start a live session.
 *
 * Students: the existing Sīrah rule (paid + active) used by the classroom and
 * /seerah/lms (sirahEnrolmentAllows over the latest non-archived Sīrah order
 * and the legacy Enrollment, with canAccessSirah deciding whether the order
 * grants access), then scoped to the session's cohort: the order's batchCode
 * must equal LmsSession.cohortId. A student admitted only by a legacy
 * Enrollment (no order) belongs to the catalog batch, SIRAH_BATCH, since
 * legacy enrolments predate cohorts.
 */

export const JOIN_OPENS_MINUTES_BEFORE = 15;

export type JoinWindow = "not_open" | "open" | "ended";

/** Open from 15 minutes before startsAt until startsAt + durationMin (exclusive). */
export function joinWindow(session: Pick<LmsSession, "startsAt" | "durationMin">, now = new Date()): JoinWindow {
  const opens = session.startsAt.getTime() - JOIN_OPENS_MINUTES_BEFORE * 60_000;
  const ends = session.startsAt.getTime() + session.durationMin * 60_000;
  if (now.getTime() < opens) return "not_open";
  if (now.getTime() >= ends) return "ended";
  return "open";
}

export const joinOpensAt = (session: Pick<LmsSession, "startsAt">) =>
  new Date(session.startsAt.getTime() - JOIN_OPENS_MINUTES_BEFORE * 60_000);

/** The paid + active rule for this user, plus the cohort it applies to. */
export async function sirahStudentCohortAccess(userId: string, now = new Date()) {
  const [enrollment, order] = await Promise.all([
    prisma.enrollment.findFirst({ where: { userId, course: { slug: SIRAH_SLUG } }, select: { status: true, registrationId: true } }),
    prisma.sirahOrder.findFirst({ where: { userId, course: { slug: SIRAH_SLUG }, archivedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);
  const allowed = sirahEnrolmentAllows({ enrollment, order, orderGrantsAccess: Boolean(order && canAccessSirah(order, now)) });
  return { allowed, cohortId: allowed ? (order?.batchCode ?? SIRAH_BATCH) : null };
}

export async function studentMayJoinCohort(userId: string, cohortId: string, now = new Date()) {
  const access = await sirahStudentCohortAccess(userId, now);
  return access.allowed && access.cohortId === cohortId;
}

/** The session's assigned host: a signed-in account whose email is the active ZoomHost's email. */
export function isAssignedHost(identity: { email: string } | null, host: Pick<ZoomHost, "email" | "active">) {
  return Boolean(identity && host.active && identity.email.trim().toLowerCase() === host.email.trim().toLowerCase());
}

/** Only redirect to Zoom's own HTTPS hosts, whatever the stored or fetched URL says. */
export function isZoomUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && ["zoom.us", "zoomgov.com"].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}
