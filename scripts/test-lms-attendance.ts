/**
 * LMS Phase 3: Zoom webhook processing -> live status and attendance.
 *
 * Mocks only: Zoom fetch is stubbed (the participants report), events are
 * hand-built webhook bodies, and the database is the in-memory fake Prisma.
 * Nothing reaches Zoom or a real database.
 */
import assert from "node:assert/strict";
import test, { afterEach, before, beforeEach, describe } from "node:test";
import { installFakePrisma, table, tables } from "./fixtures/fake-prisma";

installFakePrisma();

const FAKE_ENV = {
  ZOOM_ACCOUNT_ID: "acct_test",
  ZOOM_CLIENT_ID: "client_test",
  ZOOM_CLIENT_SECRET: "secret_test",
  ZOOM_DEFAULT_HOST_USER_ID: "host@example.test",
  ZOOM_WEBHOOK_SECRET_TOKEN: "whsec_test_token",
};
Object.assign(process.env, FAKE_ENV);

let processor: typeof import("../lib/zoom/processor");
let attendance: typeof import("../lib/lms/attendance");
let schedule: typeof import("../lib/lms/schedule");
let token: typeof import("../lib/zoom/token");
let webhook: typeof import("../lib/zoom/webhook");
let webhookRoute: typeof import("../app/api/sirah/lms/zoom/webhook/route");
let catchUp: typeof import("../app/api/internal/lms/zoom/process-events/route");
let SIRAH_BATCH: string;
let SIRAH_SLUG: string;
before(async () => {
  processor = await import("../lib/zoom/processor");
  attendance = await import("../lib/lms/attendance");
  schedule = await import("../lib/lms/schedule");
  token = await import("../lib/zoom/token");
  webhook = await import("../lib/zoom/webhook");
  webhookRoute = await import("../app/api/sirah/lms/zoom/webhook/route");
  catchUp = await import("../app/api/internal/lms/zoom/process-events/route");
  ({ SIRAH_BATCH, SIRAH_SLUG } = await import("../lib/sirah/catalog"));
});

// ── Zoom fetch mock: the past-participants report ──────────────────────────

type ReportEntry = { id?: string; user_id?: string; name: string; user_email?: string; join_time: string; leave_time: string; duration: number };
let report: ReportEntry[] | null = null; // null: "not ready yet" (404)
let reportCalls: string[] = [];
const originalFetch = global.fetch;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// ── Fixtures ───────────────────────────────────────────────────────────────

const MEETING = "85746065432";
const GEN_MUMIN_MEETING = "99911122233";
const T0 = Date.parse("2026-12-06T18:00:00Z");
const at = (min: number) => new Date(T0 + min * 60_000);
const iso = (min: number) => at(min).toISOString().replace(/\.\d{3}Z$/, "Z");

let seq = 0;
function student(fullName: string, email: string, batchCode = SIRAH_BATCH) {
  seq += 1;
  const id = `user_${seq}`;
  table("user").push({ id, fullName, email, status: "ACTIVE", role: "STUDENT" });
  table("sirahOrder").push({
    id: `order_${seq}`, userId: id, courseId: "course_sirah", batchCode, plan: "ANNUAL", method: "STRIPE",
    paymentState: "PAID", enrolmentState: "ACTIVE", paidCount: 1, registrationId: null, archivedAt: null,
    accessEndsAt: null, programmeStart: null, programmeEnd: null, cycleBillingDay: null, cycleGraceDay: null,
    cycleFirstDueAt: null, createdAt: new Date(T0 - 86_400_000),
  });
  return id;
}

