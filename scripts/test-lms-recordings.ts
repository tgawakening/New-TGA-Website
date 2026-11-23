/**
 * LMS Phase 4: class recordings (ingest, streaming copy, gated playback).
 *
 * Mocks only: Zoom fetch is stubbed (OAuth, the recordings API and the file
 * downloads), storage is an in-memory fake RecordingStore, and the database
 * is the in-memory fake Prisma. Nothing reaches Zoom, Spaces or a database.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import test, { afterEach, before, beforeEach, describe } from "node:test";
import { defaults, installFakePrisma, table, tables } from "./fixtures/fake-prisma";

installFakePrisma();

const ZOOM_ENV = {
  ZOOM_ACCOUNT_ID: "acct_test",
  ZOOM_CLIENT_ID: "client_test",
  ZOOM_CLIENT_SECRET: "secret_test",
  ZOOM_DEFAULT_HOST_USER_ID: "host@example.test",
  ZOOM_WEBHOOK_SECRET_TOKEN: "whsec_test_token",
};
const STORAGE_ENV = {
  SPACES_ENDPOINT: "https://storage.example.test",
  SPACES_REGION: "test-1",
  SPACES_BUCKET: "bucket-test",
  SPACES_ACCESS_KEY: "AKIA_TEST_VALUE",
  SPACES_SECRET_KEY: "storage-secret-test-value",
};
const CRON = "cron-secret-test-value";
const STORAGE_NAMES = Object.keys(STORAGE_ENV);

let recordings: typeof import("../lib/lms/recordings");
let storage: typeof import("../lib/lms/recording-storage");
let policy: typeof import("../lib/lms/recording-policy");
let token: typeof import("../lib/zoom/token");
let processor: typeof import("../lib/zoom/processor");
let playRoute: typeof import("../app/api/sirah/lms/recordings/[id]/play/route");
let processRoute: typeof import("../app/api/internal/lms/recordings/process/route");
let backfillRoute: typeof import("../app/api/internal/lms/recordings/backfill/route");
let SIRAH_BATCH: string;
let SIRAH_SLUG: string;
before(async () => {
  recordings = await import("../lib/lms/recordings");
  storage = await import("../lib/lms/recording-storage");
  policy = await import("../lib/lms/recording-policy");
  token = await import("../lib/zoom/token");
  processor = await import("../lib/zoom/processor");
  playRoute = await import("../app/api/sirah/lms/recordings/[id]/play/route");
  processRoute = await import("../app/api/internal/lms/recordings/process/route");
  backfillRoute = await import("../app/api/internal/lms/recordings/backfill/route");
  ({ SIRAH_BATCH, SIRAH_SLUG } = await import("../lib/sirah/catalog"));
});

// ── Fixtures ───────────────────────────────────────────────────────────────

const MEETING = "85746065432";
const GEN_MUMIN_MEETING = "99911122233";
const UUID = "inst-uuid-week1==";
const T0 = Date.parse("2026-12-06T18:00:00Z");
const at = (min: number) => new Date(T0 + min * 60_000);
const iso = (min: number) => at(min).toISOString().replace(/\.\d{3}Z$/, "Z");
const OTHER_COHORT = "OTHER-COHORT";

type File = { id: string; file_type: string; recording_type?: string; file_size: number; file_extension?: string; status?: string; recording_start?: string; recording_end?: string; download_url?: string };
const file = (id: string, file_type: string, file_size: number, recording_type?: string, extra: Partial<File> = {}): File => ({
  id, file_type, file_size, recording_type, status: "completed", recording_start: iso(0), recording_end: iso(60),
  download_url: `https://zoom.us/rec/download/${id}?token=secret-download-token`, ...extra,
});
const FILES = (): File[] => [
  file("f_gallery", "MP4", 5000, "gallery_view"),
  file("f_screen", "MP4", 3000, "shared_screen_with_speaker_view"),
  file("f_audio", "M4A", 800, "audio_only"),
  file("f_vtt", "TRANSCRIPT", 120, "audio_transcript", { file_extension: "VTT" }),
  file("f_chat", "CHAT", 50, "chat_file"),
  file("f_timeline", "TIMELINE", 10, "timeline"),
];

let seq = 0;
function student(email: string, batchCode = SIRAH_BATCH, order: Record<string, unknown> = {}) {
  seq += 1;
  const id = `user_${seq}`;
  table("user").push({ id, fullName: `Student ${seq}`, email, status: "ACTIVE", role: "STUDENT" });
  table("sirahOrder").push({
    id: `order_${seq}`, userId: id, courseId: "course_sirah", batchCode, plan: "ANNUAL", method: "STRIPE",
    paymentState: "PAID", enrolmentState: "ACTIVE", paidCount: 1, registrationId: null, archivedAt: null,
    accessEndsAt: null, programmeStart: null, programmeEnd: null, cycleBillingDay: null, cycleGraceDay: null,
    cycleFirstDueAt: null, createdAt: new Date(T0 - 86_400_000), ...order,
  });
  const cookie = `tok_${seq}_${randomBytes(4).toString("hex")}`;
  table("session").push({ id: `s_${seq}`, userId: id, tokenHash: createHash("sha256").update(cookie).digest("hex"), expiresAt: new Date(Date.now() + 3600_000) });
  return { id, cookie };
}

function lmsSession(overrides: Record<string, unknown> = {}) {
  const row = {
    id: "sess_1", cohortId: SIRAH_BATCH, title: "Week 1: Makkah", startsAt: at(0), durationMin: 60, status: "ENDED",
    zoomHostId: "host_1", zoomMeetingId: MEETING, zoomMeetingUuid: null, zoomStartedAt: at(0), zoomEndedAt: at(60),
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  table("lmsSession").push(row);
  return row;
}

let eventSeq = 0;
function storeEvent(object: Record<string, unknown>, processed = true) {
  eventSeq += 1;
  const row = {
    id: `evt_${eventSeq}`, dedupeKey: `k${eventSeq}`, event: "recording.completed",
    payload: { event: "recording.completed", event_ts: at(90).getTime(), download_token: "secret-download-token", payload: { account_id: "acct", object } },
    receivedAt: at(90), processedAt: processed ? at(91) : null, error: null,
  };
  table("zoomWebhookEvent").push(row);
  return row;
}
const recordingObject = (overrides: Record<string, unknown> = {}) => ({ id: MEETING, uuid: UUID, start_time: iso(0), duration: 60, recording_files: FILES(), ...overrides });

// ── Zoom fetch mock ────────────────────────────────────────────────────────

let listings = new Map<string, File[]>(); // meeting uuid -> files (the recordings API)
let userRecordings: Record<string, unknown>[] = [];
let downloads: string[] = [];
let failDownloads = new Set<string>();
const originalFetch = global.fetch;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** A streamed body of `size` bytes in 1 KB chunks, so a copy that buffers would show. */
function streamOf(size: number) {
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= size) return controller.close();
      const n = Math.min(1024, size - sent);
      sent += n;
      controller.enqueue(new Uint8Array(n));
    },
  });
}

