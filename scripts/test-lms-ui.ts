/**
 * LMS Phase 2b UI: admin live-session management, the student schedule and
 * the teacher portal, rendered to HTML. Run with:
 *   node --experimental-test-module-mocks --import tsx --test scripts/test-lms-ui.ts
 *
 * Mocks only: Zoom fetch is stubbed, the database is the in-memory fake
 * Prisma, and auth is mocked at the module boundary (lib/auth/session and
 * lib/auth/sirah-workspace), so no cookie, request or database is touched.
 * Every rendered page is checked for Zoom URLs, passcodes and ciphertext.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test, { afterEach, before, beforeEach, describe, mock } from "node:test";
import { installFakePrisma, table, tables } from "./fixtures/fake-prisma";

installFakePrisma();

// CSS is a build-time import too: a CSS module maps each class to its own name,
// a plain stylesheet is empty.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("node:module") as { _extensions: Record<string, (m: { exports: unknown }, filename: string) => void> };
Module._extensions[".css"] = (m, filename) => {
  m.exports = filename.endsWith(".module.css") ? new Proxy({}, { get: (_, key) => (key === "__esModule" ? false : String(key)) }) : {};
};

const file =(relative: string) => pathToFileURL(path.resolve(__dirname, relative)).href;

// ── Module mocks (before anything imports them) ────────────────────────────

type Identity = { id: string; fullName: string; email: string; role: string; status: string } | null;
type Access = { role: "SUPER_ADMIN" | "MANAGER" | "COMMUNITY_LEAD" } | null;
let identity: Identity = null;
let access: Access = null;
let scheduledNotifications = 0;
mock.module(file("../lib/lms/notify-later.ts"), {
  namedExports: { notifyLater: () => { scheduledNotifications += 1; } },
});
const currentUser = () => {
  if (!identity) return null;
  const enrollments = table("enrollment")
    .filter((e) => e.userId === identity!.id)
    .map((e) => ({ ...e, course: table("course").find((c) => c.id === e.courseId) }));
  const studentProfile = table("studentProfile").find((p) => p.userId === identity!.id) ?? null;
  return { ...identity, enrollments, registrations: [], subscriptions: [], studentProfile };
};

mock.module("server-only", { namedExports: {} });
// next/font is a build-time transform; outside Next it is a stub that returns class names.
const font = () => ({ className: "font", variable: "font-var", style: { fontFamily: "serif" } });
mock.module("next/font/google", { namedExports: { Fraunces: font, Sora: font } });
mock.module("next/font/local", { defaultExport: font });
mock.module("next/cache", { namedExports: { revalidatePath: () => {}, revalidateTag: () => {} } });
mock.module(file("../lib/auth/session.ts"), {
  namedExports: {
    getSessionIdentity: async () => identity,
    getCurrentUser: async () => currentUser(),
    createSession: async () => "token",
    attachSessionCookie: async () => {},
    clearSessionCookie: async () => {},
  },
});
mock.module(file("../lib/auth/admin-session.ts"), { namedExports: { getCurrentAdmin: async () => access?.role === "SUPER_ADMIN" ? { email: "admin@example.test" } : null } });
mock.module(file("../lib/auth/sirah-workspace.ts"), {
  namedExports: {
    getSirahWorkspaceAccess: async () =>
      access && { ...access, readOnly: access.role !== "SUPER_ADMIN", canManageEnrolments: access.role !== "COMMUNITY_LEAD" },
    SIRAH_ROLE_LABELS: { SUPER_ADMIN: "Super Admin", MANAGER: "Manager", COMMUNITY_LEAD: "Community Lead" },
  },
});

const FAKE_ENV = {
  ZOOM_ACCOUNT_ID: "acct_test",
  ZOOM_CLIENT_ID: "client_test",
  ZOOM_CLIENT_SECRET: "secret_test",
  ZOOM_DEFAULT_HOST_USER_ID: "host@example.test",
  ZOOM_WEBHOOK_SECRET_TOKEN: "whsec_test",
  LMS_FIELD_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  // Placeholder Bunny values; Bunny's API is answered by the fetch mock below.
  BUNNY_STREAM_LIBRARY_ID: "12345",
  BUNNY_STREAM_TOKEN_AUTH_KEY: "test-only-token-key",
  BUNNY_STREAM_API_KEY: "test-only-api-key",
};
/** The one video that exists in the fake Bunny library (and that the fake creates). */
const BUNNY_GUID = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
Object.assign(process.env, FAKE_ENV);

let React: typeof import("react");
let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
let AppRouterContext: React.Context<unknown>;
let crypto: typeof import("../lib/lms/field-crypto");
let token: typeof import("../lib/zoom/token");
let schedule: typeof import("../lib/lms/schedule");
let actions: typeof import("../app/admin/sirah/(workspace)/classroom/live/actions");
let AdminPage: typeof import("../app/admin/sirah/(workspace)/classroom/live/page").default;
let SchedulePage: typeof import("../app/seerah/classroom/schedule/page").default;
let ClassroomPage: typeof import("../app/seerah/classroom/page").default;
let TeachingPage: typeof import("../app/seerah/classroom/teaching/page").default;
let RecordingLibrary: typeof import("../components/indigo/classroom/recording-library").RecordingLibrary;
let taskActions: typeof import("../app/admin/sirah/(workspace)/classroom/tasks/actions");
let TaskBody: typeof import("../components/sirah/tasks/task-body").TaskBody;
let SIRAH_BATCH: string;
let SIRAH_SLUG: string;
before(async () => {
  React = await import("react");
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ AppRouterContext } = (await import("next/dist/shared/lib/app-router-context.shared-runtime")) as unknown as {
    AppRouterContext: React.Context<unknown>;
  });
  crypto = await import("../lib/lms/field-crypto");
  token = await import("../lib/zoom/token");
  schedule = await import("../lib/lms/schedule");
  actions = await import("../app/admin/sirah/(workspace)/classroom/live/actions");
  AdminPage = (await import("../app/admin/sirah/(workspace)/classroom/live/page")).default;
  SchedulePage = (await import("../app/seerah/classroom/schedule/page")).default;
  ClassroomPage = (await import("../app/seerah/classroom/page")).default;
  TeachingPage = (await import("../app/seerah/classroom/teaching/page")).default;
  ({ RecordingLibrary } = await import("../components/indigo/classroom/recording-library"));
  taskActions = await import("../app/admin/sirah/(workspace)/classroom/tasks/actions");
  ({ TaskBody } = await import("../components/sirah/tasks/task-body"));
  ({ SIRAH_BATCH, SIRAH_SLUG } = await import("../lib/sirah/catalog"));
});

