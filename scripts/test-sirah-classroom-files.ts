/**
 * Uploaded classroom files: the real GET handler of /seerah/classroom/files/[id]
 * against an in-memory Prisma stand-in and a mocked signer (no database, no
 * network). A signed-out or non-enrolled viewer never causes a presigned URL.
 */
import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";
import { installFakePrisma, table, tables } from "./fixtures/fake-prisma";

installFakePrisma();

let files: typeof import("../services/sirah-classroom-files.service");
let spaces: typeof import("../lib/sirah/spaces");
let classroom: typeof import("../lib/sirah/classroom");
before(async () => {
  files = await import("../services/sirah-classroom-files.service");
  spaces = await import("../lib/sirah/spaces");
  classroom = await import("../lib/sirah/classroom");
});

const KEY = "sirah/classroom/0b1c2d3e-4f50-4617-8899-aabbccddeeff/week-1.mp4";
const SIGNED = "https://bucket.example.digitaloceanspaces.com/signed?X-Amz-Signature=abc";

type SignCall = { key: string; contentType: string | null; filename: string | null; expiresIn: number };
let calls: SignCall[] = [];
const mockSigner = async (input: SignCall) => {
  calls.push(input);
  return SIGNED;
};

const enrolled = { allowed: true, studentId: "student-1" };
const notEnrolled = { allowed: false, studentId: "student-2" };
const signedOut = { allowed: false, studentId: null };

function handler(gate: { allowed: boolean; studentId: string | null }, configured = true) {
  return files.materialFileHandler({ gate: async () => gate, sign: mockSigner, configured: () => configured });
}

const get = (h: ReturnType<typeof handler>, id: string) =>
  h(new Request(`https://tga.example/seerah/classroom/files/${id}`), { params: Promise.resolve({ materialId: id }) });

beforeEach(() => {
  tables.clear();
  calls = [];
  table("sirahMaterial").push(
    {
      id: "up-rec",
      lessonId: "w1",
      title: "Week 1 recording",
      kind: "RECORDING",
      url: "/seerah/classroom/files/up-rec",
      order: 0,
      storage: "UPLOAD",
      objectKey: KEY,
      contentType: "video/mp4",
      sizeBytes: BigInt(1024),
      originalFilename: "Week 1.mp4",
    },
    {
      id: "up-pdf",
      lessonId: "w1",
      title: "Reading",
      kind: "READING",
      url: "/seerah/classroom/files/up-pdf",
      order: 1,
      storage: "UPLOAD",
      objectKey: "sirah/classroom/1b1c2d3e-4f50-4617-8899-aabbccddeeff/reading.pdf",
      contentType: "application/pdf",
      sizeBytes: BigInt(2048),
      originalFilename: "reading.pdf",
    },
    { id: "link", lessonId: "w1", title: "Slides", kind: "SLIDES", url: "https://example.com/s", order: 2, storage: "LINK", objectKey: null },
  );
});

test("signed out: sent to login, and no presigned URL is ever made", async () => {
  for (const id of ["up-rec", "up-pdf", "missing"]) {
    const response = await get(handler(signedOut), id);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://tga.example/login");
    assert.ok(!response.headers.get("location")!.includes("digitaloceanspaces"));
  }
  assert.equal(calls.length, 0);
});

test("signed in but not enrolled: sent to the dashboard, never signed, existence not revealed", async () => {
  const real = await get(handler(notEnrolled), "up-rec");
  const fake = await get(handler(notEnrolled), "does-not-exist");
  assert.equal(real.status, 302);
  assert.equal(real.headers.get("location"), "https://tga.example/dashboard");
  assert.equal(fake.status, real.status, "a missing id answers exactly like a real one");
  assert.equal(fake.headers.get("location"), real.headers.get("location"));
  assert.equal(calls.length, 0);
});

test("enrolled: redirected to a short-lived presigned GET for the stored object", async () => {
  const response = await get(handler(enrolled), "up-rec");
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), SIGNED);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.deepEqual(calls, [
    { key: KEY, contentType: "video/mp4", filename: "Week 1.mp4", expiresIn: spaces.RECORDING_URL_SECONDS },
  ]);

  await get(handler(enrolled), "up-pdf");
  assert.equal(calls[1].expiresIn, spaces.DOCUMENT_URL_SECONDS, "documents get the shorter link");
  assert.ok(spaces.DOCUMENT_URL_SECONDS <= 15 * 60 && spaces.RECORDING_URL_SECONDS <= 4 * 3600);
});

