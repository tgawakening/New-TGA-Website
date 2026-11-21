import "server-only";
import { Prisma, type AttendanceMatchMethod, type AttendanceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SIRAH_BATCH, SIRAH_SLUG } from "@/lib/sirah/catalog";
import { studentMayJoinCohort } from "./access";

/**
 * Attendance from Zoom participant data.
 *
 * Intervals: one row per stretch of one Zoom participant, keyed by (session,
 * Zoom participant id, joinedAt), so the participant_joined webhook, the
 * participant_left webhook and the post-meeting report all land on the same
 * row whatever order they arrive in. Writes are upserts: reprocessing an event
 * changes nothing.
 *
 * Attendance: one row per matched student, always recomputed from all of
 * their intervals (overlapping stretches, e.g. phone and laptop, count once),
 * never incremented, so it is idempotent too.
 */

/** Present: in the meeting for at least this share of its length. Otherwise partial. */
export const ATTENDANCE_PRESENT_RATIO = 0.75;

const MINUTE = 60_000;

// ── Pure helpers ───────────────────────────────────────────────────────────

/** Minutes covered by the union of the intervals; an open interval counts up to `asOf`. */
export function coveredMinutes(intervals: { joinedAt: Date; leftAt: Date | null }[], asOf: Date): number {
  const spans = intervals
    .map((i) => [i.joinedAt.getTime(), Math.max(i.joinedAt.getTime(), (i.leftAt ?? asOf).getTime())] as const)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let start = -Infinity;
  let end = -Infinity;
  for (const [s, e] of spans) {
    if (s > end) {
      if (end > start) total += end - start;
      start = s;
      end = e;
    } else end = Math.max(end, e);
  }
  if (end > start) total += end - start;
  return Math.round(total / MINUTE);
}

/** JOINED while live; after the end, PRESENT at >= 75% of the meeting's length, else PARTIAL. */
export function attendanceStatus(joinedMinutes: number, meetingMinutes: number, ended: boolean): AttendanceStatus {
  if (!ended) return "JOINED";
  return meetingMinutes > 0 && joinedMinutes >= meetingMinutes * ATTENDANCE_PRESENT_RATIO ? "PRESENT" : "PARTIAL";
}

/** Display names compared case-insensitively, with whitespace collapsed. */
export const normaliseName = (name: string) => name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

// ── Matching a Zoom participant to a student ───────────────────────────────

export type ParticipantIdentity = { email?: string | null; name?: string | null };
export type Match = { userId: string | null; matchMethod: AttendanceMatchMethod };

type Candidate = { id: string; email: string; fullName: string };

/**
 * Matches participants to students of one session's cohort. "Student of the
 * cohort" is the join route's own rule (studentMayJoinCohort: the paid +
 * active enrolment, scoped to the cohort), evaluated at the participant's
 * join time. Email first (account email equals the Zoom email); otherwise an
 * exact display-name match, accepted only when exactly one cohort student has
 * that name. Anything else stays unmatched.
 */
export function cohortMatcher(cohortId: string) {
  let candidates: Promise<Candidate[]> | null = null;
  const allowed = new Map<string, boolean>();

  const mayJoin = async (userId: string, at: Date) => {
    const key = `${userId}|${Math.floor(at.getTime() / 3_600_000)}`;
    if (!allowed.has(key)) allowed.set(key, await studentMayJoinCohort(userId, cohortId, at));
    return allowed.get(key)!;
  };

  /** Accounts with a Sīrah order in this cohort, plus legacy enrolments for the catalog batch. */
  const loadCandidates = async (): Promise<Candidate[]> => {
    const [orders, legacy] = await Promise.all([
      prisma.sirahOrder.findMany({
        where: { batchCode: cohortId, archivedAt: null, course: { slug: SIRAH_SLUG } },
        select: { userId: true },
      }),
      cohortId === SIRAH_BATCH
        ? prisma.enrollment.findMany({ where: { course: { slug: SIRAH_SLUG } }, select: { userId: true } })
        : Promise.resolve([]),
    ]);
    const ids = [...new Set([...orders, ...legacy].map((row) => row.userId))];
    if (!ids.length) return [];
    return prisma.user.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: { id: true, email: true, fullName: true } });
  };

  return async function match(identity: ParticipantIdentity, at: Date): Promise<Match> {
    const email = identity.email?.trim().toLowerCase();
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, status: true } });
      if (user?.status === "ACTIVE" && (await mayJoin(user.id, at))) return { userId: user.id, matchMethod: "EMAIL" };
    }
    const name = identity.name ? normaliseName(identity.name) : "";
    if (name) {
      candidates ??= loadCandidates();
      const named = (await candidates).filter((c) => normaliseName(c.fullName) === name);
      const eligible: string[] = [];
      for (const c of named) if (await mayJoin(c.id, at)) eligible.push(c.id);
      if (eligible.length === 1) return { userId: eligible[0], matchMethod: "NAME" };
    }
    return { userId: null, matchMethod: "NONE" };
  };
}

// ── Interval writes ────────────────────────────────────────────────────────

export type IntervalInput = {
  sessionId: string;
  zoomParticipantId: string;
  joinedAt: Date;
  leftAt?: Date | null;
  email?: string | null;
  name?: string | null;
};

const clip = (value: string | null | undefined, max: number) => (value ? value.trim().slice(0, max) || null : null);

/**
 * Create the interval, or fill in what an earlier write did not know (left
 * time, email, name, a match). Never un-closes an interval, and a leftAt
 * already recorded is only replaced when `authoritativeLeftAt` (the report).
 */
