/**
 * Student password reset against an in-memory Prisma stand-in, with Resend
 * mocked at fetch (no database, no network).
 */
import assert from "node:assert/strict";
import test, { before, beforeEach, afterEach } from "node:test";
import bcrypt from "bcryptjs";
import { installFakePrisma, table, tables } from "./fixtures/fake-prisma";

installFakePrisma();

let reset: typeof import("../services/password-reset.service");
let startRoute: typeof import("../app/reset-password/start/route");
before(async () => {
  reset = await import("../services/password-reset.service");
  startRoute = await import("../app/reset-password/start/route");
});

const now = new Date("2026-11-20T12:00:00.000Z");
const MIN = 60_000;
const originalFetch = global.fetch;
let mails: { to: string; html: string; text: string; subject: string }[] = [];

const tokenFrom = (text: string) => /token=([A-Za-z0-9_-]{43})/.exec(text)?.[1] ?? null;

beforeEach(async () => {
  tables.clear();
  mails = [];
  Object.assign(process.env, { RESEND_API_KEY: "re_test", EMAIL_FROM: "TGA <noreply@example.test>", NEXT_PUBLIC_APP_URL: "https://tga.example" });
  global.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    mails.push({ to: body.to[0], html: body.html, text: body.text, subject: body.subject });
    return new Response(JSON.stringify({ id: "re_1" }), { status: 200 });
  }) as typeof fetch;
  table("user").push(
    { id: "u1", email: "amina@example.test", fullName: "Amina Khan", status: "ACTIVE", passwordHash: await bcrypt.hash("old-password", 4) },
    { id: "u2", email: "held@example.test", fullName: "Held", status: "SUSPENDED", passwordHash: "x" },
  );
  table("session").push({ id: "s1", userId: "u1", tokenHash: "h", expiresAt: new Date(now.getTime() + 86_400_000) });
});

afterEach(() => {
  global.fetch = originalFetch;
});

const tokens = () => table("passwordResetToken");

test("an existing account gets one email; only the token's hash is stored, and the log keeps no link", async () => {
  assert.deepEqual(await reset.requestPasswordReset("  Amina@Example.test ", { now }), { sent: true });
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, "amina@example.test");
  const token = tokenFrom(mails[0].text)!;
  assert.ok(token, "the email carries the link");
  assert.ok(mails[0].text.includes(`https://tga.example/reset-password/start?token=${token}`));
  assert.equal(tokens().length, 1);
  assert.equal(tokens()[0].tokenHash, reset.hashResetToken(token));
  assert.notEqual(tokens()[0].tokenHash, token);
  assert.equal((tokens()[0].expiresAt as Date).getTime(), now.getTime() + 60 * MIN);
  const logged = JSON.stringify(table("emailLog"));
  assert.ok(!logged.includes(token), "the email log never holds the reset link");
});

test("no account, or an inactive one: nothing sent, nothing stored (the page answers the same either way)", async () => {
  assert.deepEqual(await reset.requestPasswordReset("nobody@example.test", { now }), { sent: false });
  assert.deepEqual(await reset.requestPasswordReset("held@example.test", { now }), { sent: false });
  assert.equal(mails.length, 0);
  assert.equal(tokens().length, 0);
});

test("at most three emails per account per hour", async () => {
  for (let i = 0; i < 5; i++) await reset.requestPasswordReset("amina@example.test", { now: new Date(now.getTime() + i * MIN) });
  assert.equal(mails.length, 3);
  await reset.requestPasswordReset("amina@example.test", { now: new Date(now.getTime() + 61 * MIN) });
  assert.equal(mails.length, 4, "the window rolls on");
});

test("a valid token sets the password once, then is spent; sessions end", async () => {
  await reset.requestPasswordReset("amina@example.test", { now });
  const token = tokenFrom(mails[0].text)!;
  const at = new Date(now.getTime() + 10 * MIN);
  assert.ok(await reset.findUsableResetToken(token, at));
  assert.deepEqual(await reset.resetPassword(token, "a-new-password", at), { ok: true });
  const user = table("user").find((u) => u.id === "u1")!;
  assert.ok(await bcrypt.compare("a-new-password", user.passwordHash as string));
  assert.ok(tokens()[0].usedAt instanceof Date);
  assert.equal(table("session").filter((s) => s.userId === "u1").length, 0, "signed out everywhere");
  assert.deepEqual(await reset.resetPassword(token, "another-password", at), { ok: false, reason: "invalid" });
  assert.ok(await bcrypt.compare("a-new-password", table("user").find((u) => u.id === "u1")!.passwordHash as string));
});

test("an expired, unknown, malformed or superseded token is refused and changes nothing", async () => {
  await reset.requestPasswordReset("amina@example.test", { now });
  const first = tokenFrom(mails[0].text)!;
  assert.deepEqual(await reset.resetPassword(first, "a-new-password", new Date(now.getTime() + 61 * MIN)), { ok: false, reason: "invalid" });
  assert.deepEqual(await reset.resetPassword("A".repeat(43), "a-new-password", now), { ok: false, reason: "invalid" });
  assert.deepEqual(await reset.resetPassword("short", "a-new-password", now), { ok: false, reason: "invalid" });
  assert.deepEqual(await reset.resetPassword(undefined, "a-new-password", now), { ok: false, reason: "invalid" });

  await reset.requestPasswordReset("amina@example.test", { now: new Date(now.getTime() + MIN) });
  const second = tokenFrom(mails[1].text)!;
  assert.equal(await reset.findUsableResetToken(first, new Date(now.getTime() + 2 * MIN)), null, "only the newest link works");
  assert.ok(await reset.findUsableResetToken(second, new Date(now.getTime() + 2 * MIN)));
  assert.ok(await bcrypt.compare("old-password", table("user").find((u) => u.id === "u1")!.passwordHash as string));
});

test("password rule matches registration: 8 to 72 characters, confirmed", () => {
  assert.equal(reset.passwordProblem("short", "short"), "Use at least 8 characters.");
  assert.equal(reset.passwordProblem("x".repeat(73), "x".repeat(73)), "Use 72 characters or fewer.");
  assert.equal(reset.passwordProblem("long-enough", "long-enougH"), "The two passwords do not match.");
  assert.equal(reset.passwordProblem("long-enough", "long-enough"), null);
});

test("the emailed link moves the token into a scoped httpOnly cookie and lands on a clean URL", () => {
  const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456";
  const ok = startRoute.GET(new Request(`https://tga.example/reset-password/start?token=${token}`));
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get("location"), "https://tga.example/reset-password");
  const cookie = ok.headers.get("set-cookie")!;
  assert.match(cookie, new RegExp(`^ga_reset=${token};`));
  assert.match(cookie, /Path=\/reset-password/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Max-Age=1800/);
  assert.equal(ok.headers.get("referrer-policy"), "no-referrer");

  const junk = startRoute.GET(new Request("https://tga.example/reset-password/start?token=<script>"));
  assert.equal(junk.status, 303);
  assert.equal(junk.headers.get("set-cookie"), null, "malformed tokens are not stored");
});
