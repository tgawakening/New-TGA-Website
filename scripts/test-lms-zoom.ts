/**
 * LMS Zoom foundation: token cache, zoomFetch retries, client scope errors,
 * webhook signature / url_validation / de-duplication.
 *
 * Mocks only: fetch is stubbed, credentials are fake, the database is an
 * in-memory stand-in. No Zoom or database connection is ever made.
 */
import assert from "node:assert/strict";
import test, { afterEach, before, beforeEach, describe } from "node:test";
import { Prisma } from "@prisma/client";
import { installFakePrisma } from "./fixtures/fake-prisma";

const fakeDb = installFakePrisma() as Record<string, Record<string, unknown>>;

const FAKE_ENV = {
  ZOOM_ACCOUNT_ID: "acct_test",
  ZOOM_CLIENT_ID: "client_test",
  ZOOM_CLIENT_SECRET: "secret_test",
  ZOOM_DEFAULT_HOST_USER_ID: "host_test",
  ZOOM_WEBHOOK_SECRET_TOKEN: "whsec_test_token",
};
Object.assign(process.env, FAKE_ENV);

let token: typeof import("../lib/zoom/token");
let client: typeof import("../lib/zoom/client");
let webhook: typeof import("../lib/zoom/webhook");
let store: typeof import("../lib/zoom/webhook-store");
let env: typeof import("../lib/zoom/env");
let route: typeof import("../app/api/sirah/lms/zoom/webhook/route");
before(async () => {
  token = await import("../lib/zoom/token");
  client = await import("../lib/zoom/client");
  webhook = await import("../lib/zoom/webhook");
  store = await import("../lib/zoom/webhook-store");
  env = await import("../lib/zoom/env");
  route = await import("../app/api/sirah/lms/zoom/webhook/route");
});

// ── fetch mock ─────────────────────────────────────────────────────────────

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
let handlers: ((call: Call) => Response | undefined)[] = [];
const originalFetch = global.fetch;
let clock = Date.parse("2026-11-20T12:00:00Z");
let slept: number[] = [];

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
const isTokenCall = (c: Call) => c.url.startsWith("https://zoom.us/oauth/token");
const tokenCalls = () => calls.filter(isTokenCall);
const apiCalls = () => calls.filter((c) => !isTokenCall(c));
let issued = 0;
const tokenResponder = (expiresIn = 3600) => (c: Call) =>
  isTokenCall(c) ? json({ access_token: `tok_${++issued}`, token_type: "bearer", expires_in: expiresIn, scope: "meeting:read:meeting:admin" }) : undefined;

beforeEach(() => {
  calls = [];
  handlers = [];
  slept = [];
  issued = 0;
  clock = Date.parse("2026-11-20T12:00:00Z");
  Object.assign(process.env, FAKE_ENV);
  token.clearZoomTokenCache();
  token.zoomRuntime.now = () => clock;
  token.zoomRuntime.sleep = async (ms) => {
    slept.push(ms);
  };
  global.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(input instanceof Request ? input.url : input), init };
    calls.push(call);
    for (const handler of handlers) {
      const response = handler(call);
      if (response) return response;
    }
    throw new Error(`Unexpected fetch in test: ${call.url}`);
  }) as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

const bearer = (c: Call) => new Headers(c.init.headers).get("Authorization");

// ── Token cache ────────────────────────────────────────────────────────────

describe("token cache", () => {
  test("reuses a cached token until five minutes before expiry", async () => {
    handlers.push(tokenResponder(3600));
    assert.equal(await token.getZoomAccessToken(), "tok_1");
    clock += 54 * 60 * 1000; // 54 min: 6 min left, still cached
    assert.equal(await token.getZoomAccessToken(), "tok_1");
    assert.equal(tokenCalls().length, 1);
    clock += 60 * 1000; // 55 min: inside the 5-minute margin
    assert.equal(await token.getZoomAccessToken(), "tok_2");
    assert.equal(tokenCalls().length, 2);
  });

  test("sends account credentials grant with Basic auth", async () => {
    handlers.push(tokenResponder());
    await token.getZoomAccessToken();
    const [call] = tokenCalls();
    const url = new URL(call.url);
    assert.equal(url.searchParams.get("grant_type"), "account_credentials");
    assert.equal(url.searchParams.get("account_id"), "acct_test");
    assert.equal(call.init.method, "POST");
    assert.equal(new Headers(call.init.headers).get("Authorization"), `Basic ${Buffer.from("client_test:secret_test").toString("base64")}`);
  });

  test("concurrent callers share one token request", async () => {
    handlers.push(tokenResponder());
    const tokens = await Promise.all([token.getZoomAccessToken(), token.getZoomAccessToken(), token.getZoomAccessToken()]);
    assert.deepEqual(tokens, ["tok_1", "tok_1", "tok_1"]);
    assert.equal(tokenCalls().length, 1);
  });

  test("token failure does not leak the client secret", async () => {
    handlers.push((c) => (isTokenCall(c) ? json({ reason: "Invalid client_id or client_secret" }, 400) : undefined));
    await assert.rejects(token.getZoomAccessToken(), (error: Error) => {
      assert.match(error.message, /HTTP 400/);
      assert.doesNotMatch(error.message, /secret_test/);
      return true;
    });
  });

  test("missing env names the variable, not its value", async () => {
    delete process.env.ZOOM_CLIENT_SECRET;
    await assert.rejects(token.getZoomAccessToken(), (error: Error) => {
      assert.ok(error instanceof env.ZoomConfigError);
      assert.match(error.message, /ZOOM_CLIENT_SECRET/);
      return true;
    });
    assert.equal(calls.length, 0);
  });
});