// ── Storage mock ───────────────────────────────────────────────────────────

type Upload = { key: string; bytes: number; chunks: number; streamed: boolean; contentType: string };
let objects = new Map<string, number>();
let uploads: Upload[] = [];
let failUploads = false;
const fakeStore: import("../lib/lms/recording-storage").RecordingStore = {
  async head(key) {
    return objects.has(key) ? { size: objects.get(key)! } : null;
  },
  async upload({ key, body, contentType }) {
    if (failUploads) throw new Error("Storage write failed (test).");
    let bytes = 0;
    let chunks = 0;
    for await (const chunk of body) {
      bytes += (chunk as Uint8Array).length;
      chunks += 1;
    }
    uploads.push({ key, bytes, chunks, streamed: body instanceof Readable, contentType });
    objects.set(key, bytes);
  },
  async presign({ key, expiresIn, contentType }) {
    return `https://bucket-test.storage.example.test/${key}?X-Amz-Expires=${expiresIn}&X-Amz-Signature=fake&type=${encodeURIComponent(contentType)}`;
  },
};
let createStore: typeof storage.recordingStorageRuntime.create;
let scheduled: Promise<unknown>[] = [];
let schedule: typeof recordings.recordingCopyRuntime.schedule;

beforeEach(() => {
  tables.clear();
  seq = 0;
  eventSeq = 0;
  listings = new Map([[UUID, FILES()]]);
  userRecordings = [];
  downloads = [];
  failDownloads = new Set();
  objects = new Map();
  uploads = [];
  failUploads = false;
  scheduled = [];
  for (const name of STORAGE_NAMES) delete process.env[name];
  Object.assign(process.env, ZOOM_ENV, STORAGE_ENV, { CRON_SECRET: CRON });
  token.clearZoomTokenCache();
  defaults.recording = { attempts: 0, status: "PENDING", visibility: "HIDDEN", publishedAt: null, lastError: null, startedAt: null, endedAt: null };
  defaults.recordingAsset = { attempts: 0, status: "PENDING", storageKey: null, lastError: null, sizeBytes: BigInt(0) };
  table("course").push({ id: "course_sirah", slug: SIRAH_SLUG });
  table("zoomHost").push({ id: "host_1", email: "teacher@example.test", licensed: true, active: true, zoomUserId: "zoom_user_1" });
  createStore = storage.recordingStorageRuntime.create;
  storage.recordingStorageRuntime.create = () => fakeStore;
  schedule = recordings.recordingCopyRuntime.schedule;
  recordings.recordingCopyRuntime.schedule = (task) => {
    scheduled.push(task());
  };
  global.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://zoom.us/oauth/token")) return json({ access_token: "tok", expires_in: 3600, scope: "" });
    const dl = /^https:\/\/zoom\.us\/rec\/download\/([^?]+)/.exec(url);
    if (dl) {
      downloads.push(dl[1]);
      if (failDownloads.has(dl[1])) return json({ code: 3301, message: "This recording does not exist." }, 404);
      const f = [...listings.values()].flat().find((x) => x.id === dl[1]);
      return new Response(streamOf(f?.file_size ?? 0), { status: 200, headers: { "Content-Type": "application/octet-stream" } });
    }
    const listing = /\/v2\/meetings\/([^/]+)\/recordings$/.exec(url);
    if (listing) {
      const uuid = decodeURIComponent(decodeURIComponent(listing[1]));
      const files = listings.get(uuid) ?? listings.get(decodeURIComponent(listing[1]));
      return files ? json({ uuid, id: Number(MEETING), recording_files: files }) : json({ code: 3301, message: "No recording." }, 404);
    }
    if (/\/v2\/users\/[^/]+\/recordings\?/.test(url)) return json({ meetings: userRecordings });
    throw new Error(`Unexpected fetch in test: ${url}`);
  }) as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  storage.recordingStorageRuntime.create = createStore;
  recordings.recordingCopyRuntime.schedule = schedule;
});

