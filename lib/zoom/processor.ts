import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  closeAllOpenIntervals,
  cohortMatcher,
  recomputeAttendance,
  upsertInterval,
} from "@/lib/lms/attendance";
import { getPastMeetingParticipants, ZoomApiError } from "./client";

/**
 * Handles stored ZoomWebhookEvent rows: live status and attendance.
 *
 * This Zoom account delivers events for every meeting on it (the Gen-Mumin
 * app's too). An event is ours only when its meeting id is an LmsSession's
 * zoomMeetingId; everything else is marked processed and otherwise ignored.
 *
 *   meeting.started            session -> LIVE (zoomStartedAt)
 *   meeting.ended              session -> ENDED (zoomEndedAt), open intervals
 *                              closed, attendance finalised, then reconciled
 *                              against Zoom's past-participants report
 *   meeting.participant_joined an AttendanceInterval opens
 *   meeting.participant_left   that interval closes
 *
 * Every handler is idempotent (upserts on natural keys, conditional status
 * updates, attendance recomputed rather than incremented), so the same event
 * may run twice (the webhook's after() and the catch-up endpoint) or late.
 */

export type ZoomEventOutcome = { handled: boolean; note?: string };

/** Worth retrying later (report not ready yet, a leave seen before its join). */
export class RetryableZoomEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableZoomEventError";
  }
}

/** Events still failing after this long are marked processed with their error kept. */
export const ZOOM_EVENT_RETRY_WINDOW_MS = 48 * 60 * 60 * 1000;

type Payload = {
  event_ts?: number;
  payload?: {
    object?: {
      id?: string | number;
      uuid?: string;
      start_time?: string;
      end_time?: string;
      participant?: {
        user_id?: string | number;
        participant_uuid?: string;
        id?: string;
        user_name?: string;
        email?: string;
        join_time?: string;
        leave_time?: string;
      };
    };
  };
};