// ── Rendering ──────────────────────────────────────────────────────────────

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
/** Server page -> HTML. Pages are async; everything below them is synchronous. */
async function render(page: Promise<React.ReactNode> | React.ReactNode) {
  const tree = await page;
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: router }, tree as React.ReactElement));
}
/** Run a server action or page; return the redirect/notFound it raised, if any. */
async function outcome(run: () => Promise<unknown>): Promise<{ redirect?: string; notFound?: boolean; value?: unknown }> {
  try {
    return { value: await run() };
  } catch (error) {
    const digest = String((error as { digest?: string }).digest ?? "");
    if (digest.startsWith("NEXT_REDIRECT")) return { redirect: digest.split(";")[2] };
    if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404")) return { notFound: true };
    throw error;
  }
}
const query = (url: string) => Object.fromEntries(new URL(url, "http://x").searchParams);

const SECRET_JOIN = "https://us02web.zoom.us/j/9000001?pwd=SECRETPWD";
function assertNoZoomSecrets(html: string) {
  assert.ok(!/zoom\.us/i.test(html), "no Zoom URL in the page");
  assert.ok(!html.includes("SECRETPWD") && !html.includes("4815162342"), "no passcode in the page");
  assert.ok(!/\bv1\.[A-Za-z0-9_-]{8,}\./.test(html), "no ciphertext in the page");
  assert.ok(!/zak=|start_url|join_url/i.test(html), "no host or join links in the page");
}

// ── Zoom fetch mock ────────────────────────────────────────────────────────

type Call = { method: string; url: string; body: Record<string, unknown> | null };
let calls: Call[] = [];
let meetingSeq = 0;
const originalFetch = global.fetch;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const apiCalls = () => calls.filter((c) => !c.url.startsWith("https://zoom.us/oauth"));

beforeEach(() => {
  tables.clear();
  scheduledNotifications = 0;
  calls = [];
  meetingSeq = 0;
  identity = null;
  access = null;
  Object.assign(process.env, FAKE_ENV);
  token.clearZoomTokenCache();
  global.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const call = { method: (init.method || "GET").toUpperCase(), url: String(input), body: typeof init.body === "string" ? JSON.parse(init.body) : null };
    calls.push(call);
    if (call.url.startsWith("https://zoom.us/oauth")) return json({ access_token: "tok", expires_in: 3600, scope: "" });
    if (call.url.startsWith("https://video.bunnycdn.com/library/12345/videos")) {
      if (call.method === "POST") return json({ guid: BUNNY_GUID });
      return call.url.endsWith(`/${BUNNY_GUID}`) ? json({ guid: BUNNY_GUID }) : json({}, 404);
    }
    if (call.method === "POST") {
      meetingSeq += 1;
      return json({ id: 9_000_000 + meetingSeq, uuid: `u${meetingSeq}`, join_url: SECRET_JOIN, start_url: "https://zoom.us/s/1?zak=x", password: call.body?.password }, 201);
    }
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  table("course").push({ id: "course_sirah", slug: SIRAH_SLUG });
  table("sirahCohort").push({ batchCode: SIRAH_BATCH }, { batchCode: "other-cohort" });
  table("zoomHost").push({ id: "host_1", zoomUserId: "zu1", email: "teacher@example.test", licensed: true, active: true });
});
afterEach(() => {
  global.fetch = originalFetch;
});

// ── Fixtures ───────────────────────────────────────────────────────────────