const recordingRows = () => table("recording");
const assetRows = () => table("recordingAsset");
const asset = (zoomFileId: string) => assetRows().find((a) => a.zoomFileId === zoomFileId)!;
const base = "http://localhost:3000";
const play = (id: string, cookie?: string) =>
  playRoute.GET(new Request(`${base}/api/sirah/lms/recordings/${id}/play`, { headers: cookie ? { cookie: `ga_session=${cookie}` } : {} }), { params: Promise.resolve({ id }) });
const post = (route: { POST(r: Request): Promise<Response> }, path: string, bearer: string | null = CRON) =>
  route.POST(new Request(`${base}${path}`, { method: "POST", headers: bearer ? { authorization: `Bearer ${bearer}` } : {} }));

/** Ingest + copy everything, then mark the recording published. */
async function readyAndPublished() {
  lmsSession();
  storeEvent(recordingObject());
  await recordings.ingestRecordingEvents();
  while ((await recordings.copyRecordingAssets({ store: fakeStore, limit: 10 })).attempted) {
    /* drain */
  }
  const recording = recordingRows()[0];
  await recordings.setRecordingVisibility(String(recording.id), true);
  return String(recording.id);
}

// ── File selection ─────────────────────────────────────────────────────────

describe("file selection", () => {
  test("primary MP4 is shared screen with speaker; audio and VTT transcript are added; chat and timeline are not", () => {
    const picked = recordings.selectRecordingFiles(FILES());
    assert.deepEqual(picked.map((p) => [p.kind, p.file.id]), [["VIDEO", "f_screen"], ["AUDIO", "f_audio"], ["TRANSCRIPT", "f_vtt"]]);
    assert.equal(policy.RECORDING_INGEST_FILES.chat, false);
  });

  test("without a shared-screen MP4 the largest MP4 wins; files still processing are skipped", () => {
    const picked = recordings.selectRecordingFiles([
      file("small", "MP4", 100, "active_speaker"),
      file("big", "MP4", 900, "gallery_view"),
      file("bigger_processing", "MP4", 9999, "speaker_view", { status: "processing" }),
    ]);
    assert.deepEqual(picked.map((p) => p.file.id), ["big"]);
  });
});

