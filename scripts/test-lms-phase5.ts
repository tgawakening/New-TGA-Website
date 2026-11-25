/**
 * LMS Phase 5: resources, announcements, notifications and the calendar feed.
 *
 * Mocks only: the database is the in-memory fake Prisma, file signing is a
 * stub signer (no Spaces), and Resend is mocked at fetch (no network).
 * Nothing reaches a real database, bucket or mail provider.
 */
import assert from "node:assert/strict";
import test, { afterEach, before, beforeEach, describe } from "node:test";
import { installFakePrisma, table, tables } from "./fixtures/fake-prisma";

installFakePrisma();

const CAL_SECRET = "calendar-test-secret-0123456789abcdef";

let content: typeof import("../lib/lms/content");
let notifications: typeof import("../lib/lms/notifications");
let calendar: typeof import("../lib/lms/calendar");
let calendarRoute: typeof import("../app/api/sirah/lms/calendar/[token]/route");
let SIRAH_BATCH: string;
let SIRAH_SLUG: string;
before(async () => {
  content = await import("../lib/lms/content");
  notifications = await import("../lib/lms/notifications");
  calendar = await import("../lib/lms/calendar");
  calendarRoute = await import("../app/api/sirah/lms/calendar/[token]/route");
  ({ SIRAH_BATCH, SIRAH_SLUG } = await import("../lib/sirah/catalog"));
});

const OTHER = "OTHER-COHORT";
const NOW = new Date("2026-12-01T10:00:00Z");
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

// ── Resend mock ────────────────────────────────────────────────────────────
type Sent = { to: string; subject: string; text: string; idempotency: string | null };
let sent: Sent[] = [];
const originalFetch = global.fetch;

// ── Fixtures ───────────────────────────────────────────────────────────────
let seq = 0;
function student(name: string, options: { batchCode?: string; paid?: boolean } = {}) {
  seq += 1;
  const id = `user_${seq}`;
  table("user").push({ id, fullName: name, email: `${name.toLowerCase()}@example.test`, status: "ACTIVE", role: "STUDENT" });
  const paid = options.paid ?? true;
  table("sirahOrder").push({
    id: `order_${seq}`, userId: id, courseId: "course_sirah", batchCode: options.batchCode ?? SIRAH_BATCH, plan: "ANNUAL", method: "STRIPE",
    paymentState: paid ? "PAID" : "UNPAID", enrolmentState: paid ? "ACTIVE" : "PENDING", paidCount: paid ? 1 : 0, registrationId: null,
    archivedAt: null, accessEndsAt: null, programmeStart: null, programmeEnd: null, cycleBillingDay: null, cycleGraceDay: null,
    cycleFirstDueAt: null, cancelledAt: null, createdAt: new Date(NOW.getTime() - 86_400_000),
  });
  return id;
}

function session(id: string, overrides: Record<string, unknown> = {}) {
  const row = {
    id, cohortId: SIRAH_BATCH, title: `Class ${id}`, startsAt: minutes(24 * 60), durationMin: 60, status: "SCHEDULED",
    zoomHostId: "host_1", zoomMeetingId: "123", joinUrlEncrypted: "v1.secret.join.url", passcodeEncrypted: "v1.secret.pass",
    createdAt: NOW, updatedAt: NOW, zoomStartedAt: null, zoomEndedAt: null, ...overrides,
  };
  table("lmsSession").push(row);
  return row;
}

const signed: string[] = [];
const signer = async ({ key, expiresIn }: { key: string; expiresIn: number }) => {
  signed.push(key);
  return `https://signed.example/${encodeURIComponent(key)}?ttl=${expiresIn}`;
};

