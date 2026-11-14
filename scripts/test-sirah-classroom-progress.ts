/**
 * Sīrah classroom services against an in-memory Prisma stand-in (no database,
 * no network): the completion toggle, and the URL boundary on the session
 * page (recording, material and Zoom URLs never reach a non-enrolled viewer).
 */
import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";
import { installFakePrisma, table, tables } from "./fixtures/fake-prisma";

installFakePrisma();

let svc: typeof import("../services/sirah-classroom.service");
before(async () => {
  svc = await import("../services/sirah-classroom.service");
});

const MIN = 60_000;
const start = new Date("2026-11-20T19:00:00.000Z");
const at = (minutes: number) => new Date(start.getTime() + minutes * MIN);
const RECORDING_URL = "https://youtu.be/dQw4w9WgXcQ";
const SLIDES_URL = "https://example.com/private-slides.pdf";
const ZOOM_URL = "https://us02web.zoom.us/j/9876543210?pwd=secret";

const enrolled = { allowed: true, studentId: "student-1" };
const otherStudent = { allowed: true, studentId: "student-2" };
const notEnrolled = { allowed: false, studentId: "student-3" };
const signedOut = { allowed: false, studentId: null };

beforeEach(() => {
  tables.clear();
  table("sirahLesson").push(
    { id: "w1", title: "Arabia before Islam", summary: "Setting", weekNumber: 1, scheduledAt: start, zoomJoinUrl: ZOOM_URL, zoomMeetingId: "987 654 3210" },
    { id: "w2", title: "The Makkan years", summary: "", weekNumber: 2, scheduledAt: at(7 * 24 * 60), zoomJoinUrl: null, zoomMeetingId: null },
  );
  table("sirahMaterial").push(
    { id: "m1", lessonId: "w1", title: "Recording", kind: "RECORDING", url: RECORDING_URL, order: 0 },
    { id: "m2", lessonId: "w1", title: "Slides", kind: "SLIDES", url: SLIDES_URL, order: 1 },
  );
});

const progressRows = () => table("sirahLessonProgress");

test("an enrolled student marks a session complete, then incomplete again", async () => {
  const done = await svc.setLessonComplete(enrolled, "w1", true, at(100));
  assert.deepEqual(done, { ok: true, completed: true });
  assert.equal(progressRows().length, 1);
  assert.equal(progressRows()[0].studentId, "student-1");
  assert.equal((progressRows()[0].completedAt as Date).getTime(), at(100).getTime());
  assert.deepEqual([...(await svc.getCompletedLessonIds("student-1"))], ["w1"]);

  const undone = await svc.setLessonComplete(enrolled, "w1", false);
  assert.deepEqual(undone, { ok: true, completed: false });
  assert.equal(progressRows().length, 1, "toggling updates the one row, never duplicates it");
  assert.equal(progressRows()[0].completedAt, null);
  assert.equal((await svc.getCompletedLessonIds("student-1")).size, 0);
});

test("marking twice is idempotent and each student has their own row", async () => {
  await svc.setLessonComplete(enrolled, "w1", true);
  await svc.setLessonComplete(enrolled, "w1", true);
  await svc.setLessonComplete(otherStudent, "w2", true);
  assert.equal(progressRows().length, 2);
  assert.deepEqual([...(await svc.getCompletedLessonIds("student-1"))], ["w1"]);
  assert.deepEqual([...(await svc.getCompletedLessonIds("student-2"))], ["w2"]);
});

test("non-enrolled or signed-out viewers cannot write progress", async () => {
  assert.deepEqual(await svc.setLessonComplete(notEnrolled, "w1", true), { ok: false, reason: "not-enrolled" });
  assert.deepEqual(await svc.setLessonComplete(signedOut, "w1", true), { ok: false, reason: "not-enrolled" });
  assert.equal(progressRows().length, 0);
});

test("progress on an unknown session is refused", async () => {
  assert.deepEqual(await svc.setLessonComplete(enrolled, "nope", true), { ok: false, reason: "not-found" });
  assert.equal(progressRows().length, 0);
});

test("the recording URL never reaches a non-enrolled viewer, even in the join window", async () => {
  for (const gate of [notEnrolled, signedOut]) {
    for (const now of [at(-10), at(10), at(365 * 24 * 60)]) {
      const detail = await svc.getLessonDetail("w1", gate, now);
      assert.ok(detail);
      const payload = JSON.stringify(detail);
      for (const secret of [RECORDING_URL, "dQw4w9WgXcQ", SLIDES_URL, ZOOM_URL, "987 654 3210"])
        assert.ok(!payload.includes(secret), `${secret} leaked to ${JSON.stringify(gate)} at ${now.toISOString()}`);
      assert.equal(detail.lesson.materials.length, 0);
      assert.equal(detail.completedAt, null);
    }
  }
});

test("an enrolled student gets the recording at any time, and Zoom only in the window", async () => {
  const yearLater = await svc.getLessonDetail("w1", enrolled, at(365 * 24 * 60));
  assert.ok(yearLater);
  const recording = yearLater.lesson.materials.find((material) => material.kind === "RECORDING");
  assert.equal(recording?.url, RECORDING_URL);
  assert.equal(recording?.embed?.src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(yearLater.lesson.zoomJoinUrl, null);

  const early = await svc.getLessonDetail("w1", enrolled, at(-31));
  assert.equal(early?.lesson.zoomJoinUrl, null);
  const inWindow = await svc.getLessonDetail("w1", enrolled, at(-30));
  assert.equal(inWindow?.lesson.zoomJoinUrl, ZOOM_URL);
});

test("session detail carries neighbours (titles only) and the student's own mark", async () => {
  await svc.setLessonComplete(enrolled, "w1", true, at(100));
  const detail = await svc.getLessonDetail("w1", enrolled, at(200));
  assert.ok(detail);
  assert.equal(detail.previous, null);
  assert.deepEqual(Object.keys(detail.next ?? {}).sort(), ["id", "scheduledAt", "title", "weekNumber"]);
  assert.equal(detail.next?.id, "w2");
  assert.equal(detail.completedAt?.getTime(), at(100).getTime());
  // Another student's view of the same session does not see that mark.
  assert.equal((await svc.getLessonDetail("w1", otherStudent, at(200)))?.completedAt, null);
  assert.equal(await svc.getLessonDetail("missing", enrolled), null);
});