// ── Ingest ─────────────────────────────────────────────────────────────────

describe("ingest", () => {
  test("matches recording.completed to our session and upserts Recording + assets (PENDING, HIDDEN); nothing downloaded", async () => {
    lmsSession();
    storeEvent(recordingObject());
    const totals = await recordings.ingestRecordingEvents();
    assert.deepEqual(totals, { examined: 1, ingested: 1, ignored: 0, recordingsCreated: 1, assetsCreated: 3 });
    const [recording] = recordingRows();
    assert.equal(recording.sessionId, "sess_1");
    assert.equal(recording.zoomMeetingUuid, UUID);
    assert.equal(recording.status, "PENDING");
    assert.equal(recording.visibility, "HIDDEN");
    assert.deepEqual(assetRows().map((a) => [a.kind, a.zoomFileId, a.status, a.sizeBytes]), [
      ["VIDEO", "f_screen", "PENDING", BigInt(3000)],
      ["AUDIO", "f_audio", "PENDING", BigInt(800)],
      ["TRANSCRIPT", "f_vtt", "PENDING", BigInt(120)],
    ]);
    assert.deepEqual(downloads, []);
    assert.ok(!JSON.stringify(assetRows(), (_k, v) => (typeof v === "bigint" ? String(v) : v)).includes("zoom.us"), "no Zoom URL is stored");
  });

  test("is idempotent: a second run (and a duplicate event) adds nothing", async () => {
    lmsSession();
    storeEvent(recordingObject());
    await recordings.ingestRecordingEvents();
    storeEvent(recordingObject());
    const again = await recordings.ingestRecordingEvents();
    assert.equal(again.recordingsCreated, 0);
    assert.equal(again.assetsCreated, 0);
    assert.equal(recordingRows().length, 1);
    assert.equal(assetRows().length, 3);
  });

  test("ignores meetings that are not ours (Gen-Mumin) and leaves every event row untouched", async () => {
    lmsSession();
    const gen = storeEvent(recordingObject({ id: GEN_MUMIN_MEETING, uuid: "gen-mumin-uuid==" }));
    const unprocessed = storeEvent(recordingObject(), false);
    const before = JSON.stringify(table("zoomWebhookEvent"));
    const totals = await recordings.ingestRecordingEvents();
    assert.equal(totals.ignored, 1);
    assert.equal(totals.ingested, 1, "read by type, processed or not");
    assert.equal(recordingRows().length, 1);
    assert.ok(!recordingRows().some((r) => r.zoomMeetingUuid === "gen-mumin-uuid=="));
    assert.equal(JSON.stringify(table("zoomWebhookEvent")), before, "ZoomWebhookEvent is read-only here");
    assert.equal(gen.processedAt instanceof Date, true);
    assert.equal(unprocessed.processedAt, null);
  });

  test("a recurring meeting id goes to the session nearest the recording start; outside the window it is ignored", async () => {
    lmsSession({ id: "sess_1", startsAt: at(0) });
    lmsSession({ id: "sess_2", startsAt: at(7 * 24 * 60), title: "Week 2" });
    const outcome = await recordings.ingestRecordingMeeting(recordingObject({ uuid: "week2==", start_time: iso(7 * 24 * 60), recording_files: [file("w2", "MP4", 10, "shared_screen_with_speaker_view", { recording_start: iso(7 * 24 * 60 + 2) })] }));
    assert.equal(outcome.status, "ingested");
    assert.equal(recordingRows()[0].sessionId, "sess_2");
    const far = await recordings.ingestRecordingMeeting(recordingObject({ uuid: "far==", start_time: iso(3 * 24 * 60), recording_files: [file("far", "MP4", 10, "x", { recording_start: iso(3 * 24 * 60) })] }));
    assert.equal(far.status, "ignored");
  });

  test("a session holding the meeting UUID wins over the meeting id", async () => {
    lmsSession({ id: "sess_by_id", startsAt: at(0) });
    lmsSession({ id: "sess_by_uuid", zoomMeetingId: "11111111111", zoomMeetingUuid: UUID, startsAt: at(30) });
    await recordings.ingestRecordingMeeting(recordingObject());
    assert.equal(recordingRows()[0].sessionId, "sess_by_uuid");
  });

  test("Phase 3 behaviour is unchanged: recording.completed is still marked processed with no handler", async () => {
    lmsSession();
    const row = storeEvent(recordingObject(), false);
    const result = await processor.processStoredZoomEvent(row.id, at(95));
    assert.equal(result.status, "ignored");
    assert.equal(recordingRows().length, 0, "Phase 3 processing does not ingest recordings");
  });

  test("backfill lists each active host's recordings in the window and ingests only ours", async () => {
    lmsSession();
    userRecordings = [recordingObject(), recordingObject({ id: GEN_MUMIN_MEETING, uuid: "gen==" })];
    const response = await post(backfillRoute, "/api/internal/lms/recordings/backfill?from=2026-12-01&to=2026-12-07");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { hosts: 1, meetings: 2, ingested: 1, ignored: 1, recordingsCreated: 1, assetsCreated: 3 });
    const tooLong = await post(backfillRoute, "/api/internal/lms/recordings/backfill?from=2026-10-01&to=2026-12-07");
    assert.equal(tooLong.status, 400);
  });
});