const MIN = 60_000;
let seq = 0;
function seedUser(email: string, role = "STUDENT") {
  seq += 1;
  const user = { id: `user_${seq}`, fullName: `User ${seq}`, email, role, status: "ACTIVE" };
  table("user").push(user);
  return user;
}
function seedPaidOrder(userId: string, batchCode = SIRAH_BATCH) {
  table("sirahOrder").push({
    id: `order_${userId}`, userId, courseId: "course_sirah", batchCode, plan: "ANNUAL", method: "STRIPE",
    paymentState: "PAID", enrolmentState: "ACTIVE", paidCount: 1, registrationId: null, archivedAt: null,
    accessEndsAt: null, programmeStart: null, programmeEnd: null, cycleBillingDay: null, cycleGraceDay: null,
    cycleFirstDueAt: null, createdAt: new Date(),
  });
}
function seedSession(startsAt: Date, overrides: Record<string, unknown> = {}) {
  const id = `sess_${table("lmsSession").length + 1}`;
  const row = {
    id, cohortId: SIRAH_BATCH, title: `Class ${id}`, startsAt, durationMin: 90, status: "SCHEDULED", zoomHostId: "host_1",
    zoomMeetingId: "9000001", zoomMeetingUuid: "u", zoomStartedAt: null, zoomEndedAt: null,
    joinUrlEncrypted: crypto.encryptField(SECRET_JOIN, crypto.sessionFieldContext(id, "joinUrl")),
    passcodeEncrypted: crypto.encryptField("4815162342", crypto.sessionFieldContext(id, "passcode")),
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  table("lmsSession").push(row);
  return row;
}
const signIn = (user: { id: string; fullName: string; email: string; role: string; status: string }) => (identity = user);

// ── Admin ──────────────────────────────────────────────────────────────────

describe("admin live sessions", () => {
  const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [k, v] of Object.entries(fields)) data.set(k, v);
    return data;
  };
  const future = (days: number) => {
    const d = new Date(Date.now() + days * 86_400_000);
    return d.toISOString().slice(0, 10);
  };

  test("lists upcoming and past sessions with status, host, time and join counts; never the Zoom link", async () => {
    access = { role: "SUPER_ADMIN" };
    const up = seedSession(new Date(Date.now() + 2 * 86_400_000), { title: "Week 3: Hijrah" });
    const past = seedSession(new Date(Date.now() - 3 * 86_400_000), { title: "Week 1: Makkah" });
    seedSession(new Date(Date.now() + 4 * 86_400_000), { title: "Other cohort class", cohortId: "other-cohort" });
    table("sessionJoinIntent").push(
      { id: "j1", sessionId: past.id, userId: "a", at: new Date() },
      { id: "j2", sessionId: past.id, userId: "a", at: new Date() },
      { id: "j3", sessionId: past.id, userId: "b", at: new Date() },
    );
    const html = await render(AdminPage({ searchParams: Promise.resolve({}) }));
    assert.match(html, /Week 3: Hijrah/);
    assert.match(html, /Week 1: Makkah/);
    assert.ok(!html.includes("Other cohort class"), "only the selected cohort");
    assert.match(html, /2 students joined \(3 joins\)/);
    assert.match(html, /No joins yet/);
    assert.match(html, /teacher@example\.test/);
    assert.match(html, /Scheduled/);
    assert.match(html, /No Zoom start recorded/, "a past slot Zoom never started is flagged, not assumed to have happened");
    assert.match(html, /Meeting 9000001/);
    assert.match(html, /waiting room on/);
    assert.ok(html.includes(`/api/sirah/lms/sessions/${up.id}/start`), "super admin gets Start as host");
    assertNoZoomSecrets(html);

    const other = await render(AdminPage({ searchParams: Promise.resolve({ cohort: "other-cohort" }) }));
    assert.match(other, /Other cohort class/);
    assert.ok(!other.includes("Week 3: Hijrah"));
  });

  test("managers may manage sessions but get no Start link; community leads are sent away", async () => {
    seedSession(new Date(Date.now() + 2 * 86_400_000));
    access = { role: "MANAGER" };
    const html = await render(AdminPage({ searchParams: Promise.resolve({}) }));
    assert.match(html, /Schedule session/);
    assert.ok(!html.includes("/start"), "start route admits only the super admin or the host");
    access = { role: "COMMUNITY_LEAD" };
    assert.equal((await outcome(() => AdminPage({ searchParams: Promise.resolve({}) }))).redirect, "/admin/sirah");
    access = null;
    assert.equal((await outcome(() => AdminPage({ searchParams: Promise.resolve({}) }))).redirect, "/admin/sirah/login");
  });

  test("create, edit and cancel go through the Phase 2a service and Zoom", async () => {
    access = { role: "MANAGER" };
    const created = await outcome(() =>
      actions.createLiveSession(
        form({ cohortId: SIRAH_BATCH, title: "Week 4", startsLocal: `${future(5)}T19:00`, timeZone: "Europe/London", durationMin: "90", hostId: "host_1" }),
      ),
    );
    assert.match(query(created.redirect!).notice, /Session scheduled/);
    assert.equal(apiCalls()[0].method, "POST");
    const row = table("lmsSession")[0];
    assert.equal(row.title, "Week 4");
    assert.equal(row.zoomMeetingId, "9000001");

    calls = [];
    const edited = await outcome(() =>
      actions.updateLiveSession(
        form({ id: String(row.id), cohortId: SIRAH_BATCH, title: "Week 4 (moved)", startsLocal: `${future(6)}T20:00`, timeZone: "Europe/London", durationMin: "60" }),
      ),
    );
    assert.match(query(edited.redirect!).notice, /Session saved/);
    assert.equal(apiCalls()[0].method, "PATCH");
    assert.equal(row.title, "Week 4 (moved)");
    assert.equal(row.durationMin, 60);

    calls = [];
    const cancelled = await outcome(() => actions.cancelLiveSession(form({ id: String(row.id), cohortId: SIRAH_BATCH })));
    assert.match(query(cancelled.redirect!).notice, /Session cancelled/);
    assert.equal(apiCalls()[0].method, "DELETE");
    assert.equal(row.status, "CANCELLED");
  });

  test("new-session notification checkbox controls the creation announcement", async () => {
    access = { role: "MANAGER" };
    const html = await render(AdminPage({ searchParams: Promise.resolve({}) }));
    assert.match(html, /name="notifyStudents"[^>]*checked/);
    const fields = { cohortId: SIRAH_BATCH, title: "Class", timeZone: "UTC", durationMin: "60", hostId: "host_1" };
    await outcome(() => actions.createLiveSession(form({ ...fields, startsLocal: `${future(5)}T19:00`, notifyStudents: "on" })));
    assert.equal(scheduledNotifications, 1);
    await outcome(() => actions.createLiveSession(form({ ...fields, startsLocal: `${future(6)}T19:00` })));
    assert.equal(scheduledNotifications, 1);
    assert.equal(table("lmsSession").length, 2);
  });

  test("external recording links are scoped, validated and published explicitly", async () => {
    access = { role: "MANAGER" };
    const past = seedSession(new Date(Date.now() - 3 * 86_400_000));
    const upcoming = seedSession(new Date(Date.now() + 3 * 86_400_000));
    const fields = { sessionId: String(past.id), cohortId: SIRAH_BATCH, title: "Class recording", url: "https://youtu.be/example" };
    await outcome(() => actions.saveExternalRecording(form({ ...fields, sessionId: String(upcoming.id) })));
    await outcome(() => actions.saveExternalRecording(form({ ...fields, url: "javascript:alert(1)" })));
    assert.equal(table("lmsResource").length, 0);
    await outcome(() => actions.saveExternalRecording(form(fields)));
    const recording = table("lmsResource")[0];
    assert.equal(recording.visibility, "HIDDEN");
    assert.equal(recording.title, "Class recording");
    await outcome(() => actions.changeExternalRecordingVisibility(form({ sessionId: String(past.id), cohortId: SIRAH_BATCH, resourceId: String(recording.id), publish: "1" })));
    assert.equal(recording.visibility, "PUBLISHED");
    await outcome(() => actions.changeExternalRecordingVisibility(form({ sessionId: String(past.id), cohortId: SIRAH_BATCH, resourceId: String(recording.id), publish: "0" })));
    assert.equal(recording.visibility, "HIDDEN");
  });

  test("standalone recordings can be created, edited, unpublished and deleted without Zoom", async () => {
    access = { role: "MANAGER" };
    const fields = { title: "Orientation", url: "https://youtu.be/example", description: "Welcome", publish: "on" };
    await outcome(() => actions.saveStandaloneRecordingAction(form(fields)));
    const item = table("lmsResource")[0];
    assert.equal(item.title, "Orientation");
    assert.equal(item.originalFilename, "Welcome");
    assert.equal(item.sessionId, null);
    assert.equal(item.cohortId, null);
    assert.equal(item.visibility, "PUBLISHED");
    assert.equal(apiCalls().length, 0);
    await outcome(() => actions.saveStandaloneRecordingAction(form({ ...fields, id: String(item.id), title: "Class 1", publish: "" })));
    assert.equal(item.title, "Class 1");
    assert.equal(item.visibility, "HIDDEN");
    await outcome(() => actions.deleteStandaloneRecordingAction(form({ id: String(item.id) })));
    assert.equal(table("lmsResource").length, 0);
  });

  test("a Bunny recording stores only its video ID, and the form offers protected and public sources", async () => {
    access = { role: "MANAGER" };
    const html = await render(AdminPage({ searchParams: Promise.resolve({}) }));
    assert.match(html, /Bunny video \(protected\)/);
    assert.match(html, /Public link \(shareable\)/);
    assert.match(html, /<input type="radio" name="source" checked="" value="bunny"\/>/);
    const guid = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
    await outcome(() => actions.saveStandaloneRecordingAction(form({ title: "Class 2", source: "bunny", bunnyVideoId: `https://iframe.mediadelivery.net/embed/12345/${guid}`, url: "", publish: "on" })));
    const item = table("lmsResource")[0];
    assert.equal(item.bunnyVideoId, guid);
    assert.equal(item.url, null);
    await outcome(() => actions.saveStandaloneRecordingAction(form({ id: String(item.id), title: "Class 2", source: "link", url: "https://youtu.be/example", bunnyVideoId: "", publish: "on" })));
    assert.equal(item.bunnyVideoId, null);
    assert.equal(item.url, "https://youtu.be/example");
    const refused = await outcome(() => actions.saveStandaloneRecordingAction(form({ title: "Bad", source: "bunny", bunnyVideoId: "not-an-id", url: "" })));
    assert.match(decodeURIComponent(String(refused.redirect).replace(/\+/g, " ")), /not a Bunny video ID/);
    assert.equal(table("lmsResource").length, 1);
    const unknown = await outcome(() => actions.saveStandaloneRecordingAction(form({ title: "Typo", source: "bunny", bunnyVideoId: "ffffffff-5e6f-4a8b-9c0d-1e2f3a4b5c6d", url: "" })));
    assert.match(decodeURIComponent(String(unknown.redirect).replace(/\+/g, " ")), /No video with that ID is in the Bunny library/);
    assert.equal(table("lmsResource").length, 1);
  });

  test("direct upload: the server creates the Bunny video and returns a TUS authorization for it only, never the API key", async () => {
    access = { role: "MANAGER" };
    const html = await render(AdminPage({ searchParams: Promise.resolve({}) }));
    assert.match(html, /Upload a video file/);
    assert.ok(!html.includes("test-only-api-key") && !html.includes("test-only-token-key"), "no Bunny key in the admin page");
    const started = await actions.startBunnyUpload("Class 3");
    assert.ok(started.ok);
    const { ticket } = started as Extract<typeof started, { ok: true }>;
    assert.equal(ticket.videoId, BUNNY_GUID);
    assert.equal(ticket.libraryId, "12345");
    assert.equal(ticket.endpoint, "https://video.bunnycdn.com/tusupload");
    assert.equal(ticket.signature, createHash("sha256").update(`12345test-only-api-key${ticket.expires}${BUNNY_GUID}`).digest("hex"));
    assert.ok(ticket.expires > Date.now() / 1000 && ticket.expires <= Date.now() / 1000 + 12 * 3600 + 5);
    assert.ok(!JSON.stringify(started).includes("test-only-api-key"), "the API key never leaves the server");
    const create = calls.find((call) => call.method === "POST" && call.url === "https://video.bunnycdn.com/library/12345/videos");
    assert.deepEqual(create?.body, { title: "Class 3" });
    access = { role: "COMMUNITY_LEAD" };
    assert.equal((await outcome(() => actions.startBunnyUpload("x"))).redirect, "/admin/sirah");
    access = null;
    assert.equal((await outcome(() => actions.startBunnyUpload("x"))).redirect, "/admin/sirah/login");
    delete process.env.BUNNY_STREAM_API_KEY;
    access = { role: "MANAGER" };
    const unconfigured = await actions.startBunnyUpload("x");
    assert.equal(unconfigured.ok, false);
    assert.doesNotMatch(await render(AdminPage({ searchParams: Promise.resolve({}) })), /Upload a video file/);
  });

  test("session-linked recordings accept Bunny, convert from a public link, and preview for staff only", async () => {
    access = { role: "MANAGER" };
    const past = seedSession(new Date(Date.now() - 2 * 86_400_000));
    const base = { sessionId: past.id, cohortId: past.cohortId };
    await outcome(() => actions.saveExternalRecording(form({ ...base, title: "Linked", source: "bunny", bunnyVideoId: BUNNY_GUID, url: "", publish: "on" })));
    const linked = table("lmsResource")[0];
    assert.equal(linked.bunnyVideoId, BUNNY_GUID);
    assert.equal(linked.url, null);
    assert.equal(linked.visibility, "PUBLISHED");
    await outcome(() => actions.saveExternalRecording(form({ ...base, title: "Old link", url: "https://youtu.be/old" })));
    const old = table("lmsResource")[1];
    assert.equal(old.bunnyVideoId ?? null, null);
    assert.equal(old.visibility, "HIDDEN");
    await outcome(() => actions.updateExternalRecordingAction(form({ ...base, resourceId: String(old.id), title: "Converted", source: "bunny", bunnyVideoId: BUNNY_GUID, url: "" })));
    assert.equal(old.title, "Converted");
    assert.equal(old.bunnyVideoId, BUNNY_GUID);
    assert.equal(old.url, null);
    assert.equal(old.visibility, "HIDDEN", "editing the source does not change visibility");
    const html = await render(AdminPage({ searchParams: Promise.resolve({ cohort: past.cohortId }) }));
    assert.match(html, /Bunny \(protected\)/);
    assert.match(html, /Preview video/);
    assert.ok(!html.includes("iframe.mediadelivery.net") && !html.includes("token="), "no signed URL until a preview is requested");
    const preview = await actions.adminBunnyPreview(String(old.id));
    assert.ok(preview.ok && preview.src.startsWith(`https://iframe.mediadelivery.net/embed/12345/${BUNNY_GUID}?token=`), "hidden recordings can be previewed by staff");
    assert.equal((await actions.adminBunnyPreview("missing")).ok, false);
    access = { role: "COMMUNITY_LEAD" };
    assert.equal((await outcome(() => actions.adminBunnyPreview(String(old.id)))).redirect, "/admin/sirah");
    access = null;
    assert.equal((await outcome(() => actions.adminBunnyPreview(String(old.id)))).redirect, "/admin/sirah/login");
  });

  test("the overlap guard's refusal is shown clearly on the page", async () => {
    access = { role: "SUPER_ADMIN" };
    const day = future(5);
    await outcome(() =>
      actions.createLiveSession(form({ cohortId: SIRAH_BATCH, title: "First", startsLocal: `${day}T19:00`, timeZone: "UTC", durationMin: "90", hostId: "host_1" })),
    );
    const clash = await outcome(() =>
      actions.createLiveSession(form({ cohortId: SIRAH_BATCH, title: "Clash", startsLocal: `${day}T20:00`, timeZone: "UTC", durationMin: "60", hostId: "host_1" })),
    );
    const error = query(clash.redirect!).error;
    assert.match(error, /already has "First"/);
    assert.match(error, /cannot run two classes at once/);
    assert.equal(table("lmsSession").length, 1);
    const html = await render(AdminPage({ searchParams: Promise.resolve({ error }) }));
    assert.match(html, /role="alert"[^>]*>[^<]*already has &quot;First&quot;/);
  });

  test("only the super admin can delete the selected session", async () => {
    const target = seedSession(new Date(Date.now() - 2 * 86_400_000));
    const other = seedSession(new Date(Date.now() - 3 * 86_400_000));
    access = { role: "MANAGER" };
    assert.equal((await outcome(() => actions.deleteLiveSession(form({ id: String(target.id), cohortId: SIRAH_BATCH })))).redirect, "/admin/sirah");
    assert.equal(table("lmsSession").length, 2);
    access = { role: "SUPER_ADMIN" };
    await outcome(() => actions.deleteLiveSession(form({ id: String(target.id), cohortId: "other-cohort" })));
    assert.equal(table("lmsSession").length, 2);
    await outcome(() => actions.deleteLiveSession(form({ id: String(target.id), cohortId: SIRAH_BATCH })));
    assert.deepEqual(table("lmsSession").map((item) => item.id), [other.id]);
  });

  test("community leads cannot run the actions", async () => {
    access = { role: "COMMUNITY_LEAD" };
    const result = await outcome(() =>
      actions.createLiveSession(form({ cohortId: SIRAH_BATCH, title: "x", startsLocal: `${future(5)}T19:00`, timeZone: "UTC", durationMin: "90", hostId: "host_1" })),
    );
    assert.equal(result.redirect, "/admin/sirah");
    assert.equal(table("lmsSession").length, 0);
    assert.equal(apiCalls().length, 0);
  });

  test("session detail shows webhook-driven live state and attendance, matched and unmatched", async () => {
    access = { role: "SUPER_ADMIN" };
    const startedAt = new Date(Date.now() - 50 * MIN);
    const live = seedSession(new Date(Date.now() - 55 * MIN), { title: "Live class", status: "LIVE", zoomStartedAt: startedAt });
    const done = seedSession(new Date(Date.now() - 3 * 86_400_000), {
      title: "Finished class",
      status: "ENDED",
      zoomStartedAt: new Date(Date.now() - 3 * 86_400_000),
      zoomEndedAt: new Date(Date.now() - 3 * 86_400_000 + 60 * MIN),
    });
    seedSession(new Date(Date.now() - 20 * MIN), { title: "Never started" });
    const amina = seedUser("amina@example.test");
    table("attendance").push({ id: "att1", sessionId: done.id, userId: amina.id, status: "PRESENT", joinedMinutes: 58, firstJoinedAt: done.startsAt, lastLeftAt: done.startsAt });
    table("attendanceInterval").push(
      { id: "i1", sessionId: done.id, userId: amina.id, zoomParticipantId: "a", email: "amina@example.test", name: "Amina", joinedAt: new Date(Number(done.startsAt) + 60_000), leftAt: new Date(Number(done.startsAt) + 59 * 60_000), matchMethod: "EMAIL" },
      { id: "i2", sessionId: done.id, userId: null, zoomParticipantId: "g", email: null, name: "Visitor Phone", joinedAt: new Date(Number(done.startsAt) + 5 * 60_000), leftAt: new Date(Number(done.startsAt) + 15 * 60_000), matchMethod: "NONE" },
      { id: "i3", sessionId: done.id, userId: null, zoomParticipantId: "h", email: "teacher@example.test", name: "Ustadh", joinedAt: done.startsAt as Date, leftAt: new Date(Number(done.startsAt) + 60 * 60_000), matchMethod: "NONE" },
    );
    const html = await render(AdminPage({ searchParams: Promise.resolve({}) }));
    assert.match(html, /Live now/);
    assert.match(html, /Not started on Zoom/, "the clock alone no longer says live");
    assert.match(html, /Ended/);
    assert.match(html, /\(from Zoom\)/);
    assert.match(html, /Present/);
    assert.match(html, /58 min/);
    assert.match(html, /matched by email/);
    assert.match(html, /Not matched to a student/);
    assert.match(html, /Visitor Phone · 10 min/);
    assert.match(html, />Host</);
    assert.ok(html.includes(live.title));
    assertNoZoomSecrets(html);
  });

  test("an invalid date is refused before Zoom is called", async () => {
    access = { role: "SUPER_ADMIN" };
    const result = await outcome(() =>
      actions.createLiveSession(form({ cohortId: SIRAH_BATCH, title: "x", startsLocal: "nope", timeZone: "UTC", durationMin: "90", hostId: "host_1" })),
    );
    assert.match(query(result.redirect!).error, /valid date and time/);
    assert.equal(apiCalls().length, 0);
  });
});