const time = (value: unknown) => {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

function eventTime(body: Payload, fallback: Date) {
  return typeof body.event_ts === "number" && Number.isFinite(body.event_ts) ? new Date(body.event_ts) : fallback;
}

/** The LmsSession for a Zoom meeting id, or null when the meeting is not one of ours. */
async function sessionForMeeting(meetingId: string, at: Date) {
  const sessions = await prisma.lmsSession.findMany({
    where: { zoomMeetingId: meetingId },
    select: {
      id: true,
      cohortId: true,
      status: true,
      startsAt: true,
      durationMin: true,
      zoomStartedAt: true,
      zoomEndedAt: true,
    },
  });
  if (sessions.length <= 1) return sessions[0] ?? null;
  // One meeting id per session today; if that ever changes, the nearest start wins.
  return sessions.sort((a, b) => Math.abs(a.startsAt.getTime() - at.getTime()) - Math.abs(b.startsAt.getTime() - at.getTime()))[0];
}

type Session = NonNullable<Awaited<ReturnType<typeof sessionForMeeting>>>;

const participantKey = (p: NonNullable<NonNullable<NonNullable<Payload["payload"]>["object"]>["participant"]>) =>
  String(p.user_id ?? p.participant_uuid ?? p.id ?? "").trim();

// ── Handlers ───────────────────────────────────────────────────────────────

async function meetingStarted(session: Session, body: Payload, at: Date): Promise<ZoomEventOutcome> {
  if (session.status === "CANCELLED") return { handled: true, note: "Session is cancelled; status left as is." };
  const startedAt = time(body.payload?.object?.start_time) ?? at;
  // A started event older than the recorded end is a late delivery, not a restart.
  if (session.status === "ENDED" && session.zoomEndedAt && startedAt <= session.zoomEndedAt)
    return { handled: true, note: "Late meeting.started after the end; ignored." };
  await prisma.lmsSession.updateMany({
    where: { id: session.id, status: { in: ["SCHEDULED", "LIVE", "ENDED"] } },
    data: {
      status: "LIVE",
      zoomStartedAt: session.zoomStartedAt ?? startedAt,
      ...(session.status === "ENDED" ? { zoomEndedAt: null } : {}),
    },
  });
  return { handled: true, note: session.status === "ENDED" ? "Meeting restarted." : undefined };
}

async function meetingEnded(session: Session, body: Payload, at: Date): Promise<ZoomEventOutcome> {
  if (session.status === "CANCELLED") return { handled: true, note: "Session is cancelled; status left as is." };
  const object = body.payload?.object;
  const endedAt = time(object?.end_time) ?? at;
  const startedAt = time(object?.start_time);
  // The latest end wins, so a late or repeated meeting.ended never moves it back.
  await prisma.lmsSession.updateMany({
    where: { id: session.id, status: { in: ["SCHEDULED", "LIVE", "ENDED"] } },
    data: {
      status: "ENDED",
      zoomEndedAt: session.zoomEndedAt && session.zoomEndedAt > endedAt ? session.zoomEndedAt : endedAt,
      zoomStartedAt: session.zoomStartedAt ?? startedAt ?? undefined,
    },
  });
  await closeAllOpenIntervals(session.id, endedAt);
  // Final from the webhook stretches now; the report below refines it.
  await recomputeAttendance(session.id);

  const uuid = object?.uuid;
  if (!uuid) return { handled: true, note: "No meeting uuid; attendance from webhooks only." };
  let participants;
  try {
    participants = await getPastMeetingParticipants(uuid);
  } catch (error) {
    // The report is usually ready a few minutes after the end: try again later.
    const reason = error instanceof ZoomApiError ? error.message : error instanceof Error ? error.message : "unknown error";
    throw new RetryableZoomEventError(`Participants report not available yet (${reason}). Attendance is final from webhooks; the report pass will retry.`);
  }
  const match = cohortMatcher(session.cohortId);
  for (const p of participants) {
    const joinedAt = time(p.join_time);
    const key = String(p.user_id ?? p.id ?? p.participant_user_id ?? "").trim();
    if (!joinedAt || !key) continue;
    const identity = { email: p.user_email, name: p.name };
    await upsertInterval(
      { sessionId: session.id, zoomParticipantId: key, joinedAt, leftAt: time(p.leave_time), ...identity },
      await match(identity, joinedAt),
      { authoritativeLeftAt: true },
    );
  }
  await recomputeAttendance(session.id);
  return { handled: true, note: `Reconciled ${participants.length} report entries.` };
}

async function participantJoined(session: Session, body: Payload, at: Date): Promise<ZoomEventOutcome> {
  if (session.status === "CANCELLED") return { handled: true, note: "Session is cancelled." };
  const p = body.payload?.object?.participant;
  const key = p ? participantKey(p) : "";
  if (!p || !key) return { handled: true, note: "No participant id; ignored." };
  const joinedAt = time(p.join_time) ?? at;
  const identity = { email: p.email, name: p.user_name };
  const match = await cohortMatcher(session.cohortId)(identity, joinedAt);
  const interval = await upsertInterval({ sessionId: session.id, zoomParticipantId: key, joinedAt, ...identity }, match);
  if (interval.userId) await recomputeAttendance(session.id, { userIds: [interval.userId], asOf: at });
  return { handled: true };
}

async function participantLeft(session: Session, body: Payload, at: Date): Promise<ZoomEventOutcome> {
  if (session.status === "CANCELLED") return { handled: true, note: "Session is cancelled." };
  const p = body.payload?.object?.participant;
  const key = p ? participantKey(p) : "";
  if (!p || !key) return { handled: true, note: "No participant id; ignored." };
  const leftAt = time(p.leave_time) ?? at;

  // This participant's latest stretch that began by the time they left.
  const intervals = await prisma.attendanceInterval.findMany({ where: { sessionId: session.id, zoomParticipantId: key.slice(0, 191) } });
  const latest = intervals
    .filter((i) => i.joinedAt.getTime() <= leftAt.getTime())
    .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime())[0];

  let userId: string | null = null;
  if (latest) {
    userId = latest.userId;
    // Open: close it. Closed later than this (by the meeting end): the real leave time is earlier.
    if (!latest.leftAt || latest.leftAt.getTime() > leftAt.getTime())
      await prisma.attendanceInterval.update({ where: { id: latest.id }, data: { leftAt } });
  } else {
    const joinedAt = time(p.join_time);
    if (!joinedAt) throw new RetryableZoomEventError("participant_left arrived before its participant_joined.");
    const identity = { email: p.email, name: p.user_name };
    const interval = await upsertInterval(
      { sessionId: session.id, zoomParticipantId: key, joinedAt, leftAt, ...identity },
      await cohortMatcher(session.cohortId)(identity, joinedAt),
    );
    userId = interval.userId;
  }
  if (userId) await recomputeAttendance(session.id, { userIds: [userId], asOf: at });
  return { handled: true };
}