beforeEach(() => {
  tables.clear();
  seq = 0;
  sent = [];
  signed.length = 0;
  Object.assign(process.env, {
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "The Global Awakening <noreply@example.test>",
    NEXT_PUBLIC_APP_URL: "https://tga.example",
    LMS_CALENDAR_FEED_SECRET: CAL_SECRET,
  });
  global.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    sent.push({ to: body.to[0], subject: body.subject, text: body.text, idempotency: (init.headers as Record<string, string>)["Idempotency-Key"] ?? null });
    return new Response(JSON.stringify({ id: `re_${sent.length}` }), { status: 200 });
  }) as typeof fetch;
  table("course").push({ id: "course_sirah", slug: SIRAH_SLUG });
  table("sirahCohort").push({ batchCode: SIRAH_BATCH }, { batchCode: OTHER });
  table("zoomHost").push({ id: "host_1", email: "teacher@example.test", licensed: true, active: true, zoomUserId: "zu" });
});
afterEach(() => {
  global.fetch = originalFetch;
});

// ── Resources ──────────────────────────────────────────────────────────────

describe("resources", () => {
  test("recording attachments follow the published recording and enrolment", async () => {
    const external = await import("../lib/lms/external-recordings");
    const enrolled = student("RecordingStudent", { batchCode: OTHER });
    const unpaid = student("UnpaidRecordingStudent", { paid: false });
    const recording = { id: "recording", cohortId: null, sessionId: null, parentRecordingId: null, kind: "LINK", contentType: "video/x-external-recording", visibility: "PUBLISHED", title: "Recording", url: "https://example.test/video", createdAt: NOW };
    table("lmsResource").push(recording);
    await assert.rejects(content.createLinkResource({ scope: { parentRecordingId: "missing" }, title: "Task", url: "https://example.test/task", uploadedBy: "admin" }), content.LmsContentError);
    const link = await content.createLinkResource({ scope: { parentRecordingId: recording.id }, title: "Task", url: "https://example.test/task", uploadedBy: "admin" });
    assert.equal(link.sessionId, null);
    assert.equal(link.parentRecordingId, recording.id);
    await content.setResourceVisibility(link.id, "PUBLISHED");
    const file = await content.createFileResource({ scope: { parentRecordingId: recording.id }, title: "File", storageKey: "recording-task", contentType: "application/pdf", sizeBytes: 10, originalFilename: "task.pdf", uploadedBy: "admin" });
    await content.setResourceVisibility(file.id, "PUBLISHED");
    assert.equal((await external.studentStandaloneRecordings(enrolled, NOW))[0].resources.length, 2);
    assert.equal((await external.studentStandaloneRecordings(unpaid, NOW)).length, 0);
    assert.equal((await content.resolveResourceFile(file.id, enrolled, signer, NOW)).kind, "redirect");
    assert.equal((await content.resolveResourceFile(file.id, unpaid, signer, NOW)).kind, "denied");
    recording.visibility = "HIDDEN";
    assert.equal((await external.studentStandaloneRecordings(enrolled, NOW)).length, 0);
    assert.equal((await content.resolveResourceFile(file.id, enrolled, signer, NOW)).kind, "missing");
  });
  test("links must be https; titles are required", async () => {
    for (const url of ["http://example.com", "javascript:alert(1)", "data:text/html,x", ""])
      await assert.rejects(content.createLinkResource({ scope: { cohortId: SIRAH_BATCH }, title: "x", url, uploadedBy: "a@x" }), content.LmsContentError);
    await assert.rejects(content.createLinkResource({ scope: { cohortId: SIRAH_BATCH }, title: " ", url: "https://ok.example", uploadedBy: "a@x" }));
    await assert.rejects(content.createLinkResource({ scope: { cohortId: "NOPE" }, title: "t", url: "https://ok.example", uploadedBy: "a@x" }));
  });

  test("new resources start HIDDEN; students see only PUBLISHED ones of their own cohort", async () => {
    const amina = student("Amina");
    const omar = student("Omar", { batchCode: OTHER });
    const unpaid = student("Zaid", { paid: false });
    session("s1");
    session("s_other", { cohortId: OTHER });

    const link = await content.createLinkResource({ scope: { cohortId: SIRAH_BATCH }, title: "Reading", url: "https://read.example/a", uploadedBy: "admin@x" });
    const file = await content.createFileResource({
      scope: { sessionId: "s1" }, title: "Slides", storageKey: "sirah/classroom/00000000-0000-0000-0000-000000000001/slides.pdf",
      contentType: "application/pdf", sizeBytes: 2048, originalFilename: "slides.pdf", uploadedBy: "teacher@example.test",
    });
    const foreign = await content.createLinkResource({ scope: { sessionId: "s_other" }, title: "Other cohort", url: "https://x.example", uploadedBy: "a@x" });
    assert.equal(link.visibility, "HIDDEN");
    assert.equal(file.visibility, "HIDDEN");
    assert.equal(file.cohortId, null, "a session resource takes its cohort from the session");

    assert.deepEqual((await content.studentContent(amina, NOW)).resources, [], "nothing is visible before publishing");

    await content.setResourceVisibility(link.id, "PUBLISHED", NOW);
    await content.setResourceVisibility(file.id, "PUBLISHED", minutes(1));
    await content.setResourceVisibility(foreign.id, "PUBLISHED", NOW);

    const mine = await content.studentContent(amina, minutes(2));
    assert.equal(mine.allowed, true);
    assert.deepEqual(mine.resources.map((r) => r.title), ["Slides", "Reading"], "newest published first, cohort-wide and session resources");
    const slides = mine.resources.find((r) => r.title === "Slides")!;
    assert.equal(slides.href, `/api/sirah/lms/resources/${file.id}`, "a file is only ever the enrolment-checked route");
    assert.equal(slides.sessionTitle, "Class s1");
    assert.ok(!JSON.stringify(mine).includes("sirah/classroom/"), "the storage key never reaches the student");

    assert.deepEqual((await content.studentContent(omar, NOW)).resources.map((r) => r.title), ["Other cohort"], "another cohort sees only its own");
    const gated = await content.studentContent(unpaid, NOW);
    assert.equal(gated.allowed, false);
    assert.deepEqual(gated.resources, []);

    await content.setResourceVisibility(link.id, "HIDDEN", minutes(3));
    assert.deepEqual((await content.studentContent(amina, minutes(4))).resources.map((r) => r.title), ["Slides"], "hiding takes it away again");
  });

  test("file access: login, enrolment, cohort and PUBLISHED are checked before any signature", async () => {
    const amina = student("Amina");
    const omar = student("Omar", { batchCode: OTHER });
    const unpaid = student("Zaid", { paid: false });
    session("s1");
    const key = "sirah/classroom/00000000-0000-0000-0000-000000000002/notes.pdf";
    const file = await content.createFileResource({
      scope: { sessionId: "s1" }, title: "Notes", storageKey: key, contentType: "application/pdf", sizeBytes: 10, originalFilename: "notes.pdf", uploadedBy: "t@x",
    });

    assert.equal((await content.resolveResourceFile(file.id, null, signer, NOW)).kind, "login");
    assert.equal((await content.resolveResourceFile(file.id, unpaid, signer, NOW)).kind, "denied");
    assert.equal((await content.resolveResourceFile(file.id, amina, signer, NOW)).kind, "missing", "hidden looks like missing");
    await content.setResourceVisibility(file.id, "PUBLISHED", NOW);
    assert.equal((await content.resolveResourceFile(file.id, omar, signer, NOW)).kind, "missing", "another cohort looks like missing");
    assert.equal((await content.resolveResourceFile("nope", amina, signer, NOW)).kind, "missing");
    assert.equal(signed.length, 0, "no signature was issued for any refused request");

    const ok = await content.resolveResourceFile(file.id, amina, signer, NOW);
    assert.equal(ok.kind, "redirect");
    assert.ok(ok.kind === "redirect" && ok.expiresIn <= 10 * 60, "a document link is short-lived");
    assert.deepEqual(signed, [key]);
  });
});

