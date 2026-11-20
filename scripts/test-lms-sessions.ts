/**
 * LMS Phase 2a: session service (create/update/cancel -> Zoom calls), the host
 * overlap guard, field encryption, host registration, and the join/start routes.
 *
 * Mocks only: fetch is stubbed (no Zoom call leaves the process), credentials
 * and keys are fake, and the database is the in-memory fake Prisma.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test, { afterEach, before, beforeEach, describe } from "node:test";
import { installFakePrisma, table, tables } from "./fixtures/fake-prisma";

installFakePrisma();

const FIELD_KEY = randomBytes(32).toString("base64");
const FAKE_ENV = {
  ZOOM_ACCOUNT_ID: "acct_test",
  ZOOM_CLIENT_ID: "client_test",
  ZOOM_CLIENT_SECRET: "secret_test",
  ZOOM_DEFAULT_HOST_USER_ID: "host@example.test",
  ZOOM_WEBHOOK_SECRET_TOKEN: "whsec_test_token",
  LMS_FIELD_ENCRYPTION_KEY: FIELD_KEY,
  ADMIN_API_TOKEN: "admin-api-test-token",
};
Object.assign(process.env, FAKE_ENV);

let crypto: typeof import("../lib/lms/field-crypto");
let sessions: typeof import("../lib/lms/sessions");
let hosts: typeof import("../lib/lms/hosts");
let access: typeof import("../lib/lms/access");
let token: typeof import("../lib/zoom/token");
let joinRoute: typeof import("../app/api/sirah/lms/sessions/[id]/join/route");
let startRoute: typeof import("../app/api/sirah/lms/sessions/[id]/start/route");
let SIRAH_BATCH: string;
let SIRAH_SLUG: string;
before(async () => {
  crypto = await import("../lib/lms/field-crypto");
  sessions = await import("../lib/lms/sessions");
  hosts = await import("../lib/lms/hosts");
  access = await import("../lib/lms/access");
  token = await import("../lib/zoom/token");
  joinRoute = await import("../app/api/sirah/lms/sessions/[id]/join/route");
  startRoute = await import("../app/api/sirah/lms/sessions/[id]/start/route");
  ({ SIRAH_BATCH, SIRAH_SLUG } = await import("../lib/sirah/catalog"));
});

// ── Zoom fetch mock ────────────────────────────────────────────────────────

type Call = { url: string; method: string; body: Record<string, unknown> | null };
let calls: Call[] = [];
let failNext: { method: string; status: number; body?: unknown } | null = null;
let meetingSeq = 0;
let startSeq = 0;
const originalFetch = global.fetch;
const ZOOM_HOST_USER = "zoomuser_abc";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const apiCalls = () => calls.filter((c) => !c.url.startsWith("https://zoom.us/oauth/token"));

function zoomResponder(call: Call): Response {
  if (call.url.startsWith("https://zoom.us/oauth/token"))
    return json({ access_token: "tok_test", token_type: "bearer", expires_in: 3600, scope: "meeting:write:meeting:admin" });
  if (failNext && failNext.method === call.method) {
    const { status, body } = failNext;
    failNext = null;
    return json(body ?? { code: 3001, message: "Zoom said no" }, status);
  }
  const path = call.url.replace("https://api.zoom.us/v2", "");
  if (call.method === "GET" && path.startsWith("/users/"))
    return json({ id: ZOOM_HOST_USER, email: "host@example.test", type: 2, status: "active" });
  if (call.method === "POST" && path === `/users/${ZOOM_HOST_USER}/meetings`) {
    meetingSeq += 1;
    const id = 900_000_000 + meetingSeq;
    return json(
      {
        id,
        uuid: `uuid${meetingSeq}==`,
        host_id: ZOOM_HOST_USER,
        topic: call.body?.topic,
        type: 2,
        join_url: `https://us02web.zoom.us/j/${id}?pwd=secretpwd${meetingSeq}`,
        start_url: `https://us02web.zoom.us/s/${id}?zak=never-stored`,
        password: call.body?.password,
      },
      201,
    );
  }
  if (call.method === "GET" && path.startsWith("/meetings/")) {
    startSeq += 1;
    const id = path.split("/")[2].split("?")[0];
    return json({ id: Number(id), uuid: "u", host_id: ZOOM_HOST_USER, topic: "t", type: 2, join_url: "https://zoom.us/j/1", start_url: `https://us02web.zoom.us/s/${id}?zak=fresh${startSeq}` });
  }
  if (call.method === "PATCH" || call.method === "DELETE") return new Response(null, { status: 204 });
  throw new Error(`Unexpected Zoom call in test: ${call.method} ${call.url}`);
}

beforeEach(() => {
  tables.clear();
  calls = [];
  failNext = null;
  meetingSeq = 0;
  startSeq = 0;
  Object.assign(process.env, FAKE_ENV);
  token.clearZoomTokenCache();
  global.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    const call: Call = { url, method: (init.method || "GET").toUpperCase(), body: typeof init.body === "string" ? JSON.parse(init.body) : null };
    calls.push(call);
    return zoomResponder(call);
  }) as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

// ── Fixtures ───────────────────────────────────────────────────────────────

const MIN = 60_000;
const OTHER_COHORT = "another-cohort-2027";

function seedHost(overrides: Record<string, unknown> = {}) {
  const host = { id: `host_${table("zoomHost").length + 1}`, zoomUserId: ZOOM_HOST_USER, email: "host@example.test", licensed: true, active: true, createdAt: new Date(), updatedAt: new Date(), ...overrides };
  table("zoomHost").push(host);
  return host;
}
function seedCohorts() {
  table("sirahCohort").push({ batchCode: SIRAH_BATCH }, { batchCode: OTHER_COHORT });
}
function seedCourse() {
  const course = { id: "course_sirah", slug: SIRAH_SLUG };
  table("course").push(course);
  return course;
}
let userSeq = 0;
/** A signed-in user; returns the cookie value. */
function seedUser(email: string, role = "STUDENT") {
  userSeq += 1;
  const user = { id: `user_${userSeq}`, email, fullName: `User ${userSeq}`, role, status: "ACTIVE" };
  table("user").push(user);
  const cookie = `tok_${userSeq}_${randomBytes(4).toString("hex")}`;
  table("session").push({ id: `s_${userSeq}`, userId: user.id, tokenHash: createHash("sha256").update(cookie).digest("hex"), expiresAt: new Date(Date.now() + 3600_000) });
  return { user, cookie };
}
function seedOrder(userId: string, overrides: Record<string, unknown> = {}) {
  table("sirahOrder").push({
    id: `order_${userId}`,
    userId,
    courseId: "course_sirah",
    batchCode: SIRAH_BATCH,
    plan: "ANNUAL",
    method: "STRIPE",
    paymentState: "PAID",
    enrolmentState: "ACTIVE",
    paidCount: 1,
    registrationId: null,
    archivedAt: null,
    accessEndsAt: null,
    programmeStart: null,
    programmeEnd: null,
    cycleBillingDay: null,
    cycleGraceDay: null,
    cycleFirstDueAt: null,
    createdAt: new Date(),
    ...overrides,
  });
}
function seedSession(startsAt: Date, overrides: Record<string, unknown> = {}) {
  const id = `sess_${table("lmsSession").length + 1}`;
  const joinUrl = `https://us02web.zoom.us/j/555?pwd=${id}`;
  const row = {
    id,
    cohortId: SIRAH_BATCH,
    title: "Week 1: Makkah before Islam",
    startsAt,
    durationMin: 90,
    status: "SCHEDULED",
    zoomHostId: "host_1",
    zoomMeetingId: "555",
    zoomMeetingUuid: "uuid555",
    joinUrlEncrypted: crypto.encryptField(joinUrl, crypto.sessionFieldContext(id, "joinUrl")),
    passcodeEncrypted: crypto.encryptField("1234567890", crypto.sessionFieldContext(id, "passcode")),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  table("lmsSession").push(row);
  return { row, joinUrl };
}

const base = "http://localhost:3100";
const get = (path: string, headers: Record<string, string> = {}) => new Request(base + path, { headers });
const withCookie = (cookie: string) => ({ cookie: `ga_session=${cookie}` });
const join = (id: string, cookie?: string) =>
  joinRoute.GET(get(`/api/sirah/lms/sessions/${id}/join`, cookie ? withCookie(cookie) : {}), { params: Promise.resolve({ id }) });
const start = (id: string, headers: Record<string, string> = {}) =>
  startRoute.GET(get(`/api/sirah/lms/sessions/${id}/start`, headers), { params: Promise.resolve({ id }) });

// ── Encryption ─────────────────────────────────────────────────────────────

describe("field encryption", () => {
  test("round-trips, uses a fresh IV each time and never contains the plaintext", () => {
    const url = "https://us02web.zoom.us/j/123?pwd=abc";
    const a = crypto.encryptField(url, "ctx");
    const b = crypto.encryptField(url, "ctx");
    assert.notEqual(a, b);
    assert.ok(a.startsWith("v1."));
    assert.ok(!a.includes("zoom") && !a.includes("abc"));
    assert.equal(crypto.decryptField(a, "ctx"), url);
    assert.equal(crypto.decryptField(b, "ctx"), url);
    assert.equal(crypto.decryptField(crypto.encryptField("", "ctx"), "ctx"), "");
  });

  test("rejects a wrong context, a wrong key and tampered data", () => {
    const stored = crypto.encryptField("1234567890", crypto.sessionFieldContext("s1", "passcode"));
    assert.throws(() => crypto.decryptField(stored, crypto.sessionFieldContext("s2", "passcode")), crypto.LmsFieldCryptoError);
    assert.throws(() => crypto.decryptField(stored, crypto.sessionFieldContext("s1", "joinUrl")), crypto.LmsFieldCryptoError);
    assert.throws(() => crypto.decryptField(stored, crypto.sessionFieldContext("s1", "passcode"), randomBytes(32)), crypto.LmsFieldCryptoError);
    const parts = stored.split(".");
    const data = Buffer.from(parts[3], "base64url");
    data[0] ^= 1;
    parts[3] = data.toString("base64url");
    assert.throws(() => crypto.decryptField(parts.join("."), crypto.sessionFieldContext("s1", "passcode")), crypto.LmsFieldCryptoError);
    assert.throws(() => crypto.decryptField("plain-text", ""), /unknown format/);
  });

  test("key: base64 or hex accepted; missing or malformed named without the value", () => {
    const hex = randomBytes(32).toString("hex");
    assert.equal(crypto.lmsFieldKey({ LMS_FIELD_ENCRYPTION_KEY: hex }).length, 32);
    assert.equal(crypto.lmsFieldKey({ LMS_FIELD_ENCRYPTION_KEY: FIELD_KEY }).length, 32);
    assert.throws(() => crypto.lmsFieldKey({}), /missing or empty LMS_FIELD_ENCRYPTION_KEY/);
    assert.throws(
      () => crypto.lmsFieldKey({ LMS_FIELD_ENCRYPTION_KEY: "too-short-secret" }),
      (error: Error) => /32 bytes/.test(error.message) && !error.message.includes("too-short-secret"),
    );
  });
});

// ── Host registration ──────────────────────────────────────────────────────

describe("zoom host registration", () => {
  test("resolves ZOOM_DEFAULT_HOST_USER_ID via the users API and upserts idempotently", async () => {
    const first = await hosts.registerDefaultZoomHost();
    assert.equal(apiCalls()[0].method, "GET");
    assert.equal(apiCalls()[0].url, "https://api.zoom.us/v2/users/host%40example.test");
    assert.equal(first.zoomUserId, ZOOM_HOST_USER);
    assert.equal(first.licensed, true);
    assert.equal(first.active, true);
    await hosts.registerDefaultZoomHost();
    assert.equal(table("zoomHost").length, 1);
  });

  test("licensed is false unless the Zoom user type is Licensed (2)", () => {
    assert.equal(hosts.toResolvedHost({ id: "u", email: "e", type: 1 }).licensed, false);
    assert.equal(hosts.toResolvedHost({ id: "u", email: "e", type: 2 }).licensed, true);
  });
});

// ── Session service ────────────────────────────────────────────────────────

describe("session service", () => {
  const T0 = new Date("2026-12-06T18:00:00Z");
  const input = (overrides: Partial<import("../lib/lms/sessions").CreateSessionInput> = {}) => ({
    cohortId: SIRAH_BATCH,
    title: "Week 1",
    startsAt: T0,
    durationMin: 90,
    hostId: "host_1",
    ...overrides,
  });
  beforeEach(() => {
    seedHost();
    seedCohorts();
  });

  test("create schedules a type-2 Zoom meeting under the host with the LMS settings, and encrypts link and passcode", async () => {
    const row = await sessions.createSession(input());
    const [create] = apiCalls();
    assert.equal(apiCalls().length, 1);
    assert.equal(create.method, "POST");
    assert.equal(create.url, `https://api.zoom.us/v2/users/${ZOOM_HOST_USER}/meetings`);
    assert.equal(create.body?.type, 2);
    assert.equal(create.body?.topic, "Week 1");
    assert.equal(create.body?.start_time, "2026-12-06T18:00:00Z");
    assert.equal(create.body?.timezone, "UTC");
    assert.equal(create.body?.duration, 90);
    assert.match(String(create.body?.password), /^\d{10}$/);
    const settings = create.body?.settings as Record<string, unknown>;
    assert.equal(settings.auto_recording, "cloud");
    assert.equal(settings.waiting_room, sessions.LMS_WAITING_ROOM);
    assert.equal(settings.join_before_host, sessions.LMS_JOIN_BEFORE_HOST);
    assert.equal(settings.mute_upon_entry, true);

    assert.equal(row.status, "SCHEDULED");
    assert.equal(row.zoomMeetingId, "900000001");
    assert.equal(row.zoomMeetingUuid, "uuid1==");
    const stored = table("lmsSession")[0];
    assert.ok(!String(stored.joinUrlEncrypted).includes("zoom.us"));
    assert.equal(crypto.decryptField(String(stored.joinUrlEncrypted), crypto.sessionFieldContext(row.id, "joinUrl")), "https://us02web.zoom.us/j/900000001?pwd=secretpwd1");
    assert.equal(crypto.decryptField(String(stored.passcodeEncrypted), crypto.sessionFieldContext(row.id, "passcode")), create.body?.password);
    assert.ok(!JSON.stringify(stored).includes("zak="), "start_url is never stored");
  });

  test("create: a Zoom failure leaves no row behind", async () => {
    failNext = { method: "POST", status: 400, body: { code: 300, message: "Invalid meeting" } };
    await assert.rejects(sessions.createSession(input()), (error: InstanceType<typeof sessions.LmsSessionError>) => error.code === "ZOOM" && error.status === 502);
    assert.equal(table("lmsSession").length, 0);
  });

  test("create: validates input, cohort and host before calling Zoom", async () => {
    await assert.rejects(sessions.createSession(input({ title: "  " })), { code: "INVALID" });
    await assert.rejects(sessions.createSession(input({ durationMin: 0 })), { code: "INVALID" });
    await assert.rejects(sessions.createSession(input({ durationMin: 1.5 })), { code: "INVALID" });
    await assert.rejects(sessions.createSession(input({ startsAt: new Date("nope") })), { code: "INVALID" });
    await assert.rejects(sessions.createSession(input({ cohortId: "missing" })), { code: "NOT_FOUND" });
    await assert.rejects(sessions.createSession(input({ hostId: "missing" })), { code: "NOT_FOUND" });
    seedHost({ id: "host_off", zoomUserId: "other", active: false });
    await assert.rejects(sessions.createSession(input({ hostId: "host_off" })), { code: "HOST_INACTIVE" });
    delete process.env.LMS_FIELD_ENCRYPTION_KEY;
    await assert.rejects(sessions.createSession(input()), /LMS_FIELD_ENCRYPTION_KEY/);
    assert.equal(apiCalls().length, 0);
    assert.equal(table("lmsSession").length, 0);
  });

  test("overlap guard refuses an overlapping session on the same host, with a clear error and no Zoom call", async () => {
    await sessions.createSession(input()); // 18:00-19:30
    calls = [];
    await assert.rejects(
      sessions.createSession(input({ title: "Clash", startsAt: new Date(T0.getTime() + 60 * MIN) })),
      (error: InstanceType<typeof sessions.LmsSessionError>) =>
        error.code === "OVERLAP" && error.status === 409 && /already has "Week 1"/.test(error.message) && /cannot run two classes at once/.test(error.message),
    );
    await assert.rejects(sessions.createSession(input({ startsAt: new Date(T0.getTime() - 30 * MIN), durationMin: 31 })), { code: "OVERLAP" });
    await assert.rejects(sessions.createSession(input({ startsAt: new Date(T0.getTime() - 30 * MIN), durationMin: 240 })), { code: "OVERLAP" });
    assert.equal(apiCalls().length, 0);
    assert.equal(table("lmsSession").length, 1);
  });

  test("overlap guard allows back-to-back sessions, other hosts, and slots freed by cancellation", async () => {
    const first = await sessions.createSession(input());
    await sessions.createSession(input({ title: "After", startsAt: new Date(T0.getTime() + 90 * MIN) }));
    await sessions.createSession(input({ title: "Before", startsAt: new Date(T0.getTime() - 30 * MIN), durationMin: 30 }));
    seedHost({ id: "host_2", zoomUserId: ZOOM_HOST_USER + "_2" });
    // Same time on another host does not conflict (the guard is per host).
    assert.equal(await sessions.findHostOverlap((await import("../lib/prisma")).prisma, "host_2", T0, 90), null);
    await sessions.cancelSession(first.id);
    await sessions.createSession(input({ title: "Replacement" }));
    assert.equal(table("lmsSession").filter((r) => r.status !== "CANCELLED").length, 3);
  });

  test("update patches only the changed fields in Zoom and the row", async () => {
    const row = await sessions.createSession(input());
    calls = [];
    const later = new Date(T0.getTime() + 24 * 60 * MIN);
    const updated = await sessions.updateSession(row.id, { title: "Week 1 (moved)", startsAt: later, durationMin: 90 });
    assert.equal(apiCalls().length, 1);
    const [patch] = apiCalls();
    assert.equal(patch.method, "PATCH");
    assert.equal(patch.url, "https://api.zoom.us/v2/meetings/900000001");
    assert.deepEqual(patch.body, { topic: "Week 1 (moved)", start_time: zoomTime(later), timezone: "UTC" });
    assert.equal(updated.title, "Week 1 (moved)");
    assert.equal(updated.startsAt.getTime(), later.getTime());

    calls = [];
    await sessions.updateSession(row.id, { title: "Week 1 (moved)" });
    assert.equal(apiCalls().length, 0, "no-op update makes no Zoom call");
  });

  test("update refuses an overlap (excluding itself) and leaves Zoom and the row alone", async () => {
    const a = await sessions.createSession(input());
    const b = await sessions.createSession(input({ title: "B", startsAt: new Date(T0.getTime() + 120 * MIN) }));
    calls = [];
    await sessions.updateSession(a.id, { durationMin: 120 }); // ends exactly when B starts: fine
    await assert.rejects(sessions.updateSession(b.id, { startsAt: new Date(T0.getTime() + 60 * MIN) }), { code: "OVERLAP" });
    assert.equal(apiCalls().length, 1, "only the allowed update reached Zoom");
    assert.equal((table("lmsSession").find((r) => r.id === b.id)!.startsAt as Date).getTime(), T0.getTime() + 120 * MIN);
  });

  test("update: a Zoom failure reverts the row", async () => {
    const row = await sessions.createSession(input());
    failNext = { method: "PATCH", status: 400 };
    await assert.rejects(sessions.updateSession(row.id, { title: "New", durationMin: 60 }), { code: "ZOOM" });
    const stored = table("lmsSession").find((r) => r.id === row.id)!;
    assert.equal(stored.title, "Week 1");
    assert.equal(stored.durationMin, 90);
  });

  test("cancel deletes the Zoom meeting, marks CANCELLED, keeps the row, and is idempotent", async () => {
    const row = await sessions.createSession(input());
    calls = [];
    const cancelled = await sessions.cancelSession(row.id);
    assert.equal(apiCalls().length, 1);
    assert.equal(apiCalls()[0].method, "DELETE");
    assert.match(apiCalls()[0].url, /^https:\/\/api\.zoom\.us\/v2\/meetings\/900000001\?/);
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(table("lmsSession").length, 1);
    calls = [];
    await sessions.cancelSession(row.id);
    assert.equal(apiCalls().length, 0);
    await assert.rejects(sessions.updateSession(row.id, { title: "x" }), { code: "CONFLICT" });
  });

  test("cancel tolerates a meeting already deleted in Zoom, but not other Zoom errors", async () => {
    const a = await sessions.createSession(input());
    const b = await sessions.createSession(input({ title: "B", startsAt: new Date(T0.getTime() + 180 * MIN) }));
    failNext = { method: "DELETE", status: 404, body: { code: 3001, message: "Meeting does not exist" } };
    assert.equal((await sessions.cancelSession(a.id)).status, "CANCELLED");
    failNext = { method: "DELETE", status: 500 };
    await assert.rejects(sessions.cancelSession(b.id), { code: "ZOOM" });
    assert.equal(table("lmsSession").find((r) => r.id === b.id)!.status, "SCHEDULED");
  });
});

function zoomTime(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ── Join route ─────────────────────────────────────────────────────────────

describe("join route", () => {
  beforeEach(() => {
    seedHost();
    seedCohorts();
    seedCourse();
  });
  const openNow = () => new Date(Date.now() + 5 * MIN); // starts in 5 minutes: inside the window

  test("redirects an enrolled, paid student inside the window, logs intent, and never puts the URL in a body", async () => {
    const { user, cookie } = seedUser("student@example.test");
    seedOrder(user.id);
    const { row, joinUrl } = seedSession(openNow());
    const response = await join(row.id, cookie);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), joinUrl);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(await response.text(), "");
    const intents = table("sessionJoinIntent");
    assert.equal(intents.length, 1);
    assert.equal(intents[0].sessionId, row.id);
    assert.equal(intents[0].userId, user.id);
    assert.ok(intents[0].at instanceof Date);
    assert.equal(apiCalls().length, 0, "join never calls Zoom");
  });

  test("requires a signed-in student", async () => {
    const { row } = seedSession(openNow());
    const response = await join(row.id);
    assert.equal(response.status, 401);
    assert.match(await response.text(), /sign in/i);
    const bogus = await join(row.id, "not-a-real-token");
    assert.equal(bogus.status, 401);
    assert.equal(table("sessionJoinIntent").length, 0);
  });

  test("refuses students without an active, paid enrolment in this cohort (existing rule)", async () => {
    const { row, joinUrl } = seedSession(openNow());
    const cases: [string, Record<string, unknown> | null][] = [
      ["no order", null],
      ["unpaid", { paidCount: 0, paymentState: "UNPAID" }],
      ["pending enrolment", { enrolmentState: "PENDING" }],
      ["cancelled access", { accessEndsAt: new Date(Date.now() - MIN) }],
      ["other cohort", { batchCode: OTHER_COHORT }],
      ["archived", { archivedAt: new Date() }],
    ];
    for (const [label, order] of cases) {
      const { user, cookie } = seedUser(`${label.replace(/\s/g, "-")}@example.test`);
      if (order) seedOrder(user.id, order);
      const response = await join(row.id, cookie);
      assert.equal(response.status, 403, label);
      const body = await response.text();
      assert.match(body, /Not enrolled/, label);
      assert.ok(!body.includes(joinUrl), label);
    }
    assert.equal(table("sessionJoinIntent").length, 0);
  });

  test("a legacy ACTIVE enrolment (no order) is admitted to the catalog batch only", async () => {
    const { user, cookie } = seedUser("legacy@example.test");
    table("enrollment").push({ id: "enr_1", userId: user.id, courseId: "course_sirah", registrationId: "reg_1", status: "ACTIVE" });
    const { row } = seedSession(openNow());
    assert.equal((await join(row.id, cookie)).status, 302);
    const { row: other } = seedSession(new Date(Date.now() + 5 * MIN + 200 * MIN), { cohortId: OTHER_COHORT });
    assert.equal(await access.studentMayJoinCohort(user.id, OTHER_COHORT), false);
    assert.equal((await join(other.id, cookie)).status, 403);
  });

  test("enforces the window: 15 minutes before start until start + duration", async () => {
    const { user, cookie } = seedUser("window@example.test");
    seedOrder(user.id);
    const early = seedSession(new Date(Date.now() + 20 * MIN)).row;
    const res = await join(early.id, cookie);
    assert.equal(res.status, 409);
    assert.match(await res.text(), /Not open yet/);

    const justOpen = seedSession(new Date(Date.now() + 14 * MIN), { zoomHostId: "host_1" }).row;
    assert.equal((await join(justOpen.id, cookie)).status, 302);

    const running = seedSession(new Date(Date.now() - 80 * MIN)).row; // 90-minute class, 10 left
    assert.equal((await join(running.id, cookie)).status, 302);

    const ended = seedSession(new Date(Date.now() - 91 * MIN)).row;
    const endedRes = await join(ended.id, cookie);
    assert.equal(endedRes.status, 409);
    assert.match(await endedRes.text(), /has ended/);
    assert.equal(table("sessionJoinIntent").length, 2);

    const now = new Date("2026-12-06T18:00:00Z");
    const s = { startsAt: now, durationMin: 60 };
    assert.equal(access.joinWindow(s, new Date(now.getTime() - 15 * MIN - 1)), "not_open");
    assert.equal(access.joinWindow(s, new Date(now.getTime() - 15 * MIN)), "open");
    assert.equal(access.joinWindow(s, new Date(now.getTime() + 60 * MIN - 1)), "open");
    assert.equal(access.joinWindow(s, new Date(now.getTime() + 60 * MIN)), "ended");
  });

  test("cancelled, ENDED, unknown and not-yet-provisioned sessions do not redirect", async () => {
    const { user, cookie } = seedUser("states@example.test");
    seedOrder(user.id);
    assert.equal((await join(seedSession(openNow(), { status: "CANCELLED" }).row.id, cookie)).status, 410);
    assert.equal((await join(seedSession(openNow(), { status: "ENDED" }).row.id, cookie)).status, 409);
    assert.equal((await join("missing", cookie)).status, 404);
    assert.equal((await join(seedSession(openNow(), { joinUrlEncrypted: null }).row.id, cookie)).status, 503);
    // A ciphertext moved from another row fails its context check.
    const donor = seedSession(openNow()).row;
    const moved = seedSession(openNow(), { joinUrlEncrypted: donor.joinUrlEncrypted }).row;
    assert.equal((await join(moved.id, cookie)).status, 503);
    // A non-Zoom URL is never redirected to.
    const evil = seedSession(openNow()).row;
    evil.joinUrlEncrypted = crypto.encryptField("https://evil.example/zoom.us", crypto.sessionFieldContext(evil.id, "joinUrl"));
    assert.equal((await join(evil.id, cookie)).status, 503);
    assert.equal(table("sessionJoinIntent").length, 0);
  });
});