// ── Copy worker ────────────────────────────────────────────────────────────

describe("copy worker", () => {
  test("streams each asset into storage: PENDING -> READY with the object key; the recording becomes READY", async () => {
    lmsSession();
    storeEvent(recordingObject());
    await recordings.ingestRecordingEvents();
    const run = await recordings.copyRecordingAssets({ store: fakeStore, limit: 2 });
    assert.equal(run.attempted, 2, "a small batch per invocation");
    assert.equal(run.ready, 2);
    const video = asset("f_screen");
    assert.equal(video.status, "READY");
    assert.match(String(video.storageKey), /^lms\/recordings\/sess_1\/[^/]+\/video-f_screen\.mp4$/);
    const up = uploads.find((u) => u.key === video.storageKey)!;
    assert.equal(up.bytes, 3000);
    assert.ok(up.streamed, "a stream is handed to storage, not a buffer");
    assert.ok(up.chunks > 1, "the body arrives in chunks");
    assert.equal(up.contentType, "video/mp4");
    assert.equal(recordingRows()[0].status, "READY", "status follows the primary video");
    assert.equal(asset("f_vtt").status, "PENDING");
  });

  test("idempotent: once everything is READY a run downloads nothing", async () => {
    lmsSession();
    storeEvent(recordingObject());
    await recordings.ingestRecordingEvents();
    await recordings.copyRecordingAssets({ store: fakeStore, limit: 10 });
    const before = downloads.length;
    const again = await recordings.copyRecordingAssets({ store: fakeStore, limit: 10 });
    assert.equal(again.attempted, 0);
    assert.equal(downloads.length, before);
  });

  test("resumable: a stale COPYING asset is picked up again, and an object already in storage is marked READY without downloading", async () => {
    lmsSession();
    storeEvent(recordingObject());
    await recordings.ingestRecordingEvents();
    const video = asset("f_screen");
    const recording = recordingRows()[0];
    // A run crashed after uploading, before saving READY.
    video.status = "COPYING";
    video.updatedAt = new Date(Date.now() - policy.RECORDING_STALE_COPY_MS - 60_000);
    objects.set(recordings.recordingObjectKey({ kind: "VIDEO", zoomFileId: "f_screen" }, { id: String(recording.id), sessionId: "sess_1" }), 3000);
    // A fresh COPYING asset (another run is on it) is left alone.
    const audio = asset("f_audio");
    audio.status = "COPYING";
    audio.updatedAt = new Date();
    await recordings.copyRecordingAssets({ store: fakeStore, limit: 10 });
    assert.equal(asset("f_screen").status, "READY");
    assert.ok(!downloads.includes("f_screen"), "already stored: not downloaded again");
    assert.equal(asset("f_audio").status, "COPYING");
    assert.ok(!downloads.includes("f_audio"));
  });

  test("two overlapping runs never copy the same asset twice", async () => {
    lmsSession();
    storeEvent(recordingObject());
    await recordings.ingestRecordingEvents();
    await Promise.all([recordings.copyRecordingAssets({ store: fakeStore, limit: 10 }), recordings.copyRecordingAssets({ store: fakeStore, limit: 10 })]);
    assert.deepEqual([...downloads].sort(), ["f_audio", "f_screen", "f_vtt"]);
    assert.equal(uploads.length, 3);
  });

  test("a failure marks FAILED with attempts + 1 and an error without URLs; retried automatically up to the cap, then only by Retry", async () => {
    lmsSession();
    storeEvent(recordingObject());
    await recordings.ingestRecordingEvents();
    failDownloads.add("f_screen");
    for (let i = 0; i < policy.RECORDING_MAX_AUTO_ATTEMPTS + 1; i++) await recordings.copyRecordingAssets({ store: fakeStore, limit: 10 });
    const video = asset("f_screen");
    assert.equal(video.status, "FAILED");
    assert.equal(video.attempts, policy.RECORDING_MAX_AUTO_ATTEMPTS);
    assert.match(String(video.lastError), /downloadRecording failed/);
    assert.ok(!String(video.lastError).includes("zoom.us") && !String(video.lastError).includes("secret-download-token"));
    assert.equal(recordingRows()[0].status, "FAILED");
    assert.equal(downloads.filter((d) => d === "f_screen").length, policy.RECORDING_MAX_AUTO_ATTEMPTS, "stops at the cap");

    failDownloads.clear();
    await recordings.retryRecordingAsset(String(video.id));
    assert.equal(asset("f_screen").status, "PENDING");
    await recordings.copyRecordingAssets({ store: fakeStore, limit: 10 });
    assert.equal(asset("f_screen").status, "READY");
    assert.equal(recordingRows()[0].status, "READY");
  });

  test("a storage write failure is recorded the same way", async () => {
    lmsSession();
    storeEvent(recordingObject());
    await recordings.ingestRecordingEvents();
    failUploads = true;
    await recordings.copyRecordingAssets({ store: fakeStore, limit: 1 });
    assert.equal(asset("f_screen").status, "FAILED");
    assert.match(String(asset("f_screen").lastError), /Storage write failed/);
  });
});

