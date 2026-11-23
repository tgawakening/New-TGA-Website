/**
 * Class-recording policy (LMS Phase 4), as named defaults so management's
 * decision can change without a rewrite. Every rule the recordings code
 * enforces reads from here.
 *
 * Current defaults, pending management's confirmation:
 * - Who may watch: students with an active, paid Sīrah enrolment in the
 *   session's cohort (the same rule as joining a live class, lib/lms/access).
 * - How long: only while that enrolment stays active and paid. A lapsed or
 *   cancelled student is refused at the next play request.
 * - Stream only: no download link is ever offered, the player hides its
 *   download control, and the presigned URL is short-lived and inline. (A
 *   determined viewer can still capture a stream; this is a deterrent, not
 *   DRM.)
 * - Zoom's cloud copy is KEPT. No code path deletes a Zoom recording; the
 *   flag below documents the decision and is asserted false where it matters.
 * - New recordings are HIDDEN until staff publish them.
 */

/** Who may watch. Only the enrolment rule is implemented today. */
export const RECORDING_AUDIENCE = "enrolled-active-paid-in-cohort" as const;

/** Access ends when the enrolment does (checked on every play request). */
export const RECORDING_ACCESS_WHILE_ENROLLED_ONLY = true;

/** Never offer a download: inline Content-Disposition, no download control. */
export const RECORDING_STREAM_ONLY = true;

/** Lifetime of the presigned playback URL the play route redirects to (1-4 h). */
export const RECORDING_PLAYBACK_URL_SECONDS = 2 * 60 * 60;

/** Keep the Zoom cloud copy. Deletion is not implemented and must stay off until the retention decision. */
export const RECORDING_DELETE_ZOOM_CLOUD_COPY = false as const;

/** Visibility of a newly ingested recording. */
export const RECORDING_DEFAULT_VISIBILITY = "HIDDEN" as const;

/**
 * Which Zoom files are copied besides the primary MP4 (shared screen with
 * speaker, else the largest MP4). Chat is off by default: it can hold private
 * messages between participants.
 */
export const RECORDING_INGEST_FILES = { audio: true, transcript: true, chat: false } as const;

/** Copy worker: assets per invocation, kept small for container memory and request time. */
export const RECORDING_COPY_BATCH_SIZE = 2;

/** A failed asset is retried automatically until it has failed this many times; then only an admin Retry. */
export const RECORDING_MAX_AUTO_ATTEMPTS = 3;

/** An asset left COPYING this long (a crash or restart mid-copy) is picked up again. */
export const RECORDING_STALE_COPY_MS = 3 * 60 * 60 * 1000;

/** Multipart upload part size and parallel parts: memory held is about size x queue. */
export const RECORDING_UPLOAD_PART_BYTES = 16 * 1024 * 1024;
export const RECORDING_UPLOAD_QUEUE_SIZE = 2;

/** A recording.completed event is matched to the session whose start is nearest, within this window. */
export const RECORDING_MATCH_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Backfill: how far back the scheduled backfill looks by default (Zoom caps one request at a month). */
export const RECORDING_BACKFILL_DEFAULT_DAYS = 7;
export const RECORDING_BACKFILL_MAX_DAYS = 30;
