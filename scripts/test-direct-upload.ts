import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CreateMultipartUploadCommand, ListPartsCommand, CompleteMultipartUploadCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { uploadFileProblem } from "../lib/sirah/direct-upload-policy";
const file = (relative: string) => pathToFileURL(path.resolve(__dirname, relative)).href;
let uploadedSize = 7;
let complete = false;
let contentType = "application/pdf";
let createdKey = "";
let createdBucket = "";
let signedDownload: GetObjectCommand | null = null;
let clientConfig: { endpoint: string; region: string; bucket: string; key: string; secret: string } | null = null;
const client = { send: async (command: unknown) => {
  if (command instanceof CreateMultipartUploadCommand) { complete = false; contentType = command.input.ContentType || ""; createdKey = command.input.Key || ""; createdBucket = command.input.Bucket || ""; return { UploadId: "upload-one" }; }
  if (command instanceof ListPartsCommand) { if (complete) throw Object.assign(new Error(), { name: "NoSuchUpload" }); return { Parts: [{ PartNumber: 1, Size: uploadedSize, ETag: '"etag"' }] }; }
  if (command instanceof CompleteMultipartUploadCommand) { complete = true; return {}; }
  if (command instanceof HeadObjectCommand) return { ContentLength: uploadedSize, ContentType: contentType };
  throw new Error("unexpected operation");
} };
class TestError extends Error { constructor(message: string, public status = 400) { super(message); } }
mock.module("server-only", { namedExports: {} });
mock.module(file("../lib/sirah/spaces.ts"), { namedExports: { createSpacesClient: (config: typeof clientConfig) => { clientConfig = config; return client; }, safeFilename: (name: string) => name, contentDisposition: () => "attachment" } });
mock.module(file("../services/sirah-registration.service.ts"), { namedExports: { SirahError: TestError } });
mock.module("@aws-sdk/s3-request-presigner", { namedExports: { getSignedUrl: async (_client: unknown, command: unknown) => { if (command instanceof GetObjectCommand) signedDownload = command; return "https://example.invalid/upload"; } } });
let uploads: typeof import("../lib/sirah/direct-upload");
before(async () => {
  Object.assign(process.env, {
    SIRAH_UPLOAD_TOKEN_SECRET: "test-only-secret-that-is-long-enough",
    SPACES_ENDPOINT: "https://storage.example.test",
    SPACES_REGION: "test-region",
    SPACES_BUCKET: "recordings-test",
    SPACES_ACCESS_KEY: "test-access-key",
    SPACES_SECRET_KEY: "test-secret-key",
  });
  uploads = await import("../lib/sirah/direct-upload");
});
test("file rules enforce format and purpose-specific size limits", () => {
  assert.equal(uploadFileProblem("task", "photo.heic", 12), "");
  assert.equal(uploadFileProblem("task", "work.docx", 12), "");
  assert.match(uploadFileProblem("agreement", "work.docx", 12), /Unsupported/);
  assert.match(uploadFileProblem("registration", "receipt.pdf", 4 * 1024 * 1024 + 1), /too large/i);
});
test("signed upload is bound to its purpose, scope, owner and uploaded size", async () => {
  uploadedSize = 7;
  const { token } = await uploads.createDirectUpload("task", "task-a", "student-a", "answer.pdf", 7);
  assert.equal(createdBucket, "recordings-test");
  assert.deepEqual(clientConfig, { endpoint: "https://storage.example.test", region: "test-region", bucket: "recordings-test", key: "test-access-key", secret: "test-secret-key" });
  assert.match(createdKey, /^uploads\/[0-9a-f-]{36}\/answer\.pdf$/);
  await assert.rejects(() => uploads.verifyDirectUpload(token, "task", "task-b", "student-a"));
  await assert.rejects(() => uploads.verifyDirectUpload(token, "task", "task-a", "student-b"));
  await assert.rejects(() => uploads.verifyDirectUpload(token, "agreement", "task-a", "student-a"));
  await assert.rejects(() => uploads.verifyDirectUpload(token + "x", "task", "task-a", "student-a"));
  uploadedSize = 8;
  await assert.rejects(() => uploads.verifyDirectUpload(token, "task", "task-a", "student-a"));
  uploadedSize = 7;
  const result = await uploads.verifyDirectUpload(token, "task", "task-a", "student-a");
  assert.equal(result.size, 7);
  assert.equal(complete, true);
  assert.equal((await uploads.verifyDirectUpload(token, "task", "task-a", "student-a")).key, result.key);
  await uploads.presignPrivateAttachment({ key: result.key, contentType: result.type, filename: result.filename, expiresIn: 60 });
  assert.equal((signedDownload as GetObjectCommand | null)?.input.Bucket, "recordings-test");
  assert.equal((signedDownload as GetObjectCommand | null)?.input.Key, result.key);
});
test("uploads fail closed when recordings bucket configuration is missing", async () => {
  delete process.env.SPACES_BUCKET;
  process.env.SIRAH_SPACES_BUCKET = "unrelated-bucket";
  try {
    await assert.rejects(() => uploads.createDirectUpload("task", "task-a", "student-a", "answer.pdf", 7), /not configured/i);
  } finally {
    process.env.SPACES_BUCKET = "recordings-test";
    delete process.env.SIRAH_SPACES_BUCKET;
  }
});
