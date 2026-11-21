import "server-only";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { after } from "next/server";
import { Prisma, type RecordingAssetKind, type RecordingCopyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safeFilename } from "@/lib/sirah/spaces";
import { listRecordings, listUserRecordings, openRecordingDownload, ZoomApiError } from "@/lib/zoom/client";
import { zoomApiEnv } from "@/lib/zoom/env";
import { studentMayJoinCohort, sirahStudentCohortAccess } from "./access";
import {
  RECORDING_BACKFILL_MAX_DAYS,
  RECORDING_COPY_BATCH_SIZE,
  RECORDING_DEFAULT_VISIBILITY,
  RECORDING_DELETE_ZOOM_CLOUD_COPY,
  RECORDING_INGEST_FILES,
  RECORDING_MATCH_WINDOW_MS,
  RECORDING_MAX_AUTO_ATTEMPTS,
  RECORDING_STALE_COPY_MS,
} from "./recording-policy";
import { recordingStorage, type RecordingStore } from "./recording-storage";

/**
 * Class recordings (LMS Phase 4).
 *
 *   ingest   recording.completed events (stored by the Phase 1 webhook, read
 *            by type whether or not Phase 3 marked them processed) and the
 *            backfill -> Recording + RecordingAsset rows, PENDING. Matched to
 *            OUR sessions by meeting UUID, else meeting id and nearest start;
 *            anything else (Gen-Mumin meetings on the same account) is
 *            ignored. Nothing is downloaded here.
 *   copy     PENDING assets are streamed from Zoom straight into object
 *            storage, a small batch per run: PENDING -> COPYING -> READY, or
 *            FAILED with attempts + 1 and the error kept.
 *   play     READY + PUBLISHED recordings, for students with an active, paid
 *            enrolment in the session's cohort, via a short-lived presigned URL.
 *
 * Everything is idempotent (keyed by meeting UUID and Zoom file id, claims
 * are conditional updates, object keys are deterministic), so runs may
 * overlap, repeat or resume after a crash. The Zoom cloud copy is never
 * deleted (RECORDING_DELETE_ZOOM_CLOUD_COPY).
 */

// The retention decision is pending: this module must never delete Zoom recordings.
const _keepZoomCloudCopy: false = RECORDING_DELETE_ZOOM_CLOUD_COPY;
void _keepZoomCloudCopy;

export const RECORDING_COMPLETED_EVENT = "recording.completed";