const HANDLERS: Record<string, (session: Session, body: Payload, at: Date) => Promise<ZoomEventOutcome>> = {
  "meeting.started": meetingStarted,
  "meeting.ended": meetingEnded,
  "meeting.participant_joined": participantJoined,
  "meeting.participant_left": participantLeft,
};

export const HANDLED_ZOOM_EVENTS = Object.keys(HANDLERS);

/** Handle one event. Throws RetryableZoomEventError when it should be tried again later. */
export async function processZoomWebhookEvent(event: {
  id: string;
  event: string;
  payload: unknown;
  receivedAt?: Date;
}): Promise<ZoomEventOutcome> {
  const handler = HANDLERS[event.event];
  if (!handler) return { handled: false, note: `No handler for ${event.event}.` };
  const body = (event.payload ?? {}) as Payload;
  const meetingId = body.payload?.object?.id;
  if (meetingId === undefined || meetingId === null || meetingId === "") return { handled: false, note: "No meeting id." };
  const at = eventTime(body, event.receivedAt ?? new Date());
  const session = await sessionForMeeting(String(meetingId), at);
  // Not one of our sessions (e.g. a Gen-Mumin meeting on the same account).
  if (!session) return { handled: false, note: "Not an LMS session meeting; ignored." };
  return handler(session, body, at);
}

// ── Running stored events ──────────────────────────────────────────────────

/**
 * How the webhook route runs processing after its 200 is sent: Next's
 * after(). Swappable in tests, where there is no request scope.
 */
export const zoomEventRuntime = {
  schedule(task: () => Promise<unknown>) {
    after(task);
  },
};

export type ProcessResult = { id: string; status: "processed" | "ignored" | "retry" | "failed" | "skipped"; note?: string };

/**
 * Process one stored event and record the result on its row: processedAt on
 * success (or when ignored), the error text when it fails. A failure stays
 * unprocessed for the catch-up run to retry, until ZOOM_EVENT_RETRY_WINDOW_MS
 * after it arrived; then it is marked processed with its last error kept.
 */
export async function processStoredZoomEvent(id: string, now = new Date()): Promise<ProcessResult> {
  const row = await prisma.zoomWebhookEvent.findUnique({ where: { id } });
  if (!row || row.processedAt) return { id, status: "skipped" };
  try {
    const outcome = await processZoomWebhookEvent(row);
    await prisma.zoomWebhookEvent.updateMany({
      where: { id, processedAt: null },
      data: { processedAt: new Date(), error: null },
    });
    return { id, status: outcome.handled ? "processed" : "ignored", note: outcome.note };
  } catch (error) {
    const message = (error instanceof Error ? `${error.name}: ${error.message}` : "Processing failed.").slice(0, 2000);
    const giveUp = now.getTime() - row.receivedAt.getTime() > ZOOM_EVENT_RETRY_WINDOW_MS;
    await prisma.zoomWebhookEvent.updateMany({
      where: { id, processedAt: null },
      data: { error: message, ...(giveUp ? { processedAt: new Date() } : {}) },
    });
    if (!(error instanceof RetryableZoomEventError)) console.error("[zoom-events] processing failed", row.event, id, message);
    return { id, status: error instanceof RetryableZoomEventError && !giveUp ? "retry" : "failed", note: message };
  }
}

/** When Zoom says the event happened (event_ts), else when we received it. */
function happenedAt(row: { receivedAt: Date; payload: unknown }) {
  const ts = (row.payload as Payload | null)?.event_ts;
  return typeof ts === "number" && Number.isFinite(ts) ? ts : row.receivedAt.getTime();
}

/** Catch-up: process the oldest unprocessed events, up to `limit`. */
export async function processPendingZoomEvents(options: { limit?: number; now?: Date } = {}) {
  const pending = await prisma.zoomWebhookEvent.findMany({
    where: { processedAt: null },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(options.limit ?? 100, 1), 500),
    select: { id: true, receivedAt: true, payload: true },
  });
  // In the order the events happened in Zoom (deliveries can arrive out of
  // order), so a join is handled before its leave; receipt order breaks ties.
  pending.sort((a, b) => happenedAt(a) - happenedAt(b) || a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id));
  const results: ProcessResult[] = [];
  for (const row of pending) results.push(await processStoredZoomEvent(row.id, options.now));
  const count = (status: ProcessResult["status"]) => results.filter((r) => r.status === status).length;
  return {
    examined: results.length,
    processed: count("processed"),
    ignored: count("ignored"),
    retry: count("retry"),
    failed: count("failed"),
  };
}