// ── Announcements ──────────────────────────────────────────────────────────

describe("announcements", () => {
  test("drafts are hidden; published ones show newest first, enrolment-gated", async () => {
    const amina = student("Amina");
    const omar = student("Omar", { batchCode: OTHER });
    const unpaid = student("Zaid", { paid: false });
    const first = await content.createAnnouncement({ cohortId: SIRAH_BATCH, title: "Welcome", body: "Hello", publish: true, createdBy: "a@x", now: minutes(-60) });
    const draft = await content.createAnnouncement({ cohortId: SIRAH_BATCH, title: "Draft", body: "Not yet", publish: false, createdBy: "a@x" });
    await content.createAnnouncement({ cohortId: SIRAH_BATCH, title: "Week 2", body: "Reading", publish: true, createdBy: "a@x", now: minutes(-10) });
    await content.createAnnouncement({ cohortId: OTHER, title: "Other", body: "x", publish: true, createdBy: "a@x", now: minutes(-5) });

    assert.deepEqual((await content.studentContent(amina, NOW)).announcements.map((a) => a.title), ["Week 2", "Welcome"]);
    assert.deepEqual((await content.studentContent(omar, NOW)).announcements.map((a) => a.title), ["Other"]);
    assert.deepEqual((await content.studentContent(unpaid, NOW)).announcements, []);

    await content.setAnnouncementPublished(draft.id, true, minutes(1));
    await content.setAnnouncementPublished(first.id, false, minutes(1));
    assert.deepEqual((await content.studentContent(amina, minutes(2))).announcements.map((a) => a.title), ["Draft", "Week 2"]);

    await content.updateAnnouncement(draft.id, { title: "Edited", body: "Now ready" });
    await content.deleteAnnouncement(first.id);
    assert.deepEqual((await content.studentContent(amina, minutes(2))).announcements.map((a) => a.title), ["Edited", "Week 2"]);
  });
});