/** Read-only rollout check: false until the Phase 4 migration is deployed. Never creates tables. */
export async function recordingsAvailable() {
  try {
    await prisma.recording.findFirst({ select: { id: true } });
    await prisma.recordingAsset.findFirst({ select: { id: true } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return false;
    throw error;
  }
}

// ── File selection ─────────────────────────────────────────────────────────

/** A cloud-recording file as Zoom sends it (webhook payload or the recordings API). */
export type ZoomFile = {
  id?: string;
  file_type?: string;
  file_extension?: string;
  file_size?: number;
  recording_type?: string;
  recording_start?: string;
  recording_end?: string;
  status?: string;
  download_url?: string;
};

export type ZoomRecordingMeeting = {
  id?: string | number;
  uuid?: string;
  start_time?: string;
  duration?: number;
  recording_files?: ZoomFile[];
};

export type SelectedFile = { kind: RecordingAssetKind; file: ZoomFile & { id: string } };

const upper = (value: unknown) => (typeof value === "string" ? value.toUpperCase() : "");
const usable = (file: ZoomFile): file is ZoomFile & { id: string } =>
  typeof file.id === "string" && file.id.length > 0 && file.id.length <= 191 && (!file.status || file.status.toLowerCase() === "completed");
const size = (file: ZoomFile) => (typeof file.file_size === "number" && Number.isFinite(file.file_size) ? file.file_size : 0);

/**
 * The files worth copying: the primary MP4 (shared screen with speaker, else
 * the largest MP4), then per RECORDING_INGEST_FILES one M4A, one VTT
 * transcript and the chat file. Files still processing are skipped.
 */
export function selectRecordingFiles(files: ZoomFile[] | undefined): SelectedFile[] {
  const ready = (files ?? []).filter(usable);
  const selected: SelectedFile[] = [];
  const mp4 = ready.filter((f) => upper(f.file_type) === "MP4");
  const primary =
    mp4.find((f) => (f.recording_type ?? "").toLowerCase().startsWith("shared_screen_with_speaker_view")) ??
    [...mp4].sort((a, b) => size(b) - size(a))[0];
  if (primary) selected.push({ kind: "VIDEO", file: primary });
  if (RECORDING_INGEST_FILES.audio) {
    const audio = ready.filter((f) => upper(f.file_type) === "M4A").sort((a, b) => size(b) - size(a))[0];
    if (audio) selected.push({ kind: "AUDIO", file: audio });
  }
  if (RECORDING_INGEST_FILES.transcript) {
    const vtt = ready.find((f) => upper(f.file_type) === "TRANSCRIPT" || (upper(f.file_type) === "CC" && upper(f.file_extension) === "VTT"));
    if (vtt) selected.push({ kind: "TRANSCRIPT", file: vtt });
  }
  if (RECORDING_INGEST_FILES.chat) {
    const chat = ready.find((f) => upper(f.file_type) === "CHAT");
    if (chat) selected.push({ kind: "CHAT", file: chat });
  }
  return selected;
}

// ── Matching ───────────────────────────────────────────────────────────────

const time = (value: unknown) => {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Our session for a recorded meeting instance: the session holding this
 * meeting UUID, else the session with this meeting id whose start is nearest
 * the recording's (within RECORDING_MATCH_WINDOW_MS). Null -> not ours.
 */
export async function sessionForRecording(meetingId: string | null, uuid: string | null, startedAt: Date | null) {
  if (uuid) {
    const byUuid = await prisma.lmsSession.findFirst({ where: { zoomMeetingUuid: uuid }, select: { id: true, cohortId: true, startsAt: true } });
    if (byUuid) return byUuid;
  }
  if (!meetingId) return null;
  const candidates = await prisma.lmsSession.findMany({ where: { zoomMeetingId: meetingId }, select: { id: true, cohortId: true, startsAt: true } });
  if (!candidates.length) return null;
  if (!startedAt) return candidates.length === 1 ? candidates[0] : null;
  const distance = (s: { startsAt: Date }) => Math.abs(s.startsAt.getTime() - startedAt.getTime());
  const nearest = [...candidates].sort((a, b) => distance(a) - distance(b))[0];
  return distance(nearest) <= RECORDING_MATCH_WINDOW_MS ? nearest : null;
}

// ── Ingest ─────────────────────────────────────────────────────────────────

export type IngestOutcome =
  | { status: "ingested"; recordingId: string; created: boolean; assetsCreated: number }
  | { status: "ignored"; reason: string };

const isUniqueViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/**
 * Upsert the Recording and its RecordingAssets (PENDING) for one recorded
 * meeting instance. Existing rows keep their status, visibility and storage
 * key; nothing is downloaded.
 */
export async function ingestRecordingMeeting(meeting: ZoomRecordingMeeting): Promise<IngestOutcome> {
  const uuid = typeof meeting.uuid === "string" && meeting.uuid.trim() ? meeting.uuid.trim() : null;
  const meetingId = meeting.id === undefined || meeting.id === null || meeting.id === "" ? null : String(meeting.id);
  if (!uuid) return { status: "ignored", reason: "No meeting UUID." };
  if (uuid.length > 128) return { status: "ignored", reason: "Meeting UUID too long." };
  const files = selectRecordingFiles(meeting.recording_files);
  const startedAt = time(files[0]?.file.recording_start) ?? time(meeting.start_time);
  const session = await sessionForRecording(meetingId, uuid, startedAt);
  if (!session) return { status: "ignored", reason: "Not an LMS session meeting." };
  if (!files.length) return { status: "ignored", reason: "No completed recording files to copy yet." };
  const endedAt = time(files[0]?.file.recording_end);

  let created = false;
  let recording = await prisma.recording.findUnique({ where: { zoomMeetingUuid: uuid } });
  if (!recording) {
    try {
      recording = await prisma.recording.create({
        data: { sessionId: session.id, zoomMeetingUuid: uuid, startedAt, endedAt, status: "PENDING", visibility: RECORDING_DEFAULT_VISIBILITY },
      });
      created = true;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      recording = await prisma.recording.findUnique({ where: { zoomMeetingUuid: uuid } });
      if (!recording) throw error;
    }
  } else if ((!recording.startedAt && startedAt) || (!recording.endedAt && endedAt)) {
    await prisma.recording.update({
      where: { id: recording.id },
      data: { startedAt: recording.startedAt ?? startedAt, endedAt: recording.endedAt ?? endedAt },
    });
  }

  let assetsCreated = 0;
  for (const { kind, file } of files) {
    const existing = await prisma.recordingAsset.findUnique({ where: { zoomFileId: file.id } });
    if (existing) {
      // Only a not-yet-copied asset takes Zoom's (possibly corrected) size.
      if (existing.status === "PENDING" && size(file) && BigInt(size(file)) !== BigInt(existing.sizeBytes))
        await prisma.recordingAsset.updateMany({ where: { id: existing.id, status: "PENDING" }, data: { sizeBytes: BigInt(size(file)) } });
      continue;
    }
    try {
      await prisma.recordingAsset.create({
        data: { recordingId: recording.id, kind, zoomFileId: file.id, sizeBytes: BigInt(size(file)), status: "PENDING" },
      });
      assetsCreated += 1;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error; // a concurrent run created it
    }
  }
  await recomputeRecordingStatus(recording.id);
  return { status: "ingested", recordingId: recording.id, created, assetsCreated };
}

type EventPayload = { payload?: { object?: ZoomRecordingMeeting } };

/**
 * Ingest from stored recording.completed events, newest first, whether or
 * not Phase 3 has marked them processed. Read-only on ZoomWebhookEvent.
 */
export async function ingestRecordingEvents(options: { limit?: number } = {}) {
  const rows = await prisma.zoomWebhookEvent.findMany({
    where: { event: RECORDING_COMPLETED_EVENT },
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(options.limit ?? 200, 1), 1000),
    select: { id: true, payload: true },
  });
  const totals = { examined: 0, ingested: 0, ignored: 0, recordingsCreated: 0, assetsCreated: 0 };
  for (const row of rows) {
    totals.examined += 1;
    const outcome = await ingestRecordingMeeting((row.payload as EventPayload | null)?.payload?.object ?? {});
    if (outcome.status === "ignored") totals.ignored += 1;
    else {
      totals.ingested += 1;
      totals.assetsCreated += outcome.assetsCreated;
      if (outcome.created) totals.recordingsCreated += 1;
    }
  }
  return totals;
}

/**
 * Backfill for missed webhooks: list each active host's cloud recordings in
 * [from, to] (at most RECORDING_BACKFILL_MAX_DAYS) and ingest the ones that
 * belong to our sessions.
 */
export async function backfillRecordings(window: { from: Date; to: Date }) {
  const span = window.to.getTime() - window.from.getTime();
  if (!(span >= 0)) throw new RangeError("The backfill window must end after it starts.");
  if (span > RECORDING_BACKFILL_MAX_DAYS * 86_400_000) throw new RangeError(`The backfill window is at most ${RECORDING_BACKFILL_MAX_DAYS} days.`);
  zoomApiEnv(); // ZoomConfigError (names only) before any call
  const hosts = await prisma.zoomHost.findMany({ where: { active: true }, select: { id: true, zoomUserId: true } });
  const totals = { hosts: hosts.length, meetings: 0, ingested: 0, ignored: 0, recordingsCreated: 0, assetsCreated: 0 };
  for (const host of hosts) {
    for (const meeting of await listUserRecordings(host.zoomUserId, window.from, window.to)) {
      totals.meetings += 1;
      const outcome = await ingestRecordingMeeting(meeting);
      if (outcome.status === "ignored") totals.ignored += 1;
      else {
        totals.ingested += 1;
        totals.assetsCreated += outcome.assetsCreated;
        if (outcome.created) totals.recordingsCreated += 1;
      }
    }
  }
  return totals;
}

// ── Status ─────────────────────────────────────────────────────────────────

/** The file a recording plays: its VIDEO, else its AUDIO. */
const primaryOf = <T extends { kind: RecordingAssetKind }>(assets: T[]) =>
  assets.find((a) => a.kind === "VIDEO") ?? assets.find((a) => a.kind === "AUDIO") ?? null;

/** A recording's status follows its primary media file; extra files (transcript) never block playback. */
export async function recomputeRecordingStatus(recordingId: string) {
  const assets = await prisma.recordingAsset.findMany({ where: { recordingId } });
  const primary = primaryOf(assets) ?? assets[0];
  if (!primary) return;
  await prisma.recording.update({
    where: { id: recordingId },
    data: { status: primary.status, attempts: primary.attempts, lastError: primary.status === "READY" ? null : primary.lastError },
  });
}

// ── Copy worker ────────────────────────────────────────────────────────────

const EXTENSION: Record<RecordingAssetKind, string> = { VIDEO: "mp4", AUDIO: "m4a", TRANSCRIPT: "vtt", CHAT: "txt" };
const CONTENT_TYPE: Record<RecordingAssetKind, string> = { VIDEO: "video/mp4", AUDIO: "audio/mp4", TRANSCRIPT: "text/vtt", CHAT: "text/plain" };

/** Deterministic, so a re-run after a crash finds (or overwrites) the same object. */
export function recordingObjectKey(asset: { kind: RecordingAssetKind; zoomFileId: string }, recording: { id: string; sessionId: string }) {
  return `lms/recordings/${safeFilename(recording.sessionId)}/${safeFilename(recording.id)}/${asset.kind.toLowerCase()}-${safeFilename(asset.zoomFileId)}.${EXTENSION[asset.kind]}`;
}

export type CopyResult = { assetId: string; status: "ready" | "failed" | "skipped"; note?: string };

/** A message safe to keep on the row and show staff: no URLs, no tokens. */
function failureText(error: unknown) {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : "Copy failed.";
  return raw.replace(/https?:\/\/\S+/g, "[url]").slice(0, 1000);
}

/** Claim an asset with a conditional update on the status and updatedAt we read: only one run wins. */
async function claim(asset: { id: string; status: RecordingCopyStatus; updatedAt: Date }) {
  const { count } = await prisma.recordingAsset.updateMany({
    where: { id: asset.id, status: asset.status, updatedAt: asset.updatedAt },
    data: { status: "COPYING", lastError: null },
  });
  return count === 1;
}

async function copyOne(store: RecordingStore, assetId: string): Promise<CopyResult> {
  const asset = await prisma.recordingAsset.findUnique({ where: { id: assetId } });
  if (!asset || asset.status !== "COPYING") return { assetId, status: "skipped" };
  const recording = await prisma.recording.findUnique({ where: { id: asset.recordingId } });
  if (!recording) return { assetId, status: "skipped" };
  const key = recordingObjectKey(asset, recording);
  const expected = Number(asset.sizeBytes);
  try {
    // Resume: an earlier run uploaded it but stopped before saving READY.
    const already = await store.head(key);
    if (!(already && (!expected || already.size === expected))) {
      const listing = await listRecordings(recording.zoomMeetingUuid);
      const file = listing.recording_files?.find((f) => f.id === asset.zoomFileId);
      if (!file?.download_url) throw new Error("This file is no longer in the Zoom cloud recording.");
      const response = await openRecordingDownload(file.download_url);
      const body = Readable.fromWeb(response.body as unknown as NodeWebReadableStream<Uint8Array>);
      try {
        await store.upload({ key, body, contentType: CONTENT_TYPE[asset.kind] });
      } finally {
        body.destroy();
      }
      const stored = await store.head(key);
      if (!stored) throw new Error("The upload finished but the object is not in storage.");
      const zoomSize = typeof file.file_size === "number" ? file.file_size : expected;
      if (zoomSize && stored.size !== zoomSize) throw new Error(`Stored size ${stored.size} does not match Zoom's ${zoomSize} bytes.`);
    }
    await prisma.recordingAsset.update({
      where: { id: asset.id },
      data: { status: "READY", storageKey: key, lastError: null, ...(already && !expected ? { sizeBytes: BigInt(already.size) } : {}) },
    });
    await recomputeRecordingStatus(recording.id);
    return { assetId, status: "ready" };
  } catch (error) {
    const message = failureText(error);
    await prisma.recordingAsset.update({ where: { id: asset.id }, data: { status: "FAILED", attempts: { increment: 1 }, lastError: message } });
    await recomputeRecordingStatus(recording.id);
    if (!(error instanceof ZoomApiError)) console.error("[lms-recordings] copy failed", asset.id, error instanceof Error ? error.name : "error");
    return { assetId, status: "failed", note: message };
  }
}

/**
 * Copy up to `limit` assets into storage, one at a time: PENDING ones, FAILED
 * ones still under RECORDING_MAX_AUTO_ATTEMPTS, and COPYING ones abandoned
 * longer than RECORDING_STALE_COPY_MS ago (a crash mid-copy). Throws
 * RecordingStorageConfigError or ZoomConfigError, before claiming anything,
 * when either is not configured.
 */
export async function copyRecordingAssets(options: { limit?: number; now?: Date; store?: RecordingStore } = {}) {
  const store = options.store ?? recordingStorage();
  zoomApiEnv();
  const now = options.now ?? new Date();
  const limit = Math.min(Math.max(options.limit ?? RECORDING_COPY_BATCH_SIZE, 1), 10);
  const candidates = await prisma.recordingAsset.findMany({
    where: {
      OR: [
        { status: "PENDING" },
        { status: "FAILED", attempts: { lt: RECORDING_MAX_AUTO_ATTEMPTS } },
        { status: "COPYING", updatedAt: { lt: new Date(now.getTime() - RECORDING_STALE_COPY_MS) } },
      ],
    },
    // Primary media before extras, oldest first.
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    take: limit * 3,
    select: { id: true, status: true, updatedAt: true, kind: true },
  });
  const results: CopyResult[] = [];
  for (const candidate of candidates) {
    if (results.length >= limit) break;
    if (!(await claim(candidate))) continue; // another run took it
    results.push(await copyOne(store, candidate.id));
  }
  return {
    attempted: results.length,
    ready: results.filter((r) => r.status === "ready").length,
    failed: results.filter((r) => r.status === "failed").length,
    results: results.map(({ assetId, status }) => ({ assetId, status })),
  };
}

/**
 * How the process endpoint runs a copy batch after its response is sent
 * (Next's after(), so a long upload never holds the cron request open).
 * Swappable in tests, where there is no request scope.
 */
export const recordingCopyRuntime = {
  schedule(task: () => Promise<unknown>) {
    after(task);
  },
};

// ── Admin ──────────────────────────────────────────────────────────────────

export type RecordingAssetAdminView = {
  id: string;
  kind: RecordingAssetKind;
  status: RecordingCopyStatus;
  sizeBytes: number;
  attempts: number;
  lastError: string | null;
};

export type RecordingAdminView = {
  id: string;
  sessionId: string;
  status: RecordingCopyStatus;
  visibility: "HIDDEN" | "PUBLISHED";
  publishedAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  lastError: string | null;
  assets: RecordingAssetAdminView[];
};

/** Recordings (with their files, never storage keys) per session, for the Live sessions admin. */
export async function recordingsForSessions(sessionIds: string[]): Promise<Map<string, RecordingAdminView[]>> {
  const map = new Map<string, RecordingAdminView[]>();
  if (!sessionIds.length) return map;
  const recordings = await prisma.recording.findMany({ where: { sessionId: { in: sessionIds } }, orderBy: { createdAt: "asc" } });
  const assets = recordings.length
    ? await prisma.recordingAsset.findMany({ where: { recordingId: { in: recordings.map((r) => r.id) } }, orderBy: { createdAt: "asc" } })
    : [];
  for (const r of recordings) {
    const view: RecordingAdminView = {
      id: r.id,
      sessionId: r.sessionId,
      status: r.status,
      visibility: r.visibility,
      publishedAt: r.publishedAt,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      lastError: r.lastError,
      assets: assets
        .filter((a) => a.recordingId === r.id)
        .map((a) => ({ id: a.id, kind: a.kind, status: a.status, sizeBytes: Number(a.sizeBytes), attempts: a.attempts, lastError: a.lastError })),
    };
    map.set(r.sessionId, [...(map.get(r.sessionId) ?? []), view]);
  }
  return map;
}

export class RecordingActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordingActionError";
  }
}

