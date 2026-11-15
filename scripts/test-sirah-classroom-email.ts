/**
 * Classroom email (welcome, class reminder, announcement) against an in-memory
 * Prisma stand-in, with Resend mocked at fetch (no database, no network).
 */
import assert from "node:assert/strict";
import test, { before, beforeEach, afterEach } from "node:test";
import { installFakePrisma, table, tables } from "./fixtures/fake-prisma";

installFakePrisma();

let mail: typeof import("../services/sirah-classroom-email.service");
let SLUG: string;
before(async () => {
  mail = await import("../services/sirah-classroom-email.service");
  SLUG = (await import("../lib/sirah/catalog")).SIRAH_SLUG;
});

const HOUR = 3_600_000;
const now = new Date("2026-11-20T12:00:00.000Z");
const ZOOM = "https://us02web.zoom.us/j/123?pwd=secret";
const originalFetch = global.fetch;
let sent: { to: string; subject: string; html: string; text: string; idempotency: string | null }[] = [];
let reply: () => Response;

const course = () => ({ id: "c1", slug: SLUG });
const paidOrder = (id: string, userId: string, extra: Record<string, unknown> = {}) => ({
  id,
  userId,
  courseId: "c1",
  registrationId: `r-${id}`,
  plan: "ANNUAL",
  method: "STRIPE",
  paymentState: "PAID",
  enrolmentState: "ACTIVE",
  paidCount: 1,
  programmeStart: new Date("2026-09-01T00:00:00Z"),
  programmeEnd: new Date("2027-09-01T00:00:00Z"),
  accessEndsAt: null,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  ...extra,
});
const user = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  email: `${id}@example.test`,
  fullName: `Student ${id.toUpperCase()}`,
  status: "ACTIVE",
  studentProfile: null,
  enrollments: [],
  ...extra,
});

beforeEach(() => {
  tables.clear();
  sent = [];
  reply = () => new Response(JSON.stringify({ id: `re_${sent.length}` }), { status: 200 });
  Object.assign(process.env, { RESEND_API_KEY: "re_test", EMAIL_FROM: "The Global Awakening <noreply@example.test>", NEXT_PUBLIC_APP_URL: "https://tga.example" });
  global.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    sent.push({ to: body.to[0], subject: body.subject, html: body.html, text: body.text, idempotency: (init.headers as Record<string, string>)["Idempotency-Key"] ?? null });
    return reply();
  }) as typeof fetch;

  table("course").push(course());
  table("user").push(
    // Legacy ACTIVE enrolment, profile zone Karachi.
    user("u1", {
      studentProfile: { timezone: "Asia/Karachi" },
      enrollments: [{ status: "ACTIVE", registrationId: "legacy-1", course: course() }],
    }),
    // Paid current order, no zone: UK time.
    user("u2"),
    // Registered but unpaid: not enrolled.
    user("u3"),
    // Paid, but the account is suspended.
    user("u4", { status: "SUSPENDED" }),
  );
  table("enrollment").push({ id: "e1", userId: "u1", courseId: "c1", status: "ACTIVE", registrationId: "legacy-1" });
  table("sirahOrder").push(
    paidOrder("o2", "u2"),
    paidOrder("o3", "u3", { paymentState: "UNPAID", enrolmentState: "PENDING", paidCount: 0 }),
    paidOrder("o4", "u4"),
  );
  table("sirahLesson").push(
    { id: "soon", title: "The Hijrah", summary: "", weekNumber: 5, scheduledAt: new Date(now.getTime() + 3 * HOUR), zoomJoinUrl: ZOOM, zoomMeetingId: "123" },
    { id: "later", title: "Badr", summary: "", weekNumber: 6, scheduledAt: new Date(now.getTime() + 72 * HOUR), zoomJoinUrl: ZOOM, zoomMeetingId: null },
    { id: "past", title: "Makkah", summary: "", weekNumber: 4, scheduledAt: new Date(now.getTime() - 2 * HOUR), zoomJoinUrl: ZOOM, zoomMeetingId: null },
  );
});

afterEach(() => {
  global.fetch = originalFetch;
});

const rows = () => table("sirahClassroomEmail");

test("recipients: exactly the students the classroom gate admits", async () => {
  const students = await mail.listEnrolledStudents(now);
  assert.deepEqual(students.map((s) => s.id).sort(), ["u1", "u2"]);
});

test("reminders: only sessions in the next 24 hours, queued and sent exactly once", async () => {
  assert.equal(await mail.queueReminders(now), 2);
  assert.equal(await mail.queueReminders(now), 0, "a second sweep queues nothing");
  assert.equal(await mail.queueReminders(new Date(now.getTime() + 30 * 60_000)), 0);
  assert.deepEqual(rows().map((r) => r.lessonId), ["soon", "soon"]);

  const first = await mail.dispatchClassroomEmails({ now });
  assert.equal(first.sent, 2);
  const second = await mail.dispatchClassroomEmails({ now: new Date(now.getTime() + HOUR) });
  assert.equal(second.sent, 0, "a sent reminder is never sent again");
  assert.equal(sent.length, 2);
  assert.ok(sent.every((m) => m.idempotency?.startsWith("sirah-classroom-")));
  assert.ok(rows().every((r) => r.state === "SENT" && r.sentAt instanceof Date));
});

