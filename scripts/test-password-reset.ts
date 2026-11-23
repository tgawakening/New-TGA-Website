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
let auth: typeof import("../services/auth.service");
let cookieConfig: typeof import("../lib/auth/password-reset-cookie");
before(async () => {
  reset = await import("../services/password-reset.service");
  startRoute = await import("../app/reset-password/start/route");
  auth = await import("../services/auth.service");
  cookieConfig = await import("../lib/auth/password-reset-cookie");
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
  assert.match(cookie, /Max-Age=3600/, "the cookie lives as long as the token can (60 minutes)");
  assert.equal(ok.headers.get("referrer-policy"), "no-referrer");

  const junk = startRoute.GET(new Request("https://tga.example/reset-password/start?token=<script>"));
  assert.equal(junk.status, 303);
  assert.equal(junk.headers.get("set-cookie"), null, "malformed tokens are not stored");
});

test("behind the proxy, the redirect goes to the public origin, never the container's address", () => {
  const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456";
  const proxied = startRoute.GET(
    new Request(`http://localhost:8080/reset-password/start?token=${token}`, {
      headers: { "x-forwarded-proto": "https", "x-forwarded-host": "tga-awakening.example" },
    }),
  );
  assert.equal(proxied.status, 303);
  assert.equal(proxied.headers.get("location"), "https://tga-awakening.example/reset-password");
  assert.match(proxied.headers.get("set-cookie")!, new RegExp(`^ga_reset=${token};`));

  // No forwarded headers: NEXT_PUBLIC_APP_URL (https://tga.example here), not localhost:8080.
  const bare = startRoute.GET(new Request(`http://localhost:8080/reset-password/start?token=${token}`));
  assert.equal(bare.headers.get("location"), "https://tga.example/reset-password");
});

test("the reset cookie never expires before the token it carries", () => {
  assert.equal(cookieConfig.RESET_COOKIE_SECONDS, reset.RESET_TOKEN_MINUTES * 60);
  assert.equal(reset.RESET_TOKEN_MINUTES, 60);
});

test("full chain: request, email, open link behind the proxy, new password, sign in with it", async () => {
  table("user").push({ id: "u3", email: "bilal@example.test", fullName: "Bilal", status: "ACTIVE", passwordHash: await bcrypt.hash("bilal-password", 4) });
  const bilalHash = table("user").find((u) => u.id === "u3")!.passwordHash;

  // 1. Request: only the registered address gets an email.
  assert.deepEqual(await reset.requestPasswordReset("AMINA@example.test", { now }), { sent: true });
  assert.deepEqual(await reset.requestPasswordReset("stranger@example.test", { now }), { sent: false });
  assert.equal(mails.length, 1, "no email for an address without an account");
  assert.equal(mails[0].to, "amina@example.test");

  // 2. The emailed link, on the public origin.
  const link = /https:\/\/tga\.example\/reset-password\/start\?token=[A-Za-z0-9_-]{43}/.exec(mails[0].text)?.[0];
  assert.ok(link, "the email carries the public /reset-password/start link");
  const token = tokenFrom(link)!;
  const row = tokens().find((t) => t.userId === "u1")!;
  assert.equal(row.tokenHash, reset.hashResetToken(token), "the token is bound to Amina's account");

  // 3. Opening it (as the container sees it behind the proxy) sets the cookie
  //    and lands on the public reset page.
  const opened = startRoute.GET(
    new Request(link.replace("https://tga.example", "http://localhost:8080"), {
      headers: { "x-forwarded-proto": "https", "x-forwarded-host": "tga.example" },
    }),
  );
  assert.equal(opened.status, 303);
  assert.equal(opened.headers.get("location"), "https://tga.example/reset-password");
  const cookieToken = /^ga_reset=([^;]+);/.exec(opened.headers.get("set-cookie")!)?.[1];
  assert.equal(cookieToken, token);

  // 4. The page accepts it; set the new password (inside the hour).
  const later = new Date(now.getTime() + 50 * MIN);
  assert.ok(await reset.findUsableResetToken(cookieToken, later));
  assert.deepEqual(await reset.resetPassword(cookieToken, "brand-new-password", later), { ok: true });

  // 5. Sign in: the new password works, the old one does not.
  const user = await auth.loginWithEmailPassword({ email: "amina@example.test", password: "brand-new-password" });
  assert.equal(user.id, "u1");
  await assert.rejects(auth.loginWithEmailPassword({ email: "amina@example.test", password: "old-password" }), /Invalid email or password/);

  // Single use, and bound to one account: the link cannot be replayed, and
  // nobody else's password moved.
  assert.deepEqual(await reset.resetPassword(cookieToken, "another-password", later), { ok: false, reason: "invalid" });
  assert.equal(table("user").find((u) => u.id === "u3")!.passwordHash, bilalHash);
  assert.equal(table("session").filter((sess) => sess.userId === "u1").length, 0, "Amina is signed out everywhere");

  // Expiry: a fresh link used after 60 minutes is refused.
  await reset.requestPasswordReset("amina@example.test", { now: later });
  const fresh = tokenFrom(mails.at(-1)!.text)!;
  assert.deepEqual(await reset.resetPassword(fresh, "too-late-password", new Date(later.getTime() + 61 * MIN)), { ok: false, reason: "invalid" });
});