/** Staff Retry: a FAILED asset goes back to PENDING with a fresh attempt count; the last error stays visible until the next run. */
export async function retryRecordingAsset(assetId: string) {
  const asset = await prisma.recordingAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw new RecordingActionError("That recording file no longer exists.");
  if (asset.status !== "FAILED") throw new RecordingActionError("Only a failed file can be retried.");
  await prisma.recordingAsset.updateMany({ where: { id: assetId, status: "FAILED" }, data: { status: "PENDING", attempts: 0 } });
  await recomputeRecordingStatus(asset.recordingId);
  return asset.recordingId;
}

/** Publish (READY only) or hide a recording. Returns its session id. */
export async function setRecordingVisibility(recordingId: string, publish: boolean, now = new Date()) {
  const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
  if (!recording) throw new RecordingActionError("That recording no longer exists.");
  if (publish && recording.status !== "READY") throw new RecordingActionError("A recording can be published once its video is copied (READY).");
  await prisma.recording.update({
    where: { id: recordingId },
    data: publish ? { visibility: "PUBLISHED", publishedAt: recording.publishedAt ?? now } : { visibility: "HIDDEN", publishedAt: null },
  });
  return recording.sessionId;
}

// ── Students ───────────────────────────────────────────────────────────────

export const watchPath = (recordingId: string) => `/seerah/classroom/recordings/${encodeURIComponent(recordingId)}`;
export const playPath = (recordingId: string) => `/api/sirah/lms/recordings/${encodeURIComponent(recordingId)}/play`;