// ── zoomFetch ──────────────────────────────────────────────────────────────

describe("zoomFetch", () => {
  test("refreshes the token once on 401 and retries", async () => {
    handlers.push(tokenResponder());
    handlers.push((c) => (bearer(c) === "Bearer tok_1" ? json({ code: 124, message: "Invalid access token." }, 401) : undefined));
    handlers.push((c) => (bearer(c) === "Bearer tok_2" ? json({ ok: true }) : undefined));
    const response = await token.zoomFetch("/users/me");
    assert.equal(response.status, 200);
    assert.equal(tokenCalls().length, 2);
    assert.equal(apiCalls().length, 2);
  });

  test("does not refresh more than once", async () => {
    handlers.push(tokenResponder());
    handlers.push((c) => (!isTokenCall(c) ? json({ code: 124, message: "Invalid access token." }, 401) : undefined));
    const response = await token.zoomFetch("/users/me");
    assert.equal(response.status, 401);
    assert.equal(tokenCalls().length, 2);
    assert.equal(apiCalls().length, 2);
  });

  test("backs off on 429 using Retry-After, then succeeds", async () => {
    handlers.push(tokenResponder());
    let n = 0;
    handlers.push((c) => (isTokenCall(c) ? undefined : ++n < 3 ? json({ code: 429 }, 429, { "Retry-After": "2" }) : json({ ok: true })));
    const response = await token.zoomFetch("/users/me");
    assert.equal(response.status, 200);
    assert.deepEqual(slept, [2000, 2000]);
  });

  test("gives up after three 429 retries and does not sleep on long waits", async () => {
    handlers.push(tokenResponder());
    handlers.push((c) => (isTokenCall(c) ? undefined : json({ code: 429 }, 429)));
    const response = await token.zoomFetch("/users/me");
    assert.equal(response.status, 429);
    assert.deepEqual(slept, [1000, 2000, 4000]);

    slept = [];
    handlers.unshift((c) => (isTokenCall(c) ? undefined : json({ code: 429 }, 429, { "Retry-After": "3600" })));
    assert.equal((await token.zoomFetch("/users/me")).status, 429);
    assert.deepEqual(slept, []);
  });
});

// ── Client ─────────────────────────────────────────────────────────────────