// ── Notifications ──────────────────────────────────────────────────────────

describe("notifications", () => {
  const rows = () => table("lmsNotification");

  test("an announcement notifies each enrolled cohort student once, in-app and by email", async () => {
    const amina = student("Amina");
    const bilal = student("Bilal");
    student("Omar", { batchCode: OTHER });
    student("Zaid", { paid: false });
    const post = await content.createAnnouncement({ cohortId: SIRAH_BATCH, title: "Class moved online", body: "Details inside.", publish: true, createdBy: "a@x", now: NOW });

    assert.equal(await notifications.notifyAnnouncement(post.id, NOW), 2);
    assert.equal(await notifications.notifyAnnouncement(post.id, NOW), 0, "a second trigger creates nothing");
    assert.deepEqual(rows().map((r) => r.userId).sort(), [amina, bilal].sort(), "only the cohort's paid + active students");

    const first = await notifications.dispatchLmsNotificationEmails({ now: NOW });
    assert.equal(first.sent, 2);
    assert.deepEqual(sent.map((m) => m.to).sort(), ["amina@example.test", "bilal@example.test"]);
    assert.ok(sent.every((m) => m.idempotency?.startsWith("lms-notify-")), "every email carries an idempotency key");
    assert.ok(sent[0].subject.startsWith("Class moved online"));
    const again = await notifications.dispatchLmsNotificationEmails({ now: minutes(5) });
    assert.equal(again.sent, 0, "nothing is emailed twice");
    assert.equal(sent.length, 2);

    // Unpublish and publish again: still no second notice.
    await content.setAnnouncementPublished(post.id, false, minutes(6));
    await content.setAnnouncementPublished(post.id, true, minutes(7));
    assert.equal(await notifications.notifyAnnouncement(post.id, minutes(7)), 0);
  });

  test("a draft notifies no one; a taken-down subject cancels its queued email", async () => {
    student("Amina");
    const draft = await content.createAnnouncement({ cohortId: SIRAH_BATCH, title: "Draft", body: "x", publish: false, createdBy: "a@x" });
    assert.equal(await notifications.notifyAnnouncement(draft.id, NOW), 0);

    const link = await content.createLinkResource({ scope: { cohortId: SIRAH_BATCH }, title: "Map", url: "https://map.example", uploadedBy: "a@x" });
    assert.equal(await notifications.notifyResource(link.id, NOW), 0, "a hidden resource notifies no one");
    await content.setResourceVisibility(link.id, "PUBLISHED", NOW);
    assert.equal(await notifications.notifyResource(link.id, NOW), 1);
    await content.setResourceVisibility(link.id, "HIDDEN", minutes(1));
    const result = await notifications.dispatchLmsNotificationEmails({ now: minutes(2) });
    assert.equal(result.sent, 0);
    assert.equal(result.cancelled, 1);
    assert.equal(rows()[0].emailState, "CANCELLED");
    assert.equal(sent.length, 0);
  });

  test("a student who leaves the cohort before sending is not emailed", async () => {
    const amina = student("Amina");
    const link = await content.createLinkResource({ scope: { cohortId: SIRAH_BATCH }, title: "Map", url: "https://map.example", uploadedBy: "a@x" });
    await content.setResourceVisibility(link.id, "PUBLISHED", NOW);
    await notifications.notifyResource(link.id, NOW);
    table("sirahOrder").find((o) => o.userId === amina)!.enrolmentState = "CANCELLED";
    const result = await notifications.dispatchLmsNotificationEmails({ now: minutes(1) });
    assert.equal(result.cancelled, 1);
    assert.equal(sent.length, 0);
  });

  test("scheduled, time changed and starting soon: once per start time, and a moved class cancels the stale email", async () => {
    student("Amina");
    const row = session("s1", { startsAt: minutes(3 * 24 * 60) });
    assert.equal(await notifications.notifySessionScheduled("s1", NOW), 1);
    assert.equal(await notifications.notifySessionScheduled("s1", NOW), 0);

    const previous = row.startsAt as Date;
    row.startsAt = minutes(60);
    assert.equal(await notifications.notifySessionTimeChanged("s1", previous, NOW), 1);
    assert.equal(await notifications.notifySessionTimeChanged("s1", previous, NOW), 0, "the same new time is one notice");
    assert.equal(await notifications.notifySessionTimeChanged("s1", row.startsAt as Date, NOW), 0, "an unchanged start notifies no one");

    assert.equal(await notifications.queueStartingSoon(NOW), 1, "inside the 90-minute lead");
    assert.equal(await notifications.queueStartingSoon(minutes(10)), 0, "the next sweep adds nothing");
    session("s_far", { startsAt: minutes(5 * 60) });
    assert.equal(await notifications.queueStartingSoon(NOW), 0, "a class hours away is not 'soon'");

    const result = await notifications.dispatchLmsNotificationEmails({ now: NOW });
    assert.equal(result.sent, 2, "time-changed and starting-soon go out");
    assert.equal(result.cancelled, 1, "the scheduled notice for the old time is cancelled");
    const types = rows().map((r) => `${r.type}:${r.emailState}`).sort();
    assert.deepEqual(types, ["SESSION_SCHEDULED:CANCELLED", "SESSION_STARTING_SOON:SENT", "SESSION_TIME_CHANGED:SENT"]);
  });

  test("a cancelled class notifies no one", async () => {
    student("Amina");
    session("s1", { status: "CANCELLED" });
    assert.equal(await notifications.notifySessionScheduled("s1", NOW), 0);
    assert.equal(await notifications.queueStartingSoon(NOW), 0);
  });

  test("inbox: unread count and mark-read are scoped to the student", async () => {
    const amina = student("Amina");
    const bilal = student("Bilal");
    const link = await content.createLinkResource({ scope: { cohortId: SIRAH_BATCH }, title: "Map", url: "https://map.example", uploadedBy: "a@x" });
    await content.setResourceVisibility(link.id, "PUBLISHED", NOW);
    const post = await content.createAnnouncement({ cohortId: SIRAH_BATCH, title: "Hi", body: "x", publish: true, createdBy: "a@x", now: NOW });
    await notifications.notifyResource(link.id, NOW);
    await notifications.notifyAnnouncement(post.id, NOW);
    assert.equal(await notifications.unreadCount(amina), 2);

    const bilalsRow = rows().find((r) => r.userId === bilal)!;
    assert.equal(await notifications.markRead(amina, bilalsRow.id as string), 0, "another student's notification is untouched");
    assert.equal(await notifications.unreadCount(bilal), 2);

    const aminas = rows().filter((r) => r.userId === amina);
    assert.equal(await notifications.markRead(amina, aminas[0].id as string), 1);
    assert.equal(await notifications.unreadCount(amina), 1);
    assert.equal(await notifications.markAllRead(amina), 1);
    assert.equal(await notifications.unreadCount(amina), 0);
    assert.equal((await notifications.studentInbox(amina)).length, 2);
  });

  test("no email provider configured: rows stay queued and nothing is sent", async () => {
    student("Amina");
    const post = await content.createAnnouncement({ cohortId: SIRAH_BATCH, title: "Hi", body: "x", publish: true, createdBy: "a@x", now: NOW });
    await notifications.notifyAnnouncement(post.id, NOW);
    delete process.env.RESEND_API_KEY;
    const result = await notifications.dispatchLmsNotificationEmails({ now: NOW });
    assert.equal(result.configured, false);
    assert.equal(rows()[0].emailState, "PENDING");
    assert.equal(sent.length, 0);
  });
});