export async function upsertInterval(input: IntervalInput, match: Match, options: { authoritativeLeftAt?: boolean } = {}) {
  const key = { sessionId: input.sessionId, zoomParticipantId: input.zoomParticipantId.slice(0, 191), joinedAt: input.joinedAt };
  const email = clip(input.email, 320);
  const name = clip(input.name, 191);
  const write = async () => {
    const existing = await prisma.attendanceInterval.findUnique({ where: { sessionId_zoomParticipantId_joinedAt: key } });
    if (!existing)
      return prisma.attendanceInterval.create({
        data: { ...key, leftAt: input.leftAt ?? null, email, name, userId: match.userId, matchMethod: match.matchMethod },
      });
    const data: Prisma.AttendanceIntervalUpdateInput = {};
    if (input.leftAt && (!existing.leftAt || options.authoritativeLeftAt) && existing.leftAt?.getTime() !== input.leftAt.getTime())
      data.leftAt = input.leftAt;
    if (email && !existing.email) data.email = email;
    if (name && !existing.name) data.name = name;
    if (!existing.userId && match.userId) Object.assign(data, { userId: match.userId, matchMethod: match.matchMethod });
    return Object.keys(data).length
      ? prisma.attendanceInterval.update({ where: { id: existing.id }, data })
      : existing;
  };
  try {
    return await write();
  } catch (error) {
    // Two processors created the same interval at once: the other one won; merge into it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return write();
    throw error;
  }
}

/** Close this participant's open interval (the latest one that began at or before `leftAt`). */
export async function closeOpenInterval(sessionId: string, zoomParticipantId: string, leftAt: Date) {
  const open = await prisma.attendanceInterval.findMany({
    where: { sessionId, zoomParticipantId: zoomParticipantId.slice(0, 191), leftAt: null },
  });
  const target = open
    .filter((i) => i.joinedAt.getTime() <= leftAt.getTime())
    .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime())[0];
  if (!target) return null;
  return prisma.attendanceInterval.update({ where: { id: target.id }, data: { leftAt } });
}

/** At meeting end: every interval still open is closed at the end time. */
export async function closeAllOpenIntervals(sessionId: string, endedAt: Date) {
  const open = await prisma.attendanceInterval.findMany({ where: { sessionId, leftAt: null } });
  for (const interval of open)
    await prisma.attendanceInterval.update({
      where: { id: interval.id },
      data: { leftAt: interval.joinedAt > endedAt ? interval.joinedAt : endedAt },
    });
  return open.length;
}

// ── Aggregation ────────────────────────────────────────────────────────────

/** Meeting length for the present/partial rule: the real Zoom start to end, else the scheduled duration. */
export function meetingMinutes(session: { durationMin: number; zoomStartedAt: Date | null; zoomEndedAt: Date | null }) {
  if (session.zoomStartedAt && session.zoomEndedAt && session.zoomEndedAt > session.zoomStartedAt)
    return Math.round((session.zoomEndedAt.getTime() - session.zoomStartedAt.getTime()) / MINUTE);
  return session.durationMin;
}

/** Recompute the Attendance rows of the given students (all matched students when omitted). */
export async function recomputeAttendance(sessionId: string, options: { userIds?: string[]; asOf?: Date } = {}) {
  const session = await prisma.lmsSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, durationMin: true, zoomStartedAt: true, zoomEndedAt: true },
  });
  if (!session) return 0;
  const intervals = await prisma.attendanceInterval.findMany({
    where: { sessionId, userId: options.userIds ? { in: options.userIds } : { not: null } },
  });
  const ended = session.status === "ENDED";
  const asOf = ended && session.zoomEndedAt ? session.zoomEndedAt : (options.asOf ?? new Date());
  const byUser = new Map<string, typeof intervals>();
  for (const interval of intervals) {
    if (!interval.userId) continue;
    byUser.set(interval.userId, [...(byUser.get(interval.userId) ?? []), interval]);
  }
  const length = meetingMinutes(session);
  const existing = await prisma.attendance.findMany({ where: { sessionId, userId: { in: [...byUser.keys()] } } });
  const current = new Map(existing.map((row) => [row.userId, row]));
  const same = (a: Date | null | undefined, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
  for (const [userId, rows] of byUser) {
    const joinedMinutes = coveredMinutes(rows, asOf);
    const firstJoinedAt = new Date(Math.min(...rows.map((r) => r.joinedAt.getTime())));
    const lastLeftAt = rows.some((r) => !r.leftAt) ? null : new Date(Math.max(...rows.map((r) => r.leftAt!.getTime())));
    const data = { status: attendanceStatus(joinedMinutes, length, ended), joinedMinutes, firstJoinedAt, lastLeftAt };
    const before = current.get(userId);
    // Unchanged: no write at all, so reprocessing an event is a true no-op.
    if (
      before &&
      before.status === data.status &&
      before.joinedMinutes === joinedMinutes &&
      same(before.firstJoinedAt, firstJoinedAt) &&
      same(before.lastLeftAt, lastLeftAt)
    )
      continue;
    const write = () =>
      prisma.attendance.upsert({
        where: { sessionId_userId: { sessionId, userId } },
        create: { sessionId, userId, ...data },
        update: data,
      });
    try {
      await write();
    } catch (error) {
      // Two processors created the row at once: the other one won; update it.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") await write();
      else throw error;
    }
  }
  return byUser.size;
}