export type StudentRecording = { recordingId: string; sessionId: string; title: string; startsAt: Date; durationMin: number; kind: "VIDEO" | "AUDIO" };

/**
 * READY + PUBLISHED recordings of the student's cohort's sessions, newest
 * first. Not allowed (the paid + active rule) -> none, and nothing is read.
 */
export async function studentRecordings(userId: string, now = new Date()): Promise<StudentRecording[]> {
  const access = await sirahStudentCohortAccess(userId, now);
  if (!access.allowed || !access.cohortId) return [];
  const sessions = await prisma.lmsSession.findMany({
    where: { cohortId: access.cohortId },
    select: { id: true, title: true, startsAt: true, durationMin: true },
  });
  if (!sessions.length) return [];
  const recordings = await prisma.recording.findMany({
    where: { sessionId: { in: sessions.map((s) => s.id) }, status: "READY", visibility: "PUBLISHED" },
    select: { id: true, sessionId: true },
  });
  if (!recordings.length) return [];
  const assets = await prisma.recordingAsset.findMany({
    where: { recordingId: { in: recordings.map((r) => r.id) }, status: "READY", kind: { in: ["VIDEO", "AUDIO"] } },
    select: { recordingId: true, kind: true },
  });
  const out: StudentRecording[] = [];
  for (const r of recordings) {
    const session = sessions.find((s) => s.id === r.sessionId);
    const primary = primaryOf(assets.filter((a) => a.recordingId === r.id));
    if (!session || !primary) continue;
    out.push({ recordingId: r.id, sessionId: r.sessionId, title: session.title, startsAt: session.startsAt, durationMin: session.durationMin, kind: primary.kind as "VIDEO" | "AUDIO" });
  }
  return out.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
}

