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
  courseProgress,
  groupByWeek,
  lessonNeighbours,
  lessonStatus,
  nextLesson,
  parseAnnouncementForm,
  parseLessonForm,
  parseMaterialForm,
  recordingEmbed,
  safeClassroomReturn,
  sirahEnrolmentAllows,
  toLessonView,
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

/* ---------- Lesson detail rules ---------- */

test("YouTube and Vimeo links become privacy-friendly embeds; nothing else does", () => {
  const yt = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";
  assert.equal(recordingEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")?.src, yt);
  assert.equal(recordingEmbed("https://youtu.be/dQw4w9WgXcQ")?.src, yt);
  assert.equal(recordingEmbed("https://youtube.com/live/dQw4w9WgXcQ")?.src, yt);
  assert.equal(recordingEmbed("https://vimeo.com/123456789")?.src, "https://player.vimeo.com/video/123456789");
  assert.equal(recordingEmbed("https://vimeo.com/123456789/abcdef1234")?.src, "https://player.vimeo.com/video/123456789?h=abcdef1234");
  assert.equal(recordingEmbed("https://player.vimeo.com/video/123456789")?.provider, "vimeo");
  for (const url of [
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=short",
    "https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://drive.google.com/file/d/abc/view",
    "javascript:alert(1)",
    "not a url",
  ])
    assert.equal(recordingEmbed(url), null, url);
});

const schedule = [
  { id: "c", weekNumber: 2, scheduledAt: at(7 * 24 * 60), title: "C" },
  { id: "a", weekNumber: 1, scheduledAt: at(-7 * 24 * 60), title: "A" },
  { id: "b", weekNumber: 1, scheduledAt: at(-7 * 24 * 60 + 120), title: "B" },
  { id: "d", weekNumber: 3, scheduledAt: at(14 * 24 * 60), title: "D" },
];

test("previous and next follow week order, then start time", () => {
  assert.deepEqual(
    Object.values(lessonNeighbours(schedule, "b")).map((lesson) => lesson?.id),
    ["a", "c"],
  );
  assert.deepEqual(
    Object.values(lessonNeighbours(schedule, "a")).map((lesson) => lesson?.id ?? null),
    [null, "b"],
  );
  assert.deepEqual(
    Object.values(lessonNeighbours(schedule, "d")).map((lesson) => lesson?.id ?? null),
    ["c", null],
  );
  assert.deepEqual(lessonNeighbours(schedule, "missing"), { previous: null, next: null });
});

test("course progress: current week, total weeks, next class and completed count", () => {
  const progress = courseProgress(schedule, new Set(["a", "gone"]), start);
  assert.equal(progress.currentWeek, 1);
  assert.equal(progress.totalWeeks, 3);
  assert.equal(progress.totalSessions, 4);
  assert.equal(progress.completed, 1, "a mark on a deleted session does not count");
  assert.equal(progress.next?.id, "c");
  const before = courseProgress(schedule, new Set(), at(-30 * 24 * 60));
  assert.equal(before.currentWeek, null);
  assert.equal(before.next?.id, "a");
});

const record = {
  id: "l1",
  title: "Week 1",
  summary: "",
  weekNumber: 1,
  scheduledAt: start,
  zoomJoinUrl: "https://zoom.us/j/111",
  zoomMeetingId: "111",
};
const recordMaterials = [
  { id: "m1", title: "Recording", kind: "RECORDING" as const, url: "https://youtu.be/dQw4w9WgXcQ", order: 0 },
  { id: "m2", title: "Slides", kind: "SLIDES" as const, url: "https://example.com/s.pdf", order: 1 },
  { id: "m3", title: "Chapter", kind: "PDF" as const, url: "https://example.com/c.pdf", order: 2 },
];

test("view builder: Zoom link only for enrolled viewers inside the join window", () => {
  assert.equal(toLessonView(record, [], { enrolled: true }, at(-31)).zoomJoinUrl, null);
  assert.equal(toLessonView(record, [], { enrolled: true }, at(-30)).zoomJoinUrl, record.zoomJoinUrl);
  assert.equal(toLessonView(record, [], { enrolled: true }, at(SIRAH_LESSON_LIVE_MINUTES)).zoomJoinUrl, null);
  const outsider = toLessonView(record, recordMaterials, { enrolled: false }, at(-5));
  assert.equal(outsider.zoomJoinUrl, null);
  assert.equal(outsider.zoomMeetingId, null);
});

test("view builder: material and recording URLs are enrolled-only, with no time window", () => {
  const longAfter = at(365 * 24 * 60);
  const enrolled = toLessonView(record, recordMaterials, { enrolled: true }, longAfter);
  assert.equal(enrolled.materials.find((m) => m.kind === "RECORDING")?.url, recordMaterials[0].url);
  assert.equal(enrolled.materials.find((m) => m.kind === "RECORDING")?.embed?.provider, "youtube");
  assert.deepEqual(
    enrolled.groups.map((group) => [group.label, group.items.map((item) => item.id)]),
    [
      ["Recording", ["m1"]],
      ["Slides", ["m2"]],
      ["Readings", ["m3"]],
    ],
  );
  const outsider = JSON.stringify(toLessonView(record, recordMaterials, { enrolled: false }, start));
  for (const material of recordMaterials) assert.ok(!outsider.includes(material.url), material.url);
  assert.ok(!outsider.includes("youtube"));
  assert.ok(!outsider.includes(record.zoomJoinUrl));
});

test("the completion form can only return to the classroom or that session", () => {
  assert.equal(safeClassroomReturn("/seerah/classroom/l1", "l1"), "/seerah/classroom/l1");
  assert.equal(safeClassroomReturn("/seerah/classroom/other", "l1"), "/seerah/classroom");
  assert.equal(safeClassroomReturn("https://evil.example", "l1"), "/seerah/classroom");
  assert.equal(safeClassroomReturn(null, "l1"), "/seerah/classroom");
});