test("reminder content: title, the student's own time zone (else UK), the session page, never the Zoom link", async () => {
  await mail.queueReminders(now);
  await mail.dispatchClassroomEmails({ now });
  const karachi = sent.find((m) => m.to === "u1@example.test")!;
  const london = sent.find((m) => m.to === "u2@example.test")!;
  assert.match(karachi.subject, /The Hijrah/);
  assert.match(karachi.text, /8:00 pm \(Pakistan Standard Time\)/);
  assert.match(london.text, /3:00 pm \(Greenwich Mean Time\)/);
  for (const m of [karachi, london]) {
    assert.ok(m.text.includes("https://tga.example/seerah/classroom/soon"));
    assert.ok(m.html.includes("https://tga.example/seerah/classroom/soon"));
    assert.ok(!m.text.includes("zoom.us") && !m.html.includes("zoom.us"), "the Zoom link stays behind the join window");
  }
});

test("a reminder whose session started, or a student who left, is cancelled, not sent", async () => {
  await mail.queueReminders(now);
  table("sirahOrder").find((o) => o.id === "o2")!.enrolmentState = "CANCELLED";
  const result = await mail.dispatchClassroomEmails({ now });
  assert.equal(result.sent, 1);
  assert.equal(rows().find((r) => r.userId === "u2")!.state, "CANCELLED");

  tables.set("sirahClassroomEmail", []);
  await mail.queueReminders(now);
  const late = await mail.dispatchClassroomEmails({ now: new Date(now.getTime() + 4 * HOUR) });
  assert.equal(late.sent, 0);
  assert.ok(rows().every((r) => r.state === "CANCELLED"));
});

test("announcements: emailed once per enrolled student; a quiet post emails no one", async () => {
  table("sirahAnnouncement").push(
    { id: "a1", title: "Reading for week 5", body: "Please read chapter 4.\n\nJazakum Allahu khayran.", pinned: false, emailStudents: true, publishedAt: now },
    { id: "a2", title: "Quiet note", body: "No email.", pinned: false, emailStudents: false, publishedAt: now },
  );
  assert.equal(await mail.queueAnnouncementEmails("a2", now), 0);
  assert.equal(await mail.queueAnnouncementEmails("a1", now), 2);
  assert.equal(await mail.queueAnnouncementEmails("a1", now), 0);
  await mail.dispatchClassroomEmails({ now });
  assert.equal(sent.length, 2);
  assert.ok(sent.every((m) => m.subject.startsWith("Reading for week 5") && m.text.includes("Please read chapter 4.")));
});

test("a removed announcement's unsent emails are cancelled", async () => {
  table("sirahAnnouncement").push({ id: "a1", title: "T", body: "B", pinned: false, emailStudents: true, publishedAt: now });
  await mail.queueAnnouncementEmails("a1", now);
  tables.set("sirahAnnouncement", []);
  await mail.dispatchClassroomEmails({ now });
  assert.equal(sent.length, 0);
  assert.ok(rows().every((r) => r.state === "CANCELLED"));
});

test("welcome: once per student, only after a confirmed enrolment", async () => {
  assert.equal(await mail.queueWelcomeForOrder("o2", now), false, "no CONFIRMED notice yet");
  table("sirahNotification").push({ id: "n1", key: "k1", orderId: "o2", kind: "CONFIRMED", toEmail: "u2@example.test", createdAt: now });
  table("sirahNotification").push({ id: "n3", key: "k3", orderId: "o3", kind: "CONFIRMED", toEmail: "u3@example.test", createdAt: now });
  assert.equal(await mail.queueWelcomeForOrder("o2", now), true);
  assert.equal(await mail.queueWelcomeForOrder("o2", now), false);
  assert.equal(await mail.queueWelcomeForOrder("o3", now), false, "not enrolled (unpaid): no welcome");
  await mail.dispatchClassroomEmails({ now });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "u2@example.test");
  assert.match(sent[0].text, /https:\/\/tga\.example\/seerah\/classroom/);
});

test("a provider rate limit defers the batch; nothing is lost or doubled", async () => {
  await mail.queueReminders(now);
  reply = () => new Response("rate_limit_exceeded", { status: 429, headers: { "retry-after": "60" } });
  const limited = await mail.dispatchClassroomEmails({ now });
  assert.equal(limited.sent, 0);
  assert.equal(sent.length, 1, "the batch stops at the first 429");
  assert.ok(rows().some((r) => r.state === "FAILED"));
  reply = () => new Response(JSON.stringify({ id: "re_ok" }), { status: 200 });
  assert.equal((await mail.dispatchClassroomEmails({ now })).sent, 1, "the untouched row still goes");
  const later = new Date(now.getTime() + 2 * 60_000);
  assert.equal((await mail.dispatchClassroomEmails({ now: later })).sent, 1, "the deferred row goes after its cooldown");
  assert.equal((await mail.dispatchClassroomEmails({ now: new Date(later.getTime() + HOUR) })).sent, 0);
  assert.ok(rows().every((r) => r.state === "SENT"));
});

test("no sender configured: nothing is attempted, rows wait", async () => {
  delete process.env.RESEND_API_KEY;
  await mail.queueReminders(now);
  const result = await mail.dispatchClassroomEmails({ now });
  assert.equal(result.configured, false);
  assert.equal(sent.length, 0);
  assert.ok(rows().every((r) => r.state === "PENDING"));
});
