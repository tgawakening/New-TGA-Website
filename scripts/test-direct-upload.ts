import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CreateMultipartUploadCommand, ListPartsCommand, CompleteMultipartUploadCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { uploadFileProblem } from "../lib/sirah/direct-upload-policy";
const file = (relative: string) => pathToFileURL(path.resolve(__dirname, relative)).href;
let uploadedSize = 7;
let complete = false;
let contentType = "application/pdf";
const client = { send: async (command: unknown) => {
  if (command instanceof CreateMultipartUploadCommand) { complete = false; contentType = command.input.ContentType || ""; return { UploadId: "upload-one" }; }
  if (command instanceof ListPartsCommand) { if (complete) throw Object.assign(new Error(), { name: "NoSuchUpload" }); return { Parts: [{ PartNumber: 1, Size: uploadedSize, ETag: '"etag"' }] }; }
  if (command instanceof CompleteMultipartUploadCommand) { complete = true; return {}; }
  if (command instanceof HeadObjectCommand) return { ContentLength: uploadedSize, ContentType: contentType };
  throw new Error("unexpected operation");
} };
class TestError extends Error { constructor(message: string, public status = 400) { super(message); } }
mock.module("server-only", { namedExports: {} });
mock.module(file("../lib/sirah/spaces.ts"), { namedExports: { createSpacesClient: () => client, safeFilename: (name: string) => name, spacesConfig: () => ({ bucket: "test" }) } });
mock.module(file("../services/sirah-registration.service.ts"), { namedExports: { SirahError: TestError } });
mock.module("@aws-sdk/s3-request-presigner", { namedExports: { getSignedUrl: async () => "https://example.invalid/upload" } });
let uploads: typeof import("../lib/sirah/direct-upload");
before(async () => { process.env.SIRAH_UPLOAD_TOKEN_SECRET = "test-only-secret-that-is-long-enough"; uploads = await import("../lib/sirah/direct-upload"); });
test("file rules enforce format and purpose-specific size limits", () => {
  assert.equal(uploadFileProblem("task", "photo.heic", 12), "");
  assert.equal(uploadFileProblem("task", "work.docx", 12), "");
  assert.match(uploadFileProblem("agreement", "work.docx", 12), /Unsupported/);
  assert.match(uploadFileProblem("registration", "receipt.pdf", 4 * 1024 * 1024 + 1), /too large/i);
});
test("signed upload is bound to its purpose, scope, owner and uploaded size", async () => {
  uploadedSize = 7;
  const { token } = await uploads.createDirectUpload("task", "task-a", "student-a", "answer.pdf", 7);
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
});
