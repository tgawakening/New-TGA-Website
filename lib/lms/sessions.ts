import "server-only";
import { randomInt } from "node:crypto";
import { Prisma, type LmsSession } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createMeeting, deleteMeeting, updateMeeting, ZoomApiError, type ZoomMeeting, type ZoomMeetingSettings } from "@/lib/zoom/client";
import { encryptField, lmsFieldKey, sessionFieldContext } from "./field-crypto";

/**
 * Live-session lifecycle: one LmsSession row backed by one scheduled Zoom
 * meeting (type 2) under a registered ZoomHost. All Zoom calls go through
 * lib/zoom/client (cached Server-to-Server token).
 *
 * Ordering: the database row is written first, under a lock on the host row
 * that also covers the overlap check, then Zoom is called. If Zoom fails the
 * row change is undone, so the database never points at a meeting Zoom
 * refused, and two concurrent requests cannot both book the same host slot.
 */

// ── Meeting settings ───────────────────────────────────────────────────────

/** Students wait until the host admits them. */
export const LMS_WAITING_ROOM = true;
/** Students cannot enter before the host has started the meeting. */
export const LMS_JOIN_BEFORE_HOST = false;

export const LMS_MEETING_SETTINGS = {
  auto_recording: "cloud",
  waiting_room: LMS_WAITING_ROOM,
  join_before_host: LMS_JOIN_BEFORE_HOST,
  mute_upon_entry: true,
} as const satisfies ZoomMeetingSettings;

/** Upper bound on one session, also the overlap guard's look-back window. */
export const LMS_MAX_SESSION_MINUTES = 8 * 60;
export const LMS_TITLE_MAX = 191;
/** Numeric passcode: accepted whether or not the Zoom account requires numeric-only. Zoom allows at most 10. */
export const LMS_PASSCODE_LENGTH = 10;

// ── Errors ─────────────────────────────────────────────────────────────────

export type LmsSessionErrorCode = "INVALID" | "NOT_FOUND" | "HOST_INACTIVE" | "OVERLAP" | "CONFLICT" | "ZOOM";