// ── Calendar feed ──────────────────────────────────────────────────────────

describe("calendar feed", () => {
  const get = (token: string) => calendarRoute.GET(new Request(`https://tga.example/api/sirah/lms/calendar/${token}`), { params: Promise.resolve({ token }) });

  test("tokens verify only for the user they were issued for", () => {
    const token = calendar.calendarToken("user_42")!;
    assert.equal(calendar.verifyCalendarToken(token), "user_42");
    const [id, sig] = token.split(".");
    const forged = `${Buffer.from("user_43").toString("base64url")}.${sig}`;
    assert.equal(calendar.verifyCalendarToken(forged), null, "a signature cannot be moved to another user");
    assert.equal(calendar.verifyCalendarToken(`${id}.${sig.slice(0, -2)}AA`), null);
    assert.equal(calendar.verifyCalendarToken("garbage"), null);
    assert.equal(calendar.verifyCalendarToken(token, { ...process.env, LMS_CALENDAR_FEED_SECRET: "another-secret-0123456789abcdefghij" }), null, "rotating the secret revokes every link");
  });

  test("the feed lists only the student's cohort sessions, with no Zoom link", async () => {
    const amina = student("Amina");
    session("s1", { title: "Week 1, Makkah", startsAt: new Date(Date.now() + 86_400_000) });
    session("s_cancel", { title: "Called off", status: "CANCELLED", startsAt: new Date(Date.now() + 2 * 86_400_000) });
    session("s_past", { title: "Long ago", startsAt: new Date(Date.now() - 3 * 86_400_000) });
    session("s_other", { title: "Other cohort class", cohortId: OTHER, startsAt: new Date(Date.now() + 86_400_000) });

    const response = await get(`${calendar.calendarToken(amina)}.ics`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type") ?? "", /text\/calendar/);
    const ics = await response.text();
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.trimEnd().endsWith("END:VCALENDAR"));
    assert.ok(ics.includes("SUMMARY:Week 1\\, Makkah"), "text is escaped");
    assert.ok(ics.includes("UID:s1@") && ics.includes("UID:s_cancel@"));
    assert.ok(ics.includes("STATUS:CANCELLED"), "a cancelled class stays, marked cancelled");
    assert.ok(!ics.includes("Long ago"), "past classes are left out");
    assert.ok(!ics.includes("Other cohort class"), "another cohort's classes never appear");
    assert.ok(!/zoom\.us|v1\.secret/.test(ics), "no Zoom link or stored secret");
    assert.ok(ics.split("\r\n").every((line) => Buffer.byteLength(line) <= 75), "lines are folded at 75 octets");
  });

  test("bad tokens get 404; a student without access gets an empty calendar; no secret means 503", async () => {
    const unpaid = student("Zaid", { paid: false });
    session("s1", { startsAt: new Date(Date.now() + 86_400_000) });
    assert.equal((await get("nonsense.ics")).status, 404);
    assert.equal((await get(`${calendar.calendarToken(unpaid)}`)).status, 404, "the .ics suffix is required");
    const empty = await get(`${calendar.calendarToken(unpaid)}.ics`);
    assert.equal(empty.status, 200);
    assert.ok(!(await empty.text()).includes("BEGIN:VEVENT"));
    delete process.env.LMS_CALENDAR_FEED_SECRET;
    assert.equal((await get("x.ics")).status, 503);
    assert.equal(calendar.calendarLinks(unpaid), null, "the subscribe control is hidden without the secret");
  });
});