describe("client", () => {
  test("createMeeting posts a UTC scheduled meeting for the host", async () => {
    handlers.push(tokenResponder());
    handlers.push((c) => (isTokenCall(c) ? undefined : json({ id: 85012345678, uuid: "abc==", join_url: "https://zoom.us/j/1", start_url: "https://zoom.us/s/1" }, 201)));
    const meeting = await client.createMeeting("host_test", { topic: "Week 1", startsAt: new Date("2026-12-01T18:30:00.000Z"), durationMin: 90 });
    assert.equal(meeting.id, 85012345678);
    const [call] = apiCalls();
    assert.equal(call.url, "https://api.zoom.us/v2/users/host_test/meetings");
    const body = JSON.parse(String(call.init.body));
    assert.equal(body.start_time, "2026-12-01T18:30:00Z");
    assert.equal(body.timezone, "UTC");
    assert.equal(body.type, 2);
    assert.equal(body.settings.waiting_room, true);
  });

  test("a missing scope error names the scope", async () => {
    handlers.push(tokenResponder());
    handlers.push((c) =>
      isTokenCall(c) ? undefined : json({ code: 4711, message: "Invalid access token, does not contain scopes:[meeting:write:meeting:admin]." }, 401),
    );
    await assert.rejects(client.createMeeting("host_test", { topic: "x", startsAt: new Date(), durationMin: 60 }), (error: Error) => {
      assert.ok(error instanceof client.ZoomApiError);
      assert.match(error.message, /missing scope meeting:write:meeting:admin/);
      assert.deepEqual(error.missingScopes, ["meeting:write:meeting:admin"]);
      return true;
    });
    assert.equal(tokenCalls().length, 1, "scope errors do not trigger a token refresh");
  });

  test("scope error without a list falls back to the operation's scope", async () => {
    handlers.push(tokenResponder());
    handlers.push((c) => (isTokenCall(c) ? undefined : json({ code: 4711, message: "Invalid access token, does not contain scopes." }, 400)));
    await assert.rejects(client.listRecordings("123"), /cloud_recording:read:list_recording_files:admin/);
  });

  test("past participants follow pagination and double-encode slash UUIDs", async () => {
    handlers.push(tokenResponder());
    handlers.push((c) => {
      if (isTokenCall(c)) return undefined;
      const url = new URL(c.url);
      return url.searchParams.get("next_page_token")
        ? json({ participants: [{ name: "B", join_time: "", leave_time: "", duration: 1 }] })
        : json({ participants: [{ name: "A", join_time: "", leave_time: "", duration: 1 }], next_page_token: "p2" });
    });
    const people = await client.getPastMeetingParticipants("/ab//c==");
    assert.deepEqual(people.map((p) => p.name), ["A", "B"]);
    assert.ok(apiCalls()[0].url.includes("/past_meetings/%252Fab%252F%252Fc%253D%253D/participants"));
  });
});

// ── Webhook ────────────────────────────────────────────────────────────────

const SECRET = FAKE_ENV.ZOOM_WEBHOOK_SECRET_TOKEN;
const nowSeconds = () => String(Math.floor(Date.now() / 1000));

function signedRequest(body: unknown, opts: { secret?: string; timestamp?: string; signature?: string } = {}) {
  const raw = JSON.stringify(body);
  const timestamp = opts.timestamp ?? nowSeconds();
  const signature = opts.signature ?? webhook.signZoomPayload(opts.secret ?? SECRET, timestamp, raw);
  return new Request("https://tga.example/api/sirah/lms/zoom/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-zm-request-timestamp": timestamp, "x-zm-signature": signature },
    body: raw,
  });
}

const startedEvent = {
  event: "meeting.started",
  event_ts: 1795000000000,
  payload: { account_id: "acct_test", object: { uuid: "uuid-1==", id: "85012345678" } },
};

describe("webhook signature", () => {
  test("accepts a correct v0 signature", () => {
    const raw = JSON.stringify(startedEvent);
    const ts = "1795000000";
    const signature = webhook.signZoomPayload(SECRET, ts, raw);
    assert.match(signature, /^v0=[0-9a-f]{64}$/);
    assert.deepEqual(webhook.verifyZoomSignature({ rawBody: raw, signature, timestamp: ts, secret: SECRET, nowMs: 1795000000_000 }), { ok: true });
  });

  test("rejects a wrong secret, a tampered body and missing headers", () => {
    const raw = JSON.stringify(startedEvent);
    const ts = "1795000000";
    const nowMs = 1795000000_000;
    const bad = webhook.signZoomPayload("other-secret", ts, raw);
    assert.deepEqual(webhook.verifyZoomSignature({ rawBody: raw, signature: bad, timestamp: ts, secret: SECRET, nowMs }), { ok: false, reason: "bad_signature" });
    const good = webhook.signZoomPayload(SECRET, ts, raw);
    assert.deepEqual(webhook.verifyZoomSignature({ rawBody: raw + " ", signature: good, timestamp: ts, secret: SECRET, nowMs }), { ok: false, reason: "bad_signature" });
    assert.deepEqual(webhook.verifyZoomSignature({ rawBody: raw, signature: "v0=short", timestamp: ts, secret: SECRET, nowMs }), { ok: false, reason: "bad_signature" });
    assert.deepEqual(webhook.verifyZoomSignature({ rawBody: raw, signature: null, timestamp: ts, secret: SECRET, nowMs }), { ok: false, reason: "missing_headers" });
  });

  test("rejects requests older than five minutes", () => {
    const raw = JSON.stringify(startedEvent);
    const ts = "1795000000";
    const signature = webhook.signZoomPayload(SECRET, ts, raw);
    const at = (offsetSeconds: number) => webhook.verifyZoomSignature({ rawBody: raw, signature, timestamp: ts, secret: SECRET, nowMs: (1795000000 + offsetSeconds) * 1000 });
    assert.deepEqual(at(300), { ok: true });
    assert.deepEqual(at(301), { ok: false, reason: "stale" });
    assert.deepEqual(at(-301), { ok: false, reason: "stale" });
  });

  test("route returns 401 for a bad signature and stores nothing", async () => {
    const res = await route.POST(signedRequest(startedEvent, { secret: "wrong" }));
    assert.equal(res.status, 401);
    assert.equal(await (fakeDb.zoomWebhookEvent.count as () => Promise<number>)(), 0);
  });

  test("route returns 401 for a stale timestamp", async () => {
    const old = String(Math.floor(Date.now() / 1000) - 600);
    const res = await route.POST(signedRequest(startedEvent, { timestamp: old }));
    assert.equal(res.status, 401);
    assert.equal((await res.json()).reason, "stale");
  });
});