export class LmsSessionError extends Error {
  constructor(
    message: string,
    readonly code: LmsSessionErrorCode,
    readonly status: number,
  ) {
    super(message);
    this.name = "LmsSessionError";
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

type Db = Prisma.TransactionClient | typeof prisma;

export const sessionEnd = (session: { startsAt: Date; durationMin: number }) =>
  new Date(session.startsAt.getTime() + session.durationMin * 60_000);

export function generatePasscode(length = LMS_PASSCODE_LENGTH) {
  let out = "";
  for (let i = 0; i < length; i += 1) out += String(randomInt(10));
  return out;
}

function validateTitle(title: string) {
  const value = title.trim();
  if (!value) throw new LmsSessionError("A session title is required.", "INVALID", 400);
  if (value.length > LMS_TITLE_MAX) throw new LmsSessionError(`The session title must be at most ${LMS_TITLE_MAX} characters.`, "INVALID", 400);
  return value;
}

function validateStart(startsAt: Date) {
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) throw new LmsSessionError("The start time is not a valid date.", "INVALID", 400);
  return startsAt;
}

function validateDuration(durationMin: number) {
  if (!Number.isInteger(durationMin) || durationMin <= 0 || durationMin > LMS_MAX_SESSION_MINUTES)
    throw new LmsSessionError(`The duration must be a whole number of minutes between 1 and ${LMS_MAX_SESSION_MINUTES}.`, "INVALID", 400);
  return durationMin;
}

const fmtUtc = (date: Date) => `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;

/** Serialise writes per host: the overlap check and the write happen under this row lock. */
async function lockHost(tx: Db, hostId: string) {
  await tx.$queryRaw`SELECT id FROM ZoomHost WHERE id = ${hostId} FOR UPDATE`;
}

/** The first non-cancelled session on this host whose time range intersects [startsAt, startsAt + durationMin). */
export async function findHostOverlap(
  db: Db,
  hostId: string,
  startsAt: Date,
  durationMin: number,
  excludeSessionId?: string,
) {
  const end = new Date(startsAt.getTime() + durationMin * 60_000);
  const candidates = await db.lmsSession.findMany({
    where: {
      zoomHostId: hostId,
      status: { not: "CANCELLED" },
      startsAt: { lt: end, gt: new Date(startsAt.getTime() - LMS_MAX_SESSION_MINUTES * 60_000) },
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
    },
    select: { id: true, title: true, startsAt: true, durationMin: true },
    orderBy: { startsAt: "asc" },
  });
  return candidates.find((other) => sessionEnd(other) > startsAt) ?? null;
}

async function assertNoHostOverlap(db: Db, hostId: string, startsAt: Date, durationMin: number, excludeSessionId?: string) {
  const clash = await findHostOverlap(db, hostId, startsAt, durationMin, excludeSessionId);
  if (clash)
    throw new LmsSessionError(
      `This host already has "${clash.title}" from ${fmtUtc(clash.startsAt)} to ${fmtUtc(sessionEnd(clash))}. ` +
        "One licensed Zoom host cannot run two classes at once: choose a time that does not overlap.",
      "OVERLAP",
      409,
    );
}

function zoomFailure(action: string, error: unknown): never {
  if (error instanceof ZoomApiError) throw new LmsSessionError(`Zoom could not ${action}: ${error.message}`, "ZOOM", 502);
  throw error;
}

// ── Service ────────────────────────────────────────────────────────────────

export type CreateSessionInput = {
  cohortId: string;
  title: string;
  startsAt: Date;
  durationMin: number;
  hostId: string;
};

export async function createSession(input: CreateSessionInput): Promise<LmsSession> {
  const title = validateTitle(input.title);
  const startsAt = validateStart(input.startsAt);
  const durationMin = validateDuration(input.durationMin);
  lmsFieldKey(); // Fail on a missing key before anything is written or scheduled.

  const [host, cohort] = await Promise.all([
    prisma.zoomHost.findUnique({ where: { id: input.hostId } }),
    prisma.sirahCohort.findUnique({ where: { batchCode: input.cohortId }, select: { batchCode: true } }),
  ]);
  if (!cohort) throw new LmsSessionError("That cohort does not exist.", "NOT_FOUND", 404);
  if (!host) throw new LmsSessionError("That Zoom host is not registered.", "NOT_FOUND", 404);
  if (!host.active) throw new LmsSessionError("That Zoom host is inactive.", "HOST_INACTIVE", 409);

  const row = await prisma.$transaction(async (tx) => {
    await lockHost(tx, host.id);
    await assertNoHostOverlap(tx, host.id, startsAt, durationMin);
    return tx.lmsSession.create({
      data: { cohortId: cohort.batchCode, title, startsAt, durationMin, zoomHostId: host.id, status: "SCHEDULED" },
    });
  });

  const passcode = generatePasscode();
  let meeting: ZoomMeeting;
  try {
    meeting = await createMeeting(host.zoomUserId, { topic: title, startsAt, durationMin, password: passcode, settings: LMS_MEETING_SETTINGS });
  } catch (error) {
    await prisma.lmsSession.delete({ where: { id: row.id } });
    zoomFailure("schedule the meeting", error);
  }

  try {
    return await prisma.lmsSession.update({
      where: { id: row.id },
      data: {
        zoomMeetingId: String(meeting.id),
        zoomMeetingUuid: meeting.uuid || null,
        joinUrlEncrypted: encryptField(meeting.join_url, sessionFieldContext(row.id, "joinUrl")),
        passcodeEncrypted: encryptField(meeting.password || passcode, sessionFieldContext(row.id, "passcode")),
      },
    });
  } catch (error) {
    // Do not leave a Zoom meeting the database does not know about.
    await deleteMeeting(meeting.id).catch(() => undefined);
    await prisma.lmsSession.delete({ where: { id: row.id } }).catch(() => undefined);
    throw error;
  }
}

export type UpdateSessionInput = { title?: string; startsAt?: Date; durationMin?: number };

export async function updateSession(sessionId: string, patch: UpdateSessionInput): Promise<LmsSession> {
  const current = await prisma.lmsSession.findUnique({ where: { id: sessionId } });
  if (!current) throw new LmsSessionError("That session does not exist.", "NOT_FOUND", 404);
  if (current.status === "CANCELLED" || current.status === "ENDED")
    throw new LmsSessionError(`A ${current.status.toLowerCase()} session cannot be changed.`, "CONFLICT", 409);
  if (!current.zoomMeetingId) throw new LmsSessionError("This session has no Zoom meeting yet.", "CONFLICT", 409);

  const changes: { title?: string; startsAt?: Date; durationMin?: number } = {};
  if (patch.title !== undefined) {
    const title = validateTitle(patch.title);
    if (title !== current.title) changes.title = title;
  }
  if (patch.startsAt !== undefined && validateStart(patch.startsAt).getTime() !== current.startsAt.getTime()) changes.startsAt = patch.startsAt;
  if (patch.durationMin !== undefined && validateDuration(patch.durationMin) !== current.durationMin) changes.durationMin = patch.durationMin;
  if (!Object.keys(changes).length) return current;

  const startsAt = changes.startsAt ?? current.startsAt;
  const durationMin = changes.durationMin ?? current.durationMin;
  const timeChanged = changes.startsAt !== undefined || changes.durationMin !== undefined;

  const updated = await prisma.$transaction(async (tx) => {
    if (timeChanged) {
      await lockHost(tx, current.zoomHostId);
      await assertNoHostOverlap(tx, current.zoomHostId, startsAt, durationMin, current.id);
    }
    return tx.lmsSession.update({ where: { id: current.id }, data: changes });
  });

  try {
    await updateMeeting(current.zoomMeetingId, {
      ...(changes.title !== undefined ? { topic: changes.title } : {}),
      ...(changes.startsAt !== undefined ? { startsAt: changes.startsAt } : {}),
      ...(changes.durationMin !== undefined ? { durationMin: changes.durationMin } : {}),
    });
  } catch (error) {
    await prisma.lmsSession.update({
      where: { id: current.id },
      data: { title: current.title, startsAt: current.startsAt, durationMin: current.durationMin },
    });
    zoomFailure("update the meeting", error);
  }
  return updated;
}

/** Delete the Zoom meeting and mark the session CANCELLED. Idempotent; the row is kept. */
export async function cancelSession(sessionId: string): Promise<LmsSession> {
  const current = await prisma.lmsSession.findUnique({ where: { id: sessionId } });
  if (!current) throw new LmsSessionError("That session does not exist.", "NOT_FOUND", 404);
  if (current.status === "CANCELLED") return current;
  if (current.status === "ENDED") throw new LmsSessionError("An ended session cannot be cancelled.", "CONFLICT", 409);

  if (current.zoomMeetingId) {
    try {
      await deleteMeeting(current.zoomMeetingId);
    } catch (error) {
      // Already gone in Zoom: cancelling here is still correct.
      if (!(error instanceof ZoomApiError && error.isNotFound)) zoomFailure("cancel the meeting", error);
    }
  }
  return prisma.lmsSession.update({ where: { id: current.id }, data: { status: "CANCELLED" } });
}