function session(overrides: Record<string, unknown> = {}) {
  const row = {
    id: "sess_1", cohortId: SIRAH_BATCH, title: "Week 1", startsAt: at(0), durationMin: 60, status: "SCHEDULED",
    zoomHostId: "host_1", zoomMeetingId: MEETING, zoomMeetingUuid: null, zoomStartedAt: null, zoomEndedAt: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  table("lmsSession").push(row);
  return row;
}

let eventSeq = 0;
function body(event: string, object: Record<string, unknown>, tsMin: number) {
  return { event, event_ts: at(tsMin).getTime(), payload: { account_id: "acct", object: { id: MEETING, uuid: "inst-uuid==", ...object } } };
}
const started = (min = 0) => body("meeting.started", { start_time: iso(min) }, min);
const ended = (min = 60, startMin = 0) => body("meeting.ended", { start_time: iso(startMin), end_time: iso(min) }, min);
const joined = (participant: Record<string, unknown>, min: number) =>
  body("meeting.participant_joined", { participant: { ...participant, join_time: iso(min) } }, min);
const left = (participant: Record<string, unknown>, min: number, joinMin?: number) =>
  body("meeting.participant_left", { participant: { ...participant, leave_time: iso(min), ...(joinMin !== undefined ? { join_time: iso(joinMin) } : {}) } }, min);

/** Store an event as the webhook would, then return its row id. */
function store(eventBody: ReturnType<typeof body>, receivedMin?: number) {
  eventSeq += 1;
  const row = {
    id: `evt_${String(eventSeq).padStart(3, "0")}`,
    dedupeKey: `k${eventSeq}`,
    event: eventBody.event,
    payload: eventBody,
    receivedAt: at(receivedMin ?? (eventBody.event_ts - T0) / 60_000),
    processedAt: null,
    error: null,
  };
  table("zoomWebhookEvent").push(row);
  return row.id;
}
const run = (eventBody: ReturnType<typeof body>, nowMin = 70) => processor.processStoredZoomEvent(store(eventBody), at(nowMin));
const sessionRow = () => table("lmsSession").find((s) => s.id === "sess_1")!;
const intervals = () => table("attendanceInterval");
const attendanceOf = (userId: string) => table("attendance").find((a) => a.userId === userId);
const eventRow = (id: string) => table("zoomWebhookEvent").find((e) => e.id === id)!;

beforeEach(() => {
  tables.clear();
  seq = 0;
  eventSeq = 0;
  report = null;
  reportCalls = [];
  Object.assign(process.env, FAKE_ENV);
  token.clearZoomTokenCache();
  table("course").push({ id: "course_sirah", slug: SIRAH_SLUG });
  table("zoomHost").push({ id: "host_1", email: "teacher@example.test", licensed: true, active: true, zoomUserId: "zu" });
  global.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://zoom.us/oauth/token")) return json({ access_token: "tok", expires_in: 3600, scope: "" });
    if (url.includes("/past_meetings/")) {
      reportCalls.push(url);
      return report ? json({ participants: report }) : json({ code: 3001, message: "Meeting does not exist." }, 404);
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  }) as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

// ── Status ─────────────────────────────────────────────────────────────────

describe("meeting.started / meeting.ended drive the session status", () => {
  test("started -> LIVE with Zoom's start time; ended -> ENDED; both marked processed", async () => {
    session();
    const s1 = store(started(2));
    assert.equal((await processor.processStoredZoomEvent(s1, at(3))).status, "processed");
    assert.equal(sessionRow().status, "LIVE");
    assert.equal((sessionRow().zoomStartedAt as Date).getTime(), at(2).getTime());
    assert.ok(eventRow(s1).processedAt instanceof Date);

    report = [];
    const e1 = store(ended(58, 2));
    assert.equal((await processor.processStoredZoomEvent(e1, at(59))).status, "processed");
    assert.equal(sessionRow().status, "ENDED");
    assert.equal((sessionRow().zoomEndedAt as Date).getTime(), at(58).getTime());
    assert.equal(eventRow(e1).error, null);
  });

  test("a late meeting.started after the end does not reopen it; a genuine restart does", async () => {
    session();
    report = [];
    await run(started(0));
    await run(ended(50));
    await run(started(0)); // the same start, delivered late
    assert.equal(sessionRow().status, "ENDED");
    await run(started(55)); // a real restart, after the recorded end
    assert.equal(sessionRow().status, "LIVE");
    assert.equal(sessionRow().zoomEndedAt, null);
  });

  test("a cancelled session is never set LIVE or ENDED by Zoom events", async () => {
    session({ status: "CANCELLED" });
    await run(started(0));
    await run(ended(60));
    assert.equal(sessionRow().status, "CANCELLED");
  });

  test("the admin badge and phase follow Zoom, not just the clock", () => {
    const view = (status: string, endMin = 60) => ({ status, startsAt: at(0), endsAt: at(endMin), durationMin: endMin }) as never;
    assert.equal(schedule.liveBadge(view("SCHEDULED"), at(-5)).text, "Scheduled");
    assert.equal(schedule.liveBadge(view("SCHEDULED"), at(10)).text, "Not started on Zoom");
    assert.equal(schedule.liveBadge(view("SCHEDULED"), at(90)).text, "No Zoom start recorded");
    assert.equal(schedule.liveBadge(view("LIVE"), at(10)).text, "Live now");
    assert.equal(schedule.liveBadge(view("LIVE"), at(90)).text, "Live now", "an overrun stays live");
    assert.equal(schedule.liveBadge(view("ENDED"), at(30)).text, "Ended", "an early finish is ended");
    assert.equal(schedule.phaseOf({ status: "LIVE", startsAt: at(0), durationMin: 60 } as never, at(90)), "live");
    assert.equal(schedule.phaseOf({ status: "ENDED", startsAt: at(0), durationMin: 60 } as never, at(30)), "past");
  });
});

// ── Intervals and aggregation ──────────────────────────────────────────────

describe("participant events -> intervals and attendance", () => {
  test("join and leave open and close one interval; attendance aggregates minutes", async () => {
    session();
    const amina = student("Amina Yusuf", "amina@example.test");
    await run(started(0));
    await run(joined({ user_id: "16778240", user_name: "Amina (phone)", email: "AMINA@example.test" }, 1));
    assert.equal(intervals().length, 1);
    assert.equal(intervals()[0].userId, amina);
    assert.equal(intervals()[0].matchMethod, "EMAIL");
    assert.equal(intervals()[0].leftAt, null);
    assert.equal(attendanceOf(amina)!.status, "JOINED");

    await run(left({ user_id: "16778240", user_name: "Amina (phone)", email: "amina@example.test" }, 31));
    assert.equal((intervals()[0].leftAt as Date).getTime(), at(31).getTime());
    assert.equal(attendanceOf(amina)!.joinedMinutes, 30);
    assert.equal((attendanceOf(amina)!.lastLeftAt as Date).getTime(), at(31).getTime());
  });

  test("rejoins add stretches; overlapping devices count once", async () => {
    session();
    const amina = student("Amina Yusuf", "amina@example.test");
    await run(started(0));
    await run(joined({ user_id: "a1", email: "amina@example.test" }, 0));
    await run(left({ user_id: "a1", email: "amina@example.test" }, 20));
    await run(joined({ user_id: "a2", email: "amina@example.test" }, 10)); // a laptop, overlapping the phone
    await run(left({ user_id: "a2", email: "amina@example.test" }, 30));
    await run(joined({ user_id: "a3", email: "amina@example.test" }, 40));
    await run(left({ user_id: "a3", email: "amina@example.test" }, 50));
    assert.equal(intervals().length, 3);
    assert.equal(attendanceOf(amina)!.joinedMinutes, 40, "0-30 (merged) + 40-50");
  });

  test("meeting.ended closes open intervals and finalises PRESENT / PARTIAL (75% of the real length)", async () => {
    session();
    const amina = student("Amina Yusuf", "amina@example.test");
    const bilal = student("Bilal Ahmed", "bilal@example.test");
    await run(started(0));
    await run(joined({ user_id: "a", email: "amina@example.test" }, 1));
    await run(joined({ user_id: "b", email: "bilal@example.test" }, 30));
    report = [];
    await run(ended(60, 0));
    assert.ok(intervals().every((i) => i.leftAt instanceof Date), "no interval left open");
    assert.equal(attendanceOf(amina)!.joinedMinutes, 59);
    assert.equal(attendanceOf(amina)!.status, "PRESENT");
    assert.equal(attendanceOf(bilal)!.joinedMinutes, 30);
    assert.equal(attendanceOf(bilal)!.status, "PARTIAL");
  });

  test("the report reconciles: fills a missed leave, adds a missed stretch, matches late, records matchMethod", async () => {
    session();
    const amina = student("Amina Yusuf", "amina@example.test");
    const bilal = student("Bilal Ahmed", "bilal@example.test");
    await run(started(0));
    await run(joined({ user_id: "a", email: "amina@example.test" }, 0)); // its leave webhook never arrived
    report = [
      { user_id: "a", name: "Amina", user_email: "amina@example.test", join_time: iso(0), leave_time: iso(40), duration: 2400 },
      { user_id: "b", name: "Bilal Ahmed", join_time: iso(5), leave_time: iso(60), duration: 3300 }, // no webhooks at all, no email
      { user_id: "g", name: "Visitor", join_time: iso(10), leave_time: iso(20), duration: 600 },
    ];
    const result = await run(ended(60, 0));
    assert.equal(result.status, "processed");
    assert.match(String(result.note), /Reconciled 3/);
    assert.equal(reportCalls.length, 1);
    assert.match(reportCalls[0], /\/past_meetings\/inst-uuid%3D%3D\/participants/);
    const aminaInterval = intervals().find((i) => i.zoomParticipantId === "a")!;
    assert.equal((aminaInterval.leftAt as Date).getTime(), at(40).getTime(), "the report's real leave time replaces the end-of-meeting close");
    assert.equal(attendanceOf(amina)!.joinedMinutes, 40);
    assert.equal(attendanceOf(amina)!.status, "PARTIAL");
    const bilalInterval = intervals().find((i) => i.zoomParticipantId === "b")!;
    assert.equal(bilalInterval.userId, bilal);
    assert.equal(bilalInterval.matchMethod, "NAME");
    assert.equal(attendanceOf(bilal)!.status, "PRESENT");
    const visitor = intervals().find((i) => i.zoomParticipantId === "g")!;
    assert.equal(visitor.userId, null, "unmatched participants are kept, without a student");
    assert.equal(visitor.matchMethod, "NONE");
  });
});

// ── Matching ───────────────────────────────────────────────────────────────

describe("matching a participant to a student", () => {
  test("email first, then an exact display name; never a non-student or an ambiguous name", async () => {
    session();
    const amina = student("Amina Yusuf", "amina@example.test");
    student("Sara Khan", "sara1@example.test");
    student("Sara  khan", "sara2@example.test"); // same name, normalised
    const otherCohort = student("Omar Faruq", "omar@example.test", "another-cohort");
    const match = attendance.cohortMatcher(SIRAH_BATCH);
    assert.deepEqual(await match({ email: "Amina@Example.test", name: "Somebody" }, at(1)), { userId: amina, matchMethod: "EMAIL" });
    assert.deepEqual(await match({ email: "unknown@example.test", name: "  amina   YUSUF " }, at(1)), { userId: amina, matchMethod: "NAME" });
    assert.deepEqual(await match({ name: "Sara Khan" }, at(1)), { userId: null, matchMethod: "NONE" }, "two students share the name");
    assert.deepEqual(await match({ email: "omar@example.test", name: "Omar Faruq" }, at(1)), { userId: null, matchMethod: "NONE" }, "not in this cohort");
    assert.ok(otherCohort);
    // An unpaid account is not a student of the cohort, even with a matching email.
    table("sirahOrder").find((o) => o.userId === amina)!.paidCount = 0;
    assert.deepEqual(await attendance.cohortMatcher(SIRAH_BATCH)({ email: "amina@example.test" }, at(1)), { userId: null, matchMethod: "NONE" });
  });

  test("an interval matched later (by the report) fills in userId on the existing row", async () => {
    session();
    const bilal = student("Bilal Ahmed", "bilal@example.test");
    await run(started(0));
    await run(joined({ user_id: "b", user_name: "Guest 4" }, 0));
    assert.equal(intervals()[0].userId, null);
    report = [{ user_id: "b", name: "Bilal Ahmed", user_email: "bilal@example.test", join_time: iso(0), leave_time: iso(55), duration: 3300 }];
    await run(ended(60, 0));
    assert.equal(intervals().length, 1, "same stretch, same row");
    assert.equal(intervals()[0].userId, bilal);
    assert.equal(intervals()[0].matchMethod, "EMAIL");
  });
});

// ── Idempotency, ordering, retries ─────────────────────────────────────────

describe("idempotent and order-tolerant", () => {
  test("reprocessing the same events changes nothing", async () => {
    session();
    const amina = student("Amina Yusuf", "amina@example.test");
    const events = [started(0), joined({ user_id: "a", email: "amina@example.test" }, 1), left({ user_id: "a", email: "amina@example.test" }, 45)];
    for (const e of events) await processor.processZoomWebhookEvent({ id: "x", event: e.event, payload: e });
    const snapshot = JSON.stringify({ s: sessionRow().status, i: intervals().map((i) => [i.joinedAt, i.leftAt, i.userId]), a: table("attendance") });
    for (const e of events) await processor.processZoomWebhookEvent({ id: "x", event: e.event, payload: e });
    assert.equal(JSON.stringify({ s: sessionRow().status, i: intervals().map((i) => [i.joinedAt, i.leftAt, i.userId]), a: table("attendance") }), snapshot);
    assert.equal(table("attendance").length, 1);
    assert.equal(attendanceOf(amina)!.joinedMinutes, 44);

    const id = store(started(0));
    assert.equal((await processor.processStoredZoomEvent(id)).status, "processed");
    assert.equal((await processor.processStoredZoomEvent(id)).status, "skipped", "a processed row is never run again");
  });

  test("a leave seen before its join is retried, then resolves once the join is in", async () => {
    session();
    const amina = student("Amina Yusuf", "amina@example.test");
    await run(started(0));
    const leave = store(left({ user_id: "a", email: "amina@example.test" }, 30), 30);
    assert.equal((await processor.processStoredZoomEvent(leave, at(30))).status, "retry");
    assert.equal(eventRow(leave).processedAt, null);
    assert.match(String(eventRow(leave).error), /before its participant_joined/);
    store(joined({ user_id: "a", email: "amina@example.test" }, 2), 31);
    const summary = await processor.processPendingZoomEvents({ now: at(32) });
    assert.equal(summary.processed, 2);
    assert.ok(eventRow(leave).processedAt instanceof Date);
    assert.equal(attendanceOf(amina)!.joinedMinutes, 28);
  });

  test("a leave that carries its join time stands alone", async () => {
    session();
    student("Amina Yusuf", "amina@example.test");
    await run(started(0));
    assert.equal((await run(left({ user_id: "a", email: "amina@example.test" }, 30, 5))).status, "processed");
    assert.equal(intervals().length, 1);
    assert.equal((intervals()[0].joinedAt as Date).getTime(), at(5).getTime());
    // The join arriving afterwards lands on the same row and does not reopen it.
    await run(joined({ user_id: "a", email: "amina@example.test" }, 5));
    assert.equal(intervals().length, 1);
    assert.equal((intervals()[0].leftAt as Date).getTime(), at(30).getTime());
  });

  test("report not ready: attendance is final from webhooks, the event retries, then the catch-up reconciles", async () => {
    session();
    const amina = student("Amina Yusuf", "amina@example.test");
    await run(started(0));
    await run(joined({ user_id: "a", email: "amina@example.test" }, 0));
    report = null;
    const end = store(ended(60, 0));
    const first = await processor.processStoredZoomEvent(end, at(61));
    assert.equal(first.status, "retry");
    assert.equal(sessionRow().status, "ENDED");
    assert.equal(attendanceOf(amina)!.status, "PRESENT", "already final from the webhook stretches");
    assert.equal(eventRow(end).processedAt, null);
    assert.match(String(eventRow(end).error), /report not available yet/i);

    report = [{ user_id: "a", name: "Amina", user_email: "amina@example.test", join_time: iso(0), leave_time: iso(30), duration: 1800 }];
    const summary = await processor.processPendingZoomEvents({ now: at(75) });
    assert.equal(summary.processed, 1);
    assert.equal(eventRow(end).error, null);
    assert.equal(attendanceOf(amina)!.joinedMinutes, 30);
    assert.equal(attendanceOf(amina)!.status, "PARTIAL");
  });

  test("an event still failing after 48 hours is marked processed with its error kept", async () => {
    session();
    await run(started(0));
    report = null;
    const end = store(ended(60, 0));
    const result = await processor.processStoredZoomEvent(end, new Date(at(60).getTime() + 49 * 3_600_000));
    assert.equal(result.status, "failed");
    assert.ok(eventRow(end).processedAt instanceof Date);
    assert.match(String(eventRow(end).error), /report not available/i);
  });
});

// ── Not our meetings ───────────────────────────────────────────────────────

describe("events for other meetings (Gen-Mumin) are ignored", () => {
  test("no session matches: nothing written, event marked processed", async () => {
    session();
    student("Amina Yusuf", "amina@example.test");
    const foreign = (e: ReturnType<typeof body>) => {
      (e.payload.object as Record<string, unknown>).id = GEN_MUMIN_MEETING;
      return e;
    };
    const ids = [
      store(foreign(started(0))),
      store(foreign(joined({ user_id: "a", email: "amina@example.test" }, 1))),
      store(foreign(left({ user_id: "a", email: "amina@example.test" }, 20))),
      store(foreign(ended(30))),
    ];
    const summary = await processor.processPendingZoomEvents({ now: at(31) });
    assert.equal(summary.ignored, 4);
    assert.ok(ids.every((id) => eventRow(id).processedAt instanceof Date && eventRow(id).error === null));
    assert.equal(sessionRow().status, "SCHEDULED");
    assert.equal(intervals().length, 0);
    assert.equal(table("attendance").length, 0);
    assert.equal(reportCalls.length, 0, "never asks Zoom about someone else's meeting");
  });

  test("events with no handler (e.g. recording.completed) are marked processed, not retried", async () => {
    session();
    const id = store(body("recording.completed", {}, 70));
    const result = await processor.processStoredZoomEvent(id);
    assert.equal(result.status, "ignored");
    assert.ok(eventRow(id).processedAt instanceof Date);
  });
});

// ── Triggers: the webhook's after() and the catch-up endpoint ──────────────

describe("processing triggers", () => {
  test("the webhook stores the event, answers 200, and schedules its processing", async () => {
    session();
    const scheduled: (() => Promise<unknown>)[] = [];
    const original = processor.zoomEventRuntime.schedule;
    processor.zoomEventRuntime.schedule = (task) => {
      scheduled.push(task);
    };
    try {
      const raw = JSON.stringify(started(0));
      const ts = String(Math.floor(Date.now() / 1000));
      const response = await webhookRoute.POST(
        new Request("http://localhost/api/sirah/lms/zoom/webhook", {
          method: "POST",
          headers: {
            "x-zm-signature": webhook.signZoomPayload(FAKE_ENV.ZOOM_WEBHOOK_SECRET_TOKEN, ts, raw),
            "x-zm-request-timestamp": ts,
            "content-type": "application/json",
          },
          body: raw,
        }),
      );
      assert.equal(response.status, 200);
      assert.equal(scheduled.length, 1, "processing is deferred, not done in the request");
      assert.equal(sessionRow().status, "SCHEDULED", "nothing processed before the response");
      await scheduled[0]();
      assert.equal(sessionRow().status, "LIVE");
      assert.ok(table("zoomWebhookEvent")[0].processedAt instanceof Date);
    } finally {
      processor.zoomEventRuntime.schedule = original;
    }
  });

  test("the catch-up endpoint needs CRON_SECRET and processes pending events", async () => {
    session();
    store(started(0));
    const call = (auth?: string) =>
      catchUp.POST(new Request("http://localhost/api/internal/lms/zoom/process-events", { method: "POST", headers: auth ? { authorization: auth } : {} }));
    delete process.env.CRON_SECRET;
    assert.equal((await call("Bearer anything")).status, 503);
    process.env.CRON_SECRET = "cron-secret-for-tests";
    assert.equal((await call()).status, 401);
    assert.equal((await call("Bearer wrong")).status, 401);
    assert.equal(sessionRow().status, "SCHEDULED");
    const ok = await call("Bearer cron-secret-for-tests");
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { examined: 1, processed: 1, ignored: 0, retry: 0, failed: 0 });
    assert.equal(sessionRow().status, "LIVE");
    delete process.env.CRON_SECRET;
  });
});

// ── Pure helpers ───────────────────────────────────────────────────────────

describe("attendance arithmetic", () => {
  test("coveredMinutes merges overlaps and counts open stretches to asOf", () => {
    assert.equal(attendance.coveredMinutes([{ joinedAt: at(0), leftAt: at(30) }, { joinedAt: at(10), leftAt: at(40) }], at(60)), 40);
    assert.equal(attendance.coveredMinutes([{ joinedAt: at(0), leftAt: at(10) }, { joinedAt: at(20), leftAt: null }], at(30)), 20);
    assert.equal(attendance.coveredMinutes([], at(30)), 0);
  });

  test("status: JOINED while live, PRESENT from 75% of the meeting, else PARTIAL", () => {
    assert.equal(attendance.attendanceStatus(10, 60, false), "JOINED");
    assert.equal(attendance.attendanceStatus(45, 60, true), "PRESENT");
    assert.equal(attendance.attendanceStatus(44, 60, true), "PARTIAL");
    assert.equal(attendance.meetingMinutes({ durationMin: 90, zoomStartedAt: at(2), zoomEndedAt: at(62) }), 60);
    assert.equal(attendance.meetingMinutes({ durationMin: 90, zoomStartedAt: null, zoomEndedAt: null }), 90);
  });
});