// ── Start route ────────────────────────────────────────────────────────────

describe("start route", () => {
  beforeEach(() => {
    seedHost();
    seedCohorts();
  });

  test("the assigned host gets a fresh start_url from Zoom on every call, never stored", async () => {
    const { cookie } = seedUser("HOST@example.test");
    const { row } = seedSession(new Date(Date.now() + 60 * MIN));
    const first = await start(row.id, withCookie(cookie));
    const second = await start(row.id, withCookie(cookie));
    assert.equal(first.status, 302);
    assert.equal(first.headers.get("location"), "https://us02web.zoom.us/s/555?zak=fresh1");
    assert.equal(second.headers.get("location"), "https://us02web.zoom.us/s/555?zak=fresh2");
    assert.equal(first.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(apiCalls().map((c) => `${c.method} ${c.url}`), ["GET https://api.zoom.us/v2/meetings/555", "GET https://api.zoom.us/v2/meetings/555"]);
    assert.ok(!JSON.stringify(table("lmsSession")).includes("zak="));
  });

  test("an admin (ADMIN_API_TOKEN) may start any session", async () => {
    const { row } = seedSession(new Date(Date.now() + 60 * MIN));
    const response = await start(row.id, { "x-admin-token": FAKE_ENV.ADMIN_API_TOKEN });
    assert.equal(response.status, 302);
  });

  test("students, staff who are not the host, wrong admin tokens and anonymous users are refused without a Zoom call", async () => {
    const { row } = seedSession(new Date(Date.now() + 60 * MIN));
    const { cookie: student } = seedUser("student@example.test");
    const { cookie: reviewer } = seedUser("manager@example.test", "SIRAH_REVIEWER");
    assert.equal((await start(row.id)).status, 401);
    assert.equal((await start(row.id, { "x-admin-token": "wrong" })).status, 401);
    assert.equal((await start(row.id, withCookie(student))).status, 403);
    assert.equal((await start(row.id, withCookie(reviewer))).status, 403);
    assert.equal(apiCalls().length, 0);
  });

  test("an inactive host loses start access; cancelled and missing sessions do not redirect", async () => {
    const { cookie } = seedUser("host@example.test");
    const { row } = seedSession(new Date(Date.now() + 60 * MIN));
    table("zoomHost")[0].active = false;
    assert.equal((await start(row.id, withCookie(cookie))).status, 403);
    table("zoomHost")[0].active = true;
    const cancelled = seedSession(new Date(Date.now() + 300 * MIN), { status: "CANCELLED" }).row;
    assert.equal((await start(cancelled.id, withCookie(cookie))).status, 410);
    assert.equal((await start("missing", withCookie(cookie))).status, 404);
    assert.equal(apiCalls().length, 0);
  });

  test("a Zoom failure is a 502, not a redirect", async () => {
    const { row } = seedSession(new Date(Date.now() + 60 * MIN));
    failNext = { method: "GET", status: 404, body: { code: 3001, message: "Meeting does not exist" } };
    const response = await start(row.id, { "x-admin-token": FAKE_ENV.ADMIN_API_TOKEN });
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("location"), null);
  });
});