describe("url_validation", () => {
  test("responds with plainToken and its HMAC", async () => {
    const res = await route.POST(signedRequest({ event: "endpoint.url_validation", event_ts: 1, payload: { plainToken: "qgg8vlvZRS6UYooatFL8Aw" } }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.plainToken, "qgg8vlvZRS6UYooatFL8Aw");
    const { createHmac } = await import("node:crypto");
    assert.equal(body.encryptedToken, createHmac("sha256", SECRET).update("qgg8vlvZRS6UYooatFL8Aw").digest("hex"));
  });

  test("refuses unsigned validation requests and non-token text", async () => {
    const unsigned = await route.POST(signedRequest({ event: "endpoint.url_validation", payload: { plainToken: "abc" } }, { signature: "v0=00" }));
    assert.equal(unsigned.status, 401);
    const oracle = await route.POST(signedRequest({ event: "endpoint.url_validation", payload: { plainToken: 'v0:1:{"event":"x"}' } }));
    assert.equal(oracle.status, 400);
  });

  test("returns 503 naming nothing secret when the token env is missing", async () => {
    delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
    const res = await route.POST(signedRequest(startedEvent));
    assert.equal(res.status, 503);
  });
});

describe("dedupe", () => {
  // In-memory table with a unique index on dedupeKey, like MySQL.
  function uniqueDb() {
    const rows: { id: string; dedupeKey: string; event: string; payload: unknown }[] = [];
    return {
      rows,
      zoomWebhookEvent: {
        async create({ data }: { data: { dedupeKey: string; event: string; payload: unknown } }) {
          if (rows.some((r) => r.dedupeKey === data.dedupeKey))
            throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the constraint: `ZoomWebhookEvent_dedupeKey_key`", {
              code: "P2002",
              clientVersion: "test",
            });
          const row = { id: `evt_${rows.length + 1}`, ...data };
          rows.push(row);
          return row;
        },
      },
    };
  }

  test("a repeated delivery is stored once", async () => {
    const db = uniqueDb();
    const first = await store.recordZoomWebhookEvent(startedEvent, db as never);
    const second = await store.recordZoomWebhookEvent(structuredClone(startedEvent), db as never);
    assert.equal(first.stored, true);
    assert.deepEqual(second, { stored: false, duplicate: true, dedupeKey: first.dedupeKey });
    assert.equal(db.rows.length, 1);
  });

  test("different event_ts, event or uuid produce different keys", () => {
    const base = webhook.zoomDedupeKey(startedEvent);
    assert.match(base, /^[0-9a-f]{64}$/);
    assert.notEqual(webhook.zoomDedupeKey({ ...startedEvent, event_ts: startedEvent.event_ts + 1 }), base);
    assert.notEqual(webhook.zoomDedupeKey({ ...startedEvent, event: "meeting.ended" }), base);
    assert.notEqual(webhook.zoomDedupeKey({ ...startedEvent, payload: { object: { uuid: "uuid-2==" } } }), base);
  });

  test("other database errors still throw", async () => {
    const db = { zoomWebhookEvent: { create: async () => { throw new Error("connection lost"); } } };
    await assert.rejects(store.recordZoomWebhookEvent(startedEvent, db as never), /connection lost/);
  });

  test("route answers 200 for both the first and the repeated delivery", async () => {
    const db = uniqueDb();
    const delegate = fakeDb.zoomWebhookEvent as { create: unknown };
    const originalCreate = delegate.create;
    delegate.create = db.zoomWebhookEvent.create;
    try {
      const first = await route.POST(signedRequest(startedEvent));
      const again = await route.POST(signedRequest(startedEvent));
      assert.equal(first.status, 200);
      assert.deepEqual(await first.json(), { received: true, duplicate: false });
      assert.equal(again.status, 200);
      assert.deepEqual(await again.json(), { received: true, duplicate: true });
      assert.equal(db.rows.length, 1);
    } finally {
      delegate.create = originalCreate;
    }
  });
});