export type PlaybackDecision =
  | { ok: true; key: string; contentType: string; filename: string; kind: "VIDEO" | "AUDIO"; title: string; startsAt: Date }
  | { ok: false; status: 403 | 404; reason: "not_found" | "not_enrolled" | "not_available" };

/**
 * Whether this student may play this recording now, and which object: the
 * recording exists; the student has an active, paid enrolment in its
 * session's cohort; it is READY and PUBLISHED with a stored VIDEO (else AUDIO).
 */
export async function resolveRecordingPlayback(userId: string, recordingId: string, now = new Date()): Promise<PlaybackDecision> {
  const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
  if (!recording) return { ok: false, status: 404, reason: "not_found" };
  const session = await prisma.lmsSession.findUnique({ where: { id: recording.sessionId }, select: { cohortId: true, title: true, startsAt: true } });
  if (!session) return { ok: false, status: 404, reason: "not_found" };
  if (!(await studentMayJoinCohort(userId, session.cohortId, now))) return { ok: false, status: 403, reason: "not_enrolled" };
  if (recording.status !== "READY" || recording.visibility !== "PUBLISHED") return { ok: false, status: 404, reason: "not_available" };
  const assets = await prisma.recordingAsset.findMany({ where: { recordingId, status: "READY", kind: { in: ["VIDEO", "AUDIO"] } } });
  const primary = primaryOf(assets.filter((a) => a.storageKey));
  if (!primary?.storageKey) return { ok: false, status: 404, reason: "not_available" };
  const kind = primary.kind as "VIDEO" | "AUDIO";
  const filename = `${safeFilename(session.title) || "class-recording"}.${EXTENSION[kind]}`;
  return { ok: true, key: primary.storageKey, contentType: CONTENT_TYPE[kind], filename, kind, title: session.title, startsAt: session.startsAt };
}
