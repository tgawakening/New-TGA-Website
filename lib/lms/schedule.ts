import "server-only";
import { Prisma, type LmsSessionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAssignedHost, sirahStudentCohortAccess, studentJoinWindow, type JoinWindow } from "./access";
import { sessionEnd } from "./sessions";
import { coveredMinutes } from "./attendance";

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
  zoomStartedAt: true,
  zoomEndedAt: true,
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
  /** When Zoom reported the meeting started / ended (webhooks), if it has. */
  zoomStartedAt: Date | null;
  zoomEndedAt: Date | null;
  host: { id: string; email: string; licensed: boolean; active: boolean };
  joinPath: string;
  startPath: string;
};

export const joinPath = (id: string) => `/api/sirah/lms/sessions/${encodeURIComponent(id)}/join`;
export const startPath = (id: string) => `/api/sirah/lms/sessions/${encodeURIComponent(id)}/start`;

/** Zoom's own state wins over the clock: LIVE stays live past the scheduled
 * end (an overrun), ENDED is past even before it (an early finish). Without a
 * webhook yet, the scheduled time decides. */
export function phaseOf(session: { status: LmsSessionStatus; startsAt: Date; durationMin: number }, now = new Date()): SessionPhase {
  if (session.status === "CANCELLED") return "cancelled";
  if (session.status === "ENDED") return "past";
  if (session.status === "LIVE") return "live";
  if (sessionEnd(session) <= now) return "past";
  if (session.startsAt <= now) return "live";
  return "upcoming";
}

export type LiveBadge = { text: string; tone: "live" | "neutral" | "warn" };

/** The admin status badge, from the webhook-driven status (not just the clock). */
export function liveBadge(session: Pick<SessionView, "status" | "startsAt" | "endsAt">, now = new Date()): LiveBadge {
  if (session.status === "CANCELLED") return { text: "Cancelled", tone: "neutral" };
  if (session.status === "LIVE") return { text: "Live now", tone: "live" };
  if (session.status === "ENDED") return { text: "Ended", tone: "neutral" };
  if (now < session.startsAt) return { text: "Scheduled", tone: "neutral" };
  if (now < session.endsAt) return { text: "Not started on Zoom", tone: "warn" };
  return { text: "No Zoom start recorded", tone: "warn" };
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
    zoomStartedAt: row.zoomStartedAt,
    zoomEndedAt: row.zoomEndedAt,
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
    // LIVE (the host has started) opens Join even before the scheduled window.
    const window = studentJoinWindow(row, now);
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

// ── Attendance (admin) ─────────────────────────────────────────────────────

export type AttendanceStretch = { joinedAt: Date; leftAt: Date | null };
export type MatchedAttendance = {
  userId: string;
  name: string;
  email: string;
  status: "JOINED" | "PRESENT" | "PARTIAL";
  joinedMinutes: number;
  matchMethod: "EMAIL" | "NAME" | "NONE";
  stretches: AttendanceStretch[];
};
export type UnmatchedParticipant = { label: string; email: string | null; minutes: number; isHost: boolean; stretches: AttendanceStretch[] };
export type SessionAttendance = { matched: MatchedAttendance[]; unmatched: UnmatchedParticipant[] };

/**
 * Attendance per session for the admin page: each matched student (with how
 * they were matched and each stretch), then unmatched Zoom participants
 * grouped by email, else display name. The host is flagged, not hidden.
 */
export async function attendanceForSessions(sessions: Pick<SessionView, "id" | "host">[], now = new Date()) {
  const result = new Map<string, SessionAttendance>();
  const ids = sessions.map((s) => s.id);
  if (!ids.length) return result;
  const [rows, intervals] = await Promise.all([
    prisma.attendance.findMany({ where: { sessionId: { in: ids } } }),
    prisma.attendanceInterval.findMany({ where: { sessionId: { in: ids } } }),
  ]);
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true, email: true } })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));
  const byTime = (a: AttendanceStretch, b: AttendanceStretch) => a.joinedAt.getTime() - b.joinedAt.getTime();

  for (const session of sessions) {
    const own = intervals.filter((i) => i.sessionId === session.id);
    const matched: MatchedAttendance[] = rows
      .filter((r) => r.sessionId === session.id)
      .map((r) => {
        const mine = own.filter((i) => i.userId === r.userId);
        const user = userById.get(r.userId);
        return {
          userId: r.userId,
          name: user?.fullName ?? "Deleted account",
          email: user?.email ?? "",
          status: r.status,
          joinedMinutes: r.joinedMinutes,
          matchMethod: mine.some((i) => i.matchMethod === "EMAIL") ? "EMAIL" : mine.some((i) => i.matchMethod === "NAME") ? "NAME" : "NONE",
          stretches: mine.map(({ joinedAt, leftAt }) => ({ joinedAt, leftAt })).sort(byTime),
        } satisfies MatchedAttendance;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const groups = new Map<string, typeof own>();
    for (const interval of own.filter((i) => !i.userId)) {
      const key = interval.email?.toLowerCase() || `name:${(interval.name ?? interval.zoomParticipantId).toLowerCase()}`;
      groups.set(key, [...(groups.get(key) ?? []), interval]);
    }
    const hostEmail = session.host.email.trim().toLowerCase();
    const unmatched: UnmatchedParticipant[] = [...groups.values()]
      .map((list) => {
        const email = list.find((i) => i.email)?.email ?? null;
        return {
          label: list.find((i) => i.name)?.name ?? email ?? "Unnamed participant",
          email,
          minutes: coveredMinutes(list, now),
          isHost: !!email && email.toLowerCase() === hostEmail,
          stretches: list.map(({ joinedAt, leftAt }) => ({ joinedAt, leftAt })).sort(byTime),
        };
      })
      .sort((a, b) => Number(b.isHost) - Number(a.isHost) || a.label.localeCompare(b.label));
    result.set(session.id, { matched, unmatched });
  }
  return result;
}
