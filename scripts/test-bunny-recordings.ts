import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test, { before, mock } from "node:test";

// Placeholder values for this test process only; not real credentials.
process.env.BUNNY_STREAM_LIBRARY_ID = "12345";
process.env.BUNNY_STREAM_TOKEN_AUTH_KEY = "test-only-token-key";
process.env.BUNNY_STREAM_CDN_HOSTNAME = "vz-test.b-cdn.net";
delete process.env.BUNNY_STREAM_API_KEY;

const file = (relative: string) => pathToFileURL(path.resolve(__dirname, relative)).href;
const GUID = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
type Resource = { id: string; bunnyVideoId: string | null; visibility: "PUBLISHED" | "HIDDEN"; cohortId: string | null; session: { cohortId: string } | null };
let resources: Resource[] = [];
const fake = {
  lmsResource: {
    findFirst: async ({ where }: { where: { id: string; visibility: string } }) =>
      resources.find((row) => row.id === where.id && row.visibility === where.visibility && row.bunnyVideoId) ?? null,
  },
};
mock.module("server-only", { namedExports: {} });
mock.module(file("../lib/prisma.ts"), { namedExports: { prisma: fake } });
mock.module(file("../lib/lms/access.ts"), {
  namedExports: { sirahStudentCohortAccess: async (id: string) => (id === "unpaid" ? { allowed: false, cohortId: null } : { allowed: true, cohortId: "batch" }) },
});

let bunny: typeof import("../lib/lms/bunny");
let recordings: typeof import("../lib/lms/external-recordings");
before(async () => {
  bunny = await import("../lib/lms/bunny");
  recordings = await import("../lib/lms/external-recordings");
});

test("accepts a bare GUID or a pasted Bunny URL, and rejects anything else", () => {
  assert.equal(bunny.cleanBunnyVideoId(` ${GUID.toUpperCase()} `), GUID);
  assert.equal(bunny.cleanBunnyVideoId(`https://iframe.mediadelivery.net/embed/12345/${GUID}?autoplay=true`), GUID);
  assert.throws(() => bunny.cleanBunnyVideoId(""), /Paste the Bunny video ID/);
  assert.throws(() => bunny.cleanBunnyVideoId("https://youtube.com/watch?v=abc"), /not a Bunny video ID/);
});

test("signs the embed with SHA256(key + videoId + expires) and a short expiry", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  const { src, expiresAt } = bunny.signedBunnyEmbed(GUID, now);
  const url = new URL(src);
  const expires = Math.floor(now.getTime() / 1000) + bunny.BUNNY_EMBED_TOKEN_SECONDS;
  assert.equal(url.origin + url.pathname, `https://iframe.mediadelivery.net/embed/12345/${GUID}`);
  assert.equal(url.searchParams.get("expires"), String(expires));
  assert.equal(url.searchParams.get("token"), createHash("sha256").update(`test-only-token-key${GUID}${expires}`).digest("hex"));
  assert.equal(expiresAt.getTime(), expires * 1000);
  assert.ok(bunny.BUNNY_EMBED_TOKEN_SECONDS <= 60 * 60, "embed links stay short-lived");
  assert.ok(!src.includes("test-only-token-key"), "the key itself never appears in the URL");
});

test("refuses to sign without configuration or for a malformed stored ID", () => {
  assert.throws(() => bunny.signedBunnyEmbed("not-a-guid"), bunny.BunnyConfigError);
  const key = process.env.BUNNY_STREAM_TOKEN_AUTH_KEY;
  delete process.env.BUNNY_STREAM_TOKEN_AUTH_KEY;
  try {
    assert.equal(bunny.bunnyConfigured(), false);
    assert.throws(() => bunny.signedBunnyEmbed(GUID), bunny.BunnyConfigError);
  } finally {
    process.env.BUNNY_STREAM_TOKEN_AUTH_KEY = key;
  }
  assert.equal(bunny.bunnyConfigured(), true);
});

test("thumbnail uses the CDN hostname only", () => {
  assert.equal(bunny.bunnyThumbnailUrl(GUID), `https://vz-test.b-cdn.net/${GUID}/thumbnail.jpg`);
});

test("playback is limited to enrolled students, published recordings and their cohort", async () => {
  resources = [
    { id: "open", bunnyVideoId: GUID, visibility: "PUBLISHED", cohortId: null, session: null },
    { id: "hidden", bunnyVideoId: GUID, visibility: "HIDDEN", cohortId: null, session: null },
    { id: "other-cohort", bunnyVideoId: GUID, visibility: "PUBLISHED", cohortId: null, session: { cohortId: "other" } },
  ];
  assert.deepEqual(await recordings.resolveBunnyPlayback("student", "open"), { ok: true, videoId: GUID });
  assert.deepEqual(await recordings.resolveBunnyPlayback("unpaid", "open"), { ok: false, reason: "not_enrolled" });
  assert.deepEqual(await recordings.resolveBunnyPlayback("student", "hidden"), { ok: false, reason: "not_found" });
  assert.deepEqual(await recordings.resolveBunnyPlayback("student", "missing"), { ok: false, reason: "not_found" });
  assert.deepEqual(await recordings.resolveBunnyPlayback("student", "other-cohort"), { ok: false, reason: "not_enrolled" });
});