// ── Fail safe without storage ──────────────────────────────────────────────

describe("unset storage env", () => {
  test("the worker refuses before claiming anything, naming the variables, never their values", async () => {
    lmsSession();
    storeEvent(recordingObject());
    await recordings.ingestRecordingEvents();
    delete process.env.SPACES_BUCKET;
    delete process.env.SPACES_SECRET_KEY;
    await assert.rejects(recordings.copyRecordingAssets(), (error: Error) => {
      assert.equal(error.name, "RecordingStorageConfigError");
      assert.match(error.message, /SPACES_BUCKET, SPACES_SECRET_KEY/);
      return true;
    });
    assert.ok(assetRows().every((a) => a.status === "PENDING" && a.attempts === 0));
  });

  test("the process endpoint still ingests, then answers 503 with the names; assets stay PENDING", async () => {
    lmsSession();
    storeEvent(recordingObject());
    for (const name of STORAGE_NAMES) delete process.env[name];
    const response = await post(processRoute, "/api/internal/lms/recordings/process");
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.ingest.recordingsCreated, 1);
    assert.match(body.error, /SPACES_ENDPOINT/);
    const text = JSON.stringify(body);
    for (const value of Object.values(STORAGE_ENV)) assert.ok(!text.includes(value));
    assert.ok(assetRows().every((a) => a.status === "PENDING"));
    assert.equal(downloads.length, 0);
  });

  test("the play route answers 503, not a crash, when storage is unset", async () => {
    const id = await readyAndPublished();
    const { cookie } = student("enrolled@example.test");
    for (const name of STORAGE_NAMES) delete process.env[name];
    const response = await play(id, cookie);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("location"), null);
  });
});

// ── Endpoint auth ──────────────────────────────────────────────────────────

describe("process endpoint", () => {
  test("needs the CRON_SECRET bearer", async () => {
    assert.equal((await post(processRoute, "/api/internal/lms/recordings/process", null)).status, 401);
    assert.equal((await post(processRoute, "/api/internal/lms/recordings/process", "wrong")).status, 401);
    delete process.env.CRON_SECRET;
    assert.equal((await post(processRoute, "/api/internal/lms/recordings/process")).status, 503);
    assert.equal((await post(backfillRoute, "/api/internal/lms/recordings/backfill")).status, 503);
  });

  test("ingests, then copies after the response (202); ?wait=1 copies inline", async () => {
    lmsSession();
    storeEvent(recordingObject());
    const response = await post(processRoute, "/api/internal/lms/recordings/process");
    assert.equal(response.status, 202);
    assert.deepEqual((await response.json()).copy, { started: true, limit: policy.RECORDING_COPY_BATCH_SIZE });
    await Promise.all(scheduled);
    assert.equal(asset("f_screen").status, "READY");
    const inline = await post(processRoute, "/api/internal/lms/recordings/process?wait=1&limit=5");
    assert.equal(inline.status, 200);
    assert.equal((await inline.json()).copy.ready, 1);
    assert.ok(assetRows().every((a) => a.status === "READY"));
  });
});