// ── Student ────────────────────────────────────────────────────────────────

describe("student schedule", () => {
  test("task instructions render paragraphs, numbered questions, emphasis and Arabic without interpreting HTML", async () => {
    const html = await render(React.createElement(TaskBody, { body: "Research the life of the Prophet ﷺ\n1. First question\n2. **Second** question\n\nA second paragraph.\n<script>alert(1)</script>" }));
    assert.match(html, /<ol start="1"><li>First question<\/li><li><strong>Second<\/strong> question<\/li><\/ol>/);
    assert.match(html, /ﷺ/);
    assert.match(html, /A second paragraph/);
    assert.ok(!html.includes("<script>"));
    assert.match(html, /&lt;script&gt;/);
  });
  test("community leads and signed-out visitors cannot create or edit tasks", async () => {
    const form = new FormData();
    access = { role: "COMMUNITY_LEAD" };
    assert.equal((await outcome(() => taskActions.createTask(form))).redirect, "/admin/sirah");
    assert.equal((await outcome(() => taskActions.updateTask(form))).redirect, "/admin/sirah");
    assert.equal((await outcome(() => taskActions.publishTask(form))).redirect, "/admin/sirah");
    access = null;
    assert.equal((await outcome(() => taskActions.createTask(form))).redirect, "/admin/sirah/login");
  });
  test("a leftover super-admin cookie does not expose task submissions to a different signed-in student", async () => {
    access = { role: "SUPER_ADMIN" };
    signIn(seedUser("student@example.test"));
    const form = new FormData();
    assert.equal((await outcome(() => taskActions.createTask(form))).redirect, "/admin/sirah");
    assert.equal((await outcome(() => taskActions.updateTask(form))).redirect, "/admin/sirah");
  });
  test("a manager can create, edit, publish and unpublish a session task", async () => {
    access = { role: "MANAGER" };
    const session = seedSession(new Date(Date.now() - 86_400_000));
    const form = new FormData();
    form.set("target", `session:${session.id}`);
    form.set("title", "Research task");
    form.set("body", "1. First question\n2. The Prophet ﷺ");
    await outcome(() => taskActions.createTask(form));
    const task = table("lmsTask")[0];
    assert.equal(task.sessionId, session.id);
    assert.equal(task.body, "1. First question\n2. The Prophet ﷺ");
    assert.ok(!task.publishedAt);
    const edit = new FormData();
    edit.set("id", String(task.id)); edit.set("title", "Revised task"); edit.set("body", "Revised instructions");
    await outcome(() => taskActions.updateTask(edit));
    assert.equal(task.title, "Revised task");
    const publish = new FormData(); publish.set("id", String(task.id)); publish.set("publish", "1");
    await outcome(() => taskActions.publishTask(publish));
    assert.ok(task.publishedAt instanceof Date);
    publish.set("publish", "0");
    await outcome(() => taskActions.publishTask(publish));
    assert.equal(task.publishedAt, null);
  });
  test("recording thumbnails use YouTube images and branded title cards for other sources", async () => {
    const html = await render(React.createElement(RecordingLibrary, { items: [
      { id: "youtube", title: "YouTube class", href: "https://youtu.be/abcdefghijk", external: true },
      { id: "drive", title: "Drive class", href: "https://drive.google.com/file/d/file123/view", external: true },
      { id: "zoom", title: "Recorded class", href: "/seerah/classroom/recordings/1", external: false },
    ] }));
    assert.match(html, /https:\/\/i\.ytimg\.com\/vi\/abcdefghijk\/hqdefault\.jpg/);
    assert.equal((html.match(/class="fallbackTitle"/g) || []).length, 2);
    assert.match(html, /class="fallbackTitle">Drive class/);
    assert.match(html, /class="fallbackTitle">Recorded class/);
  });
  test("next class has a live countdown and a dormant Join before the window; no Zoom link anywhere", async () => {
    const student = signIn(seedUser("student@example.test"));
    seedPaidOrder(student.id);
    const next = seedSession(new Date(Date.now() + 3 * 60 * MIN), { title: "Week 2: Abyssinia" });
    seedSession(new Date(Date.now() - 2 * 86_400_000), { title: "Week 1: Makkah" });
    seedSession(new Date(Date.now() + 3 * 86_400_000), { title: "Other cohort", cohortId: "other-cohort" });
    const html = await render(SchedulePage());
    assert.match(html, /Week 2: Abyssinia/);
    assert.match(html, /Week 1: Makkah/);
    assert.ok(!html.includes("Other cohort"), "only the student's cohort");
    assert.match(html, /role="timer"/);
    assert.match(html, /Begins in/);
    assert.match(html, /Join opens 15 min before/);
    assert.match(html, /aria-disabled="true"/);
    assert.ok(!html.includes(`/api/sirah/lms/sessions/${next.id}/join`), "no join link before the window");
    assert.match(html, /recording coming later/);
    assertNoZoomSecrets(html);
  });

  test("inside the window the Join control links to the gated join route only", async () => {
    const student = signIn(seedUser("student@example.test"));
    seedPaidOrder(student.id);
    const soon = seedSession(new Date(Date.now() + 10 * MIN));
    const html = await render(SchedulePage());
    assert.ok(html.includes(`href="/api/sirah/lms/sessions/${soon.id}/join"`));
    assert.match(html, /Join the class/);
    assertNoZoomSecrets(html);

    const live = seedSession(new Date(Date.now() - 20 * MIN), { title: "Running" });
    const liveHtml = await render(SchedulePage());
    assert.ok(liveHtml.includes(`/api/sirah/lms/sessions/${live.id}/join`));
    assert.match(liveHtml, /Live now/);
  });

  test("cancelled classes show as cancelled and never get a Join link", async () => {
    const student = signIn(seedUser("student@example.test"));
    seedPaidOrder(student.id);
    const cancelled = seedSession(new Date(Date.now() + 5 * MIN), { status: "CANCELLED", title: "Called off" });
    const html = await render(SchedulePage());
    assert.match(html, /Called off/);
    assert.match(html, /Cancelled/);
    assert.ok(!html.includes(`/api/sirah/lms/sessions/${cancelled.id}/join`));
  });

  test("past classes show only published external recordings for the enrolled cohort", async () => {
    const student = signIn(seedUser("student@example.test"));
    seedPaidOrder(student.id);
    const past = seedSession(new Date(Date.now() - 2 * 86_400_000));
    const other = seedSession(new Date(Date.now() - 2 * 86_400_000), { cohortId: "other-cohort" });
    const base = { kind: "LINK", contentType: "video/x-external-recording", createdAt: new Date(), publishedAt: new Date(), cohortId: null, bunnyVideoId: null };
    table("lmsResource").push(
      { ...base, id: "visible", sessionId: past.id, title: "Visible recording", url: "https://youtu.be/visible", visibility: "PUBLISHED" },
      { ...base, id: "hidden", sessionId: past.id, title: "Hidden recording", url: "https://youtu.be/hidden", visibility: "HIDDEN" },
      { ...base, id: "other", sessionId: other.id, title: "Other recording", url: "https://youtu.be/other", visibility: "PUBLISHED" },
    );
    const html = await render(SchedulePage());
    assert.match(html, /Visible recording/);
    assert.match(html, /https:\/\/youtu\.be\/visible/);
    assert.ok(!html.includes("Hidden recording") && !html.includes("Other recording"));
    signIn(seedUser("unpaid@example.test"));
    assert.ok(!(await render(SchedulePage())).includes("https://youtu.be/visible"));
  });

  test("standalone recordings are visible to enrolled students in any cohort only when published", async () => {
    access = { role: "MANAGER" };
    const input = new FormData();
    for (const [key, value] of Object.entries({ title: "Orientation", url: "https://youtu.be/orientation", description: "Welcome", publish: "on" })) input.set(key, value);
    await outcome(() => actions.saveStandaloneRecordingAction(input));
    const item = table("lmsResource")[0];
    for (const cohort of [SIRAH_BATCH, "other-cohort"]) {
      const student = signIn(seedUser(`${cohort}@example.test`));
      seedPaidOrder(student.id, cohort);
      const html = await render(SchedulePage());
      assert.match(html, /Orientation/);
      assert.match(html, /Welcome/);
      assert.match(html, /https:\/\/youtu\.be\/orientation/);
    }
    item.visibility = "HIDDEN";
    assert.ok(!(await render(SchedulePage())).includes("https://youtu.be/orientation"));
    signIn(seedUser("unpaid@example.test"));
    item.visibility = "PUBLISHED";
    assert.ok(!(await render(SchedulePage())).includes("https://youtu.be/orientation"));
  });

  test("a Bunny recording is listed for enrolled students without any signed URL or key in the page", async () => {
    access = { role: "MANAGER" };
    const guid = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
    const input = new FormData();
    for (const [key, value] of Object.entries({ title: "Protected class", source: "bunny", bunnyVideoId: guid, url: "", publish: "on" })) input.set(key, value);
    await outcome(() => actions.saveStandaloneRecordingAction(input));
    const student = signIn(seedUser("bunny@example.test"));
    seedPaidOrder(student.id, SIRAH_BATCH);
    const html = await render(SchedulePage());
    assert.match(html, /Protected class/);
    assert.match(html, /href="#recordings"/);
    for (const secret of ["test-only-token-key", "token=", "iframe.mediadelivery.net"]) assert.ok(!html.includes(secret), `page must not contain ${secret}`);
  });

  test("a session-linked Bunny recording plays in the lightbox for its cohort only, with no key or signed URL in the page", async () => {
    const past = seedSession(new Date(Date.now() - 2 * 86_400_000), { title: "Class with Bunny" });
    const base = { kind: "LINK", contentType: "video/x-external-recording", createdAt: new Date(), publishedAt: new Date(), cohortId: null, parentRecordingId: null, url: null };
    table("lmsResource").push(
      { ...base, id: "bunny-visible", sessionId: past.id, title: "Protected session recording", bunnyVideoId: BUNNY_GUID, visibility: "PUBLISHED" },
      { ...base, id: "bunny-hidden", sessionId: past.id, title: "Hidden protected recording", bunnyVideoId: BUNNY_GUID, visibility: "HIDDEN" },
    );
    const student = signIn(seedUser("linked-bunny@example.test"));
    seedPaidOrder(student.id);
    const html = await render(SchedulePage());
    assert.match(html, /Protected session recording/);
    assert.match(html, /<a class="st stNext" href="#recordings">Watch →<\/a>/);
    assert.ok(!html.includes("Hidden protected recording"));
    for (const secret of ["test-only-token-key", "test-only-api-key", "token=", "iframe.mediadelivery.net"]) assert.ok(!html.includes(secret), `page must not contain ${secret}`);
    const other = signIn(seedUser("other-bunny@example.test"));
    seedPaidOrder(other.id, "other-cohort");
    assert.ok(!(await render(SchedulePage())).includes("Protected session recording"));
  });

  test("students without an active, paid enrolment see the gated state and no sessions", async () => {
    seedSession(new Date(Date.now() + 10 * MIN), { title: "Secret class" });
    signIn(seedUser("unpaid@example.test"));
    const html = await render(SchedulePage());
    assert.match(html, /Live classes are for enrolled students/);
    assert.match(html, /href="\/dashboard"/);
    assert.ok(!html.includes("Secret class"));
    assert.ok(!html.includes("/join"));

    const other = signIn(seedUser("other@example.test"));
    seedPaidOrder(other.id, "other-cohort");
    const otherHtml = await render(SchedulePage());
    assert.ok(!otherHtml.includes("Secret class"), "a paid student of another cohort sees only their cohort");

    identity = null;
    assert.equal((await outcome(() => SchedulePage())).redirect, "/login");
  });

  test("the classroom overview shows the real next class and chronicle", async () => {
    const student = signIn(seedUser("student@example.test"));
    seedPaidOrder(student.id);
    const before = await render(ClassroomPage());
    assert.match(before, /No upcoming live session is scheduled/);
    assert.doesNotMatch(before, /Your calendar/);
    const soon = seedSession(new Date(Date.now() + 10 * MIN), { title: "Week 5" });
    const html = await render(ClassroomPage());
    assert.match(html, /Week 5/);
    assert.doesNotMatch(html, /No upcoming live session is scheduled/);
    assert.ok(html.includes(`/api/sirah/lms/sessions/${soon.id}/join`));
    assert.ok(html.includes('href="/seerah/classroom/schedule"'));
    assertNoZoomSecrets(html);
  });

  test("the chronicle shows published recordings and cohort sessions but excludes hidden and other-cohort records", async () => {
    const student = signIn(seedUser("student@example.test"));
    seedPaidOrder(student.id);
    const past = seedSession(new Date(Date.now() - 2 * 86_400_000), { title: "Class 01" });
    seedSession(new Date(Date.now() - 86_400_000), { title: "Class 02" });
    seedSession(new Date(Date.now() - 86_400_000), { title: "Other cohort class", cohortId: "other-cohort" });
    const base = { kind: "LINK", contentType: "video/x-external-recording", createdAt: new Date(), publishedAt: new Date(), cohortId: null, parentRecordingId: null, bunnyVideoId: null };
    table("lmsResource").push(
      { ...base, id: "orientation", sessionId: null, title: "Orientation", url: "https://example.test/orientation", visibility: "PUBLISHED", originalFilename: "Welcome" },
      { ...base, id: "visible", sessionId: past.id, title: "Class 01 recording", url: "https://example.test/recording", visibility: "PUBLISHED" },
      { ...base, id: "hidden", sessionId: null, title: "Hidden recording", url: "https://example.test/hidden", visibility: "HIDDEN" },
    );
    const html = await render(ClassroomPage());
    for (const title of ["Orientation", "Class 01", "Class 02", "Class 01 recording"]) assert.ok(html.includes(title), title);
    assert.doesNotMatch(html, /Hidden recording|Other cohort class|Sessions appear here once the team publishes them|Your calendar/);
    assert.match(html, /No upcoming live session is scheduled/);
    assert.match(html, /recording available/);
    assertNoZoomSecrets(html);
  });

  test("the view layer never carries the encrypted fields", async () => {
    const student = signIn(seedUser("student@example.test"));
    seedPaidOrder(student.id);
    seedSession(new Date(Date.now() + 10 * MIN));
    const result = await schedule.studentSchedule(student.id);
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes("joinUrlEncrypted") && !serialized.includes("passcodeEncrypted"));
    assert.ok(!/zoom\.us/.test(serialized));
  });
});