test("enrolled: a pasted link or an unknown id is not served by the file route", async () => {
  assert.equal((await get(handler(enrolled), "link")).status, 404);
  assert.equal((await get(handler(enrolled), "nope")).status, 404);
  assert.equal(calls.length, 0);
});

test("storage not configured: 503 for an enrolled student, still nothing signed", async () => {
  assert.equal((await get(handler(enrolled, false), "up-rec")).status, 503);
  assert.equal(calls.length, 0);
});

test("the view builder exposes upload details to enrolled viewers only", () => {
  const lesson = { id: "w1", title: "W1", summary: "", weekNumber: 1, scheduledAt: new Date(0), zoomJoinUrl: null, zoomMeetingId: null };
  const rows = table("sirahMaterial") as never[];
  const out = classroom.toLessonView(lesson, rows, { enrolled: false });
  assert.ok(out.materials.every((m) => m.url === null && m.file === null && m.embed === null));
  const inside = classroom.toLessonView(lesson, rows, { enrolled: true });
  const rec = inside.materials.find((m) => m.id === "up-rec")!;
  assert.equal(rec.url, "/seerah/classroom/files/up-rec", "the route, never a bucket URL");
  assert.deepEqual(rec.file, { contentType: "video/mp4" });
  assert.equal(rec.embed, null);
});

test("upload rules: kinds, types, sizes and our own key format", () => {
  assert.equal(spaces.uploadProblem("RECORDING", "video/mp4", 10), null);
  assert.match(spaces.uploadProblem("RECORDING", "application/pdf", 10)!, /recording/i);
  assert.equal(spaces.uploadProblem("SLIDES", "application/pdf", 10), null);
  assert.match(spaces.uploadProblem("SLIDES", "text/html", 10)!, /Upload a PDF/);
  assert.match(spaces.uploadProblem("SLIDES", "application/pdf", spaces.MAX_DOCUMENT_BYTES + 1)!, /200 MB/);
  assert.match(spaces.uploadProblem("RECORDING", "video/mp4", spaces.MAX_RECORDING_BYTES + 1)!, /5 GB/);
  assert.match(spaces.uploadProblem("SLIDES", "application/pdf", 0)!, /empty/);

  const key = spaces.newObjectKey("../../Week 3 — slides?.pdf");
  assert.ok(spaces.isClassroomObjectKey(key), key);
  assert.ok(!key.includes(".."), "no path traversal survives");
  assert.ok(!spaces.isClassroomObjectKey("sirah/classroom/../secret.pdf"));
  assert.ok(!spaces.isClassroomObjectKey("other/0b1c2d3e-4f50-4617-8899-aabbccddeeff/a.pdf"));
});

test("presigning (offline): PUT and GET URLs expire and carry no checksum headers", async () => {
  Object.assign(process.env, {
    SIRAH_SPACES_ENDPOINT: "https://ams3.digitaloceanspaces.com",
    SIRAH_SPACES_REGION: "ams3",
    SIRAH_SPACES_BUCKET: "tga-test",
    SIRAH_SPACES_KEY: "test-key",
    SIRAH_SPACES_SECRET: "test-secret",
  });
  assert.ok(spaces.spacesConfigured());
  const put = new URL(await spaces.presignUpload(KEY, "video/mp4"));
  assert.equal(put.searchParams.get("X-Amz-Expires"), String(spaces.UPLOAD_URL_SECONDS));
  assert.ok(put.hostname.endsWith("digitaloceanspaces.com"));
  assert.ok(![...put.searchParams.keys()].some((k) => k.toLowerCase().includes("checksum")), put.toString());

  const download = new URL(await spaces.presignDownload({ key: KEY, contentType: "video/mp4", filename: "Week 1.mp4", expiresIn: 600 }));
  assert.equal(download.searchParams.get("X-Amz-Expires"), "600");
  assert.match(download.searchParams.get("response-content-disposition")!, /^inline; filename="Week 1\.mp4"/);
  for (const name of ["SIRAH_SPACES_ENDPOINT", "SIRAH_SPACES_REGION", "SIRAH_SPACES_BUCKET", "SIRAH_SPACES_KEY", "SIRAH_SPACES_SECRET"])
    delete process.env[name];
  assert.equal(spaces.spacesConfig(), null);
});