// ── Gated playback ─────────────────────────────────────────────────────────

describe("playback", () => {
  test("enrolled, READY + PUBLISHED: 302 to a short-lived presigned URL, uncached, no body", async () => {
    const id = await readyAndPublished();
    const { cookie } = student("enrolled@example.test");
    const response = await play(id, cookie);
    assert.equal(response.status, 302);
    const location = response.headers.get("location")!;
    assert.match(location, /^https:\/\/bucket-test\.storage\.example\.test\/lms\/recordings\/sess_1\/.+\/video-f_screen\.mp4\?/);
    assert.match(location, new RegExp(`X-Amz-Expires=${policy.RECORDING_PLAYBACK_URL_SECONDS}`));
    assert.ok(policy.RECORDING_PLAYBACK_URL_SECONDS >= 3600 && policy.RECORDING_PLAYBACK_URL_SECONDS <= 4 * 3600);
    assert.match(response.headers.get("cache-control")!, /no-store/);
    assert.equal(await response.text(), "");
  });

  test("not signed in -> 401; unknown recording -> 404", async () => {
    const id = await readyAndPublished();
    assert.equal((await play(id)).status, 401);
    const { cookie } = student("enrolled@example.test");
    assert.equal((await play("nope", cookie)).status, 404);
  });

  test("not enrolled in the session's cohort, lapsed, or unpaid -> 403 and no URL", async () => {
    const id = await readyAndPublished();
    const cases = [
      student("other@example.test", OTHER_COHORT),
      student("lapsed@example.test", SIRAH_BATCH, { accessEndsAt: new Date(Date.now() - 86_400_000) }),
      student("unpaid@example.test", SIRAH_BATCH, { paymentState: "UNPAID", paidCount: 0, enrolmentState: "PENDING" }),
    ];
    for (const { cookie } of cases) {
      const response = await play(id, cookie);
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("location"), null);
      assert.ok(!(await response.text()).includes("storage.example.test"));
    }
  });

  test("READY but HIDDEN, or PUBLISHED but not READY -> 404", async () => {
    const id = await readyAndPublished();
    const { cookie } = student("enrolled@example.test");
    await recordings.setRecordingVisibility(id, false);
    assert.equal((await play(id, cookie)).status, 404);
    const recording = recordingRows()[0];
    recording.visibility = "PUBLISHED";
    recording.status = "COPYING";
    assert.equal((await play(id, cookie)).status, 404);
  });

  test("publishing needs READY; the student list shows only READY + PUBLISHED, and nothing to lapsed students", async () => {
    lmsSession();
    storeEvent(recordingObject());
    await recordings.ingestRecordingEvents();
    const id = String(recordingRows()[0].id);
    await assert.rejects(recordings.setRecordingVisibility(id, true), /READY/);
    const enrolled = student("enrolled@example.test");
    const lapsed = student("lapsed@example.test", SIRAH_BATCH, { accessEndsAt: new Date(Date.now() - 86_400_000) });
    assert.deepEqual(await recordings.studentRecordings(enrolled.id), []);
    await recordings.copyRecordingAssets({ store: fakeStore, limit: 10 });
    assert.deepEqual(await recordings.studentRecordings(enrolled.id), [], "READY but still HIDDEN");
    await recordings.setRecordingVisibility(id, true);
    const listed = await recordings.studentRecordings(enrolled.id);
    assert.deepEqual(listed.map((r) => [r.recordingId, r.sessionId, r.kind]), [[id, "sess_1", "VIDEO"]]);
    assert.deepEqual(await recordings.studentRecordings(lapsed.id), []);
  });

  test("the Zoom cloud copy is kept: deletion is off by policy", () => {
    assert.equal(policy.RECORDING_DELETE_ZOOM_CLOUD_COPY, false);
    assert.equal(policy.RECORDING_STREAM_ONLY, true);
    assert.equal(policy.RECORDING_DEFAULT_VISIBILITY, "HIDDEN");
  });
});
