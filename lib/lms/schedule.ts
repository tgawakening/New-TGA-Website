import "server-only";
import { Prisma, type LmsSessionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAssignedHost, joinWindow, sirahStudentCohortAccess, type JoinWindow } from "./access";
import { sessionEnd } from "./sessions";

/**
 * Read-side queries for the LMS pages (admin, student schedule, teacher
 * portal). Every query selects SESSION_VIEW_SELECT, which leaves out
 * joinUrlEncrypted and passcodeEncrypted: no page ever receives the Zoom join
 * URL or passcode, encrypted or not. Students reach Zoom only through
 * /api/sirah/lms/sessions/[id]/join, hosts through .../start.
 */

export const SESSION_VIEW_SELECT = {
  id: true,
  cohortId: true,
  title: true,
  startsAt: true,
  durationMin: true,
  status: true,
  zoomMeetingId: true,
  zoomHost: { select: { id: true, email: true, licensed: true, active: true } },
} satisfies Prisma.LmsSessionSelect;

type SessionRow = Prisma.LmsSessionGetPayload<{ select: typeof SESSION_VIEW_SELECT }>;

export type SessionPhase = "upcoming" | "live" | "past" | "cancelled";

export type SessionView = {
  id: string;
  cohortId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  durationMin: number;
  status: LmsSessionStatus;
  phase: SessionPhase;
  /** Zoom meeting exists (the number is safe to show staff; it is not the link). */
  zoomMeetingId: string | null;
  host: { id: string; email: string; licensed: boolean; active: boolean };
  joinPath: string;
  startPath: string;
};

export const joinPath = (id: string) => `/api/sirah/lms/sessions/${encodeURIComponent(id)}/join`;
export const startPath = (id: string) => `/api/sirah/lms/sessions/${encodeURIComponent(id)}/start`;

export function phaseOf(session: { status: LmsSessionStatus; startsAt: Date; durationMin: number }, now = new Date()): SessionPhase {
  if (session.status === "CANCELLED") return "cancelled";
  if (session.status === "ENDED" || sessionEnd(session) <= now) return "past";
  if (session.status === "LIVE" || session.startsAt <= now) return "live";
  return "upcoming";
}

function toView(row: SessionRow, now: Date): SessionView {
  return {
    id: row.id,
    cohortId: row.cohortId,
    title: row.title,
    startsAt: row.startsAt,
    endsAt: sessionEnd(row),
    durationMin: row.durationMin,
    status: row.status,
    phase: phaseOf(row, now),
    zoomMeetingId: row.zoomMeetingId,
    host: row.zoomHost,
    joinPath: joinPath(row.id),
    startPath: startPath(row.id),
  };
}

/** Upcoming (soonest first) and past (latest first). Cancelled sessions stay in upcoming while their time is ahead. */
export function splitSessions(views: SessionView[], now = new Date()) {
  const upcoming = views
    .filter((v) => v.phase === "upcoming" || v.phase === "live" || (v.phase === "cancelled" && v.endsAt > now))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const past = views
    .filter((v) => v.phase === "past" || (v.phase === "cancelled" && v.endsAt <= now))
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  return { upcoming, past };
}

/** Read-only rollout check: false until the LMS migrations are deployed. Never creates tables. */
export async function lmsSessionsAvailable() {
  try {
    await prisma.lmsSession.findFirst({ select: { id: true } });
    await prisma.sessionJoinIntent.findFirst({ select: { id: true } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return false;
    throw error;
  }
}

// ── Admin ──────────────────────────────────────────────────────────────────

export type JoinCounts = { students: number; joins: number };

/** Join-intent totals per session: distinct students and total redirects. */
export async function joinCounts(sessionIds: string[]): Promise<Map<string, JoinCounts>> {
  const counts = new Map<string, JoinCounts>();
  if (!sessionIds.length) return counts;
  const [totals, distinct] = await Promise.all([
    prisma.sessionJoinIntent.groupBy({ by: ["sessionId"], where: { sessionId: { in: sessionIds } }, _count: { _all: true } }),
    prisma.sessionJoinIntent.findMany({
      where: { sessionId: { in: sessionIds } },
      distinct: ["sessionId", "userId"],
      select: { sessionId: true },
    }),
  ]);
  for (const row of totals) counts.set(row.sessionId, { students: 0, joins: row._count._all });
  for (const row of distinct) {
    const entry = counts.get(row.sessionId) ?? { students: 0, joins: 0 };
    entry.students += 1;
    counts.set(row.sessionId, entry);
  }
  return counts;
}

export async function adminSessionsForCohort(cohortId: string, now = new Date()) {
  const rows = await prisma.lmsSession.findMany({ where: { cohortId }, select: SESSION_VIEW_SELECT, orderBy: { startsAt: "asc" } });
  const views = rows.map((row) => toView(row, now));
  return { ...splitSessions(views, now), counts: await joinCounts(views.map((v) => v.id)) };
}

export function listCohorts() {
  return prisma.sirahCohort.findMany({ select: { batchCode: true, commencementAt: true }, orderBy: { batchCode: "asc" } });
}

export function listActiveHosts() {
  return prisma.zoomHost.findMany({ where: { active: true }, select: { id: true, email: true, licensed: true }, orderBy: { email: "asc" } });
}

// ── Student ────────────────────────────────────────────────────────────────

export type StudentSessionView = SessionView & { window: JoinWindow; joinable: boolean };

/**
 * The signed-in student's live classes: the existing paid + active rule
 * (lib/lms/access, the same one the join route enforces) decides access and
 * the cohort. Not allowed -> no sessions are read at all.
 */
export async function studentSchedule(userId: string, now = new Date()) {
  const access = await sirahStudentCohortAccess(userId, now);
  if (!access.allowed || !access.cohortId) return { allowed: false as const, cohortId: null, upcoming: [], past: [], next: null };
  const rows = await prisma.lmsSession.findMany({
    where: { cohortId: access.cohortId },
    select: SESSION_VIEW_SELECT,
    orderBy: { startsAt: "asc" },
  });
  const views: StudentSessionView[] = rows.map((row) => {
    const view = toView(row, now);
    const window = joinWindow(row, now);
    return { ...view, window, joinable: view.phase !== "cancelled" && view.phase !== "past" && window === "open" && Boolean(row.zoomMeetingId) };
  });
  const { upcoming, past } = splitSessions(views, now) as { upcoming: StudentSessionView[]; past: StudentSessionView[] };
  const next = upcoming.find((v) => v.phase !== "cancelled") ?? null;
  return { allowed: true as const, cohortId: access.cohortId, upcoming, past, next };
}

// ── Teacher ────────────────────────────────────────────────────────────────

/** Active ZoomHosts whose email is this account's (the start route's rule). Empty -> not a teacher. */
export async function hostsForIdentity(identity: { email: string } | null) {
  if (!identity) return [];
  const hosts = await prisma.zoomHost.findMany({ where: { active: true }, select: { id: true, email: true, active: true } });
  return hosts.filter((host) => isAssignedHost(identity, host));
}

export async function teacherSessions(hostIds: string[], now = new Date()) {
  if (!hostIds.length) return { upcoming: [], past: [] };
  const rows = await prisma.lmsSession.findMany({
    where: { zoomHostId: { in: hostIds } },
    select: SESSION_VIEW_SELECT,
    orderBy: { startsAt: "asc" },
  });
  return splitSessions(
    rows.map((row) => toView(row, now)),
    now,
  );
}