// ── Teacher ────────────────────────────────────────────────────────────────

describe("teacher portal", () => {
  test("a host-email user sees the sessions they host with Start as host links", async () => {
    signIn(seedUser("Teacher@Example.test"));
    const up = seedSession(new Date(Date.now() + 86_400_000), { title: "Week 6" });
    seedSession(new Date(Date.now() - 86_400_000), { title: "Week 5" });
    const cancelled = seedSession(new Date(Date.now() + 2 * 86_400_000), { title: "Dropped", status: "CANCELLED" });
    table("zoomHost").push({ id: "host_2", zoomUserId: "zu2", email: "someone-else@example.test", licensed: true, active: true });
    seedSession(new Date(Date.now() + 3 * 86_400_000), { title: "Not mine", zoomHostId: "host_2" });

    const html = await render(TeachingPage());
    assert.match(html, /My sessions/);
    assert.match(html, /Week 6/);
    assert.match(html, /Week 5/);
    assert.ok(!html.includes("Not mine"));
    assert.ok(html.includes(`href="/api/sirah/lms/sessions/${up.id}/start"`));
    assert.ok(!html.includes(`/api/sirah/lms/sessions/${cancelled.id}/start`), "no Start for a cancelled session");
    assert.equal((html.match(/href="\/api\/sirah\/lms\/sessions\/[^"]+\/start"/g) || []).length, 1, "only upcoming sessions can be started");
    assertNoZoomSecrets(html);
  });

  test("non-hosts, inactive hosts and signed-out visitors do not see the portal", async () => {
    signIn(seedUser("student@example.test"));
    assert.equal((await outcome(() => TeachingPage())).notFound, true);

    signIn(seedUser("teacher@example.test"));
    table("zoomHost")[0].active = false;
    assert.equal((await outcome(() => TeachingPage())).notFound, true);

    identity = null;
    assert.equal((await outcome(() => TeachingPage())).redirect, "/login");
  });

  test("only super admins can designate a revenue partner", async () => {
    const form = new FormData(); form.set("hostId", "host_1"); form.set("enabled", "1");
    access = { role: "MANAGER" };
    assert.equal((await outcome(() => actions.setRevenuePartner(form))).redirect, "/admin/sirah");
    assert.notEqual(table("zoomHost")[0].revenuePartner, true);
    access = { role: "SUPER_ADMIN" };
    assert.match((await outcome(() => actions.setRevenuePartner(form))).redirect || "", /Revenue\+access\+granted/);
    assert.equal(table("zoomHost")[0].revenuePartner, true);
    assert.equal(table("sirahAccessAudit")[0].action, "REVENUE_PARTNER_GRANTED");
    form.set("enabled", "0");
    await outcome(() => actions.setRevenuePartner(form));
    assert.equal(table("zoomHost")[0].revenuePartner, false);
  });

  test("teachers can schedule only with their host and assigned cohort", async () => {
    const { scheduleTeacherSession } = await import("../app/seerah/classroom/teaching/actions");
    signIn(seedUser("teacher@example.test"));
    seedSession(new Date(Date.now() + 86_400_000));
    const form = new FormData();
    form.set("hostId", "host_1"); form.set("cohortId", "other-cohort"); form.set("title", "New class");
    form.set("timeZone", "UTC"); form.set("startsLocal", new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 16)); form.set("durationMin", "60");
    assert.match((await outcome(() => scheduleTeacherSession(form))).redirect || "", /Not\+authorised/);
    assert.equal(apiCalls().length, 0);
    form.set("cohortId", SIRAH_BATCH);
    assert.match((await outcome(() => scheduleTeacherSession(form))).redirect || "", /Session\+scheduled/);
    assert.equal(apiCalls().filter(call => call.method === "POST").length, 1);
  });

  test("hostsForIdentity uses the start route's rule", async () => {
    assert.equal((await schedule.hostsForIdentity({ email: " TEACHER@example.test " })).length, 1);
    assert.equal((await schedule.hostsForIdentity({ email: "student@example.test" })).length, 0);
    assert.equal((await schedule.hostsForIdentity(null)).length, 0);
  });
});
