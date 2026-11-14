/**
 * Sīrah classroom rules: derived session status, the Join window, schedule
 * grouping, admin input validation (https-only links, zoned times) and the
 * shared enrolment gate. Pure functions only: no database, no network.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  SIRAH_JOIN_WINDOW_MINUTES,
  SIRAH_LESSON_LIVE_MINUTES,
  canJoinLesson,
  groupByWeek,
  lessonStatus,
  nextLesson,
  parseAnnouncementForm,
  parseLessonForm,
  parseMaterialForm,
  sirahEnrolmentAllows,
  utcToZonedLocal,
  zonedLocalToUtc,
} from "../lib/sirah/classroom";

const MIN = 60_000;
const start = new Date("2026-11-20T19:00:00.000Z");
const at = (minutes: number) => new Date(start.getTime() + minutes * MIN);

test("status is derived from scheduledAt", () => {
  assert.equal(lessonStatus(start, at(-1)), "upcoming");
  assert.equal(lessonStatus(start, at(0)), "live");
  assert.equal(lessonStatus(start, at(SIRAH_LESSON_LIVE_MINUTES - 1)), "live");
  assert.equal(lessonStatus(start, at(SIRAH_LESSON_LIVE_MINUTES)), "past");
});

test("Join opens 30 minutes before the start and closes with the live window", () => {
  assert.equal(canJoinLesson(start, at(-SIRAH_JOIN_WINDOW_MINUTES - 1)), false);
  assert.equal(canJoinLesson(start, at(-SIRAH_JOIN_WINDOW_MINUTES)), true);
  assert.equal(canJoinLesson(start, at(-5)), true);
  assert.equal(canJoinLesson(start, at(45)), true);
  assert.equal(canJoinLesson(start, at(SIRAH_LESSON_LIVE_MINUTES)), false);
});

test("next lesson prefers the live session, then the soonest upcoming one", () => {
  const lessons = [
    { id: "past", scheduledAt: at(-7 * 24 * 60) },
    { id: "later", scheduledAt: at(7 * 24 * 60) },
    { id: "live", scheduledAt: at(-10) },
  ];
  assert.equal(nextLesson(lessons, start)?.id, "live");
  assert.equal(nextLesson(lessons, at(SIRAH_LESSON_LIVE_MINUTES))?.id, "later");
  assert.equal(nextLesson([{ id: "old", scheduledAt: at(-500) }], start), null);
});

test("sessions group by week in week then time order", () => {
  const weeks = groupByWeek([
    { id: "w2", weekNumber: 2, scheduledAt: at(0) },
    { id: "w1b", weekNumber: 1, scheduledAt: at(60) },
    { id: "w1a", weekNumber: 1, scheduledAt: at(0) },
  ]);
  assert.deepEqual(
    weeks.map((week) => [week.weekNumber, week.lessons.map((lesson) => lesson.id)]),
    [
      [1, ["w1a", "w1b"]],
      [2, ["w2"]],
    ],
  );
});

test("wall-clock times convert through the chosen zone, across daylight saving", () => {
  // London: GMT in November, BST in July.
  assert.equal(zonedLocalToUtc("2026-11-20T19:00", "Europe/London")?.toISOString(), "2026-11-20T19:00:00.000Z");
  assert.equal(zonedLocalToUtc("2026-07-10T19:00", "Europe/London")?.toISOString(), "2026-07-10T18:00:00.000Z");
  assert.equal(zonedLocalToUtc("2026-11-20T21:00", "Asia/Karachi")?.toISOString(), "2026-11-20T16:00:00.000Z");
  assert.equal(utcToZonedLocal(new Date("2026-07-10T18:00:00.000Z"), "Europe/London"), "2026-07-10T19:00");
  assert.equal(zonedLocalToUtc("2026-02-30T19:00", "Europe/London"), null);
  assert.equal(zonedLocalToUtc("not a date", "Europe/London"), null);
  assert.equal(zonedLocalToUtc("2026-11-20T19:00", "Mars/Olympus"), null);
});

function ok<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) assert.fail(result.error);
  return result.data;
}
const rejected = (result: { ok: boolean }) => !result.ok;

const lessonForm = {
  title: "Arabia before the Prophet",
  summary: "",
  weekNumber: "1",
  scheduledLocal: "2026-11-20T19:00",
  timeZone: "Europe/London",
  zoomJoinUrl: "https://us02web.zoom.us/j/123",
  zoomMeetingId: "123 456 7890",
};

test("lesson form parses to the stored shape", () => {
  const parsed = ok(parseLessonForm(lessonForm));
  assert.equal(parsed.scheduledAt.toISOString(), "2026-11-20T19:00:00.000Z");
  assert.equal(parsed.zoomMeetingId, "1234567890");
  assert.equal(parsed.weekNumber, 1);
  const noZoom = ok(parseLessonForm({ ...lessonForm, zoomJoinUrl: "", zoomMeetingId: "" }));
  assert.equal(noZoom.zoomJoinUrl, null);
  assert.equal(noZoom.zoomMeetingId, null);
});

test("only https links are accepted", () => {
  for (const url of ["javascript:alert(1)", "http://zoom.us/j/1", "data:text/html,hi", "zoom.us/j/1"]) {
    assert.ok(rejected(parseLessonForm({ ...lessonForm, zoomJoinUrl: url })), url);
    assert.ok(rejected(parseMaterialForm({ lessonId: "", title: "Slides", kind: "SLIDES", url, order: "0" })), url);
  }
  const material = ok(parseMaterialForm({ lessonId: "", title: "Slides", kind: "SLIDES", url: "https://example.com/a.pdf", order: "" }));
  assert.equal(material.lessonId, null);
  assert.equal(material.order, 0);
  assert.ok(rejected(parseMaterialForm({ lessonId: "", title: "Slides", kind: "VIDEO", url: "https://example.com", order: "0" })));
});

test("lesson and announcement forms reject missing fields", () => {
  assert.ok(rejected(parseLessonForm({ ...lessonForm, title: "  " })));
  assert.ok(rejected(parseLessonForm({ ...lessonForm, weekNumber: "0" })));
  assert.ok(rejected(parseLessonForm({ ...lessonForm, timeZone: "Nowhere/Else" })));
  assert.ok(rejected(parseAnnouncementForm({ title: "Hi", body: "" })));
  assert.equal(ok(parseAnnouncementForm({ title: "Hi", body: "Welcome", pinned: "on" })).pinned, true);
  assert.equal(ok(parseAnnouncementForm({ title: "Hi", body: "Welcome" })).pinned, false);
});

test("the shared enrolment gate matches the original /seerah/lms rule exactly", () => {
  type Enrollment = { status: string; registrationId: string } | undefined;
  type Order = { registrationId: string | null } | null;
  // The expression /seerah/lms used before it was extracted (true = redirect).
  const originalRedirects = (enrollment: Enrollment, order: Order, grants: boolean) =>
    (order?.registrationId === enrollment?.registrationId && !!order && !grants) ||
    (enrollment?.status !== "ACTIVE" && !(order && grants));
  const enrollments: Enrollment[] = [
    undefined,
    { status: "ACTIVE", registrationId: "r1" },
    { status: "PENDING", registrationId: "r1" },
    { status: "ACTIVE", registrationId: "r2" },
    { status: "CANCELLED", registrationId: "r2" },
  ];
  const orders: Order[] = [null, { registrationId: "r1" }, { registrationId: null }, { registrationId: "r3" }];
  for (const enrollment of enrollments)
    for (const order of orders)
      for (const grants of [true, false])
        assert.equal(
          sirahEnrolmentAllows({ enrollment, order, orderGrantsAccess: grants }),
          !originalRedirects(enrollment, order, grants),
          JSON.stringify({ enrollment, order, grants }),
        );
  // Plainly: nobody gets in without a paid, active enrolment.
  assert.equal(sirahEnrolmentAllows({ enrollment: null, order: null, orderGrantsAccess: false }), false);
  assert.equal(sirahEnrolmentAllows({ enrollment: null, order: { registrationId: null }, orderGrantsAccess: false }), false);
});
