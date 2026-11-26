import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CompleteMultipartUploadCommand, CreateMultipartUploadCommand, GetObjectCommand, HeadObjectCommand, ListPartsCommand } from "@aws-sdk/client-s3";

const file = (relative: string) => pathToFileURL(path.resolve(__dirname, relative)).href;
class TestError extends Error { constructor(message: string, public status = 400) { super(message); } }
let completed = false, key = "", storedReceipt: { storageKey: string; data: Buffer; mime: string } | undefined;
const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const client = { send: async (command: unknown) => {
  if (command instanceof CreateMultipartUploadCommand) { key = command.input.Key!; return { UploadId: "upload-a" }; }
  if (command instanceof HeadObjectCommand) { if (!completed) throw Object.assign(new Error(), { name: "NotFound", $metadata: { httpStatusCode: 404 } }); assert.equal(command.input.Key, key); return { ContentLength: bytes.length, ContentType: "image/jpeg" }; }
  if (command instanceof ListPartsCommand) { if (completed) throw Object.assign(new Error(), { name: "NoSuchKey" }); return { Parts: [{ PartNumber: 1, Size: bytes.length, ETag: '"tag"' }] }; }
  if (command instanceof CompleteMultipartUploadCommand) { completed = true; return {}; }
  if (command instanceof GetObjectCommand) { assert.equal(command.input.Key, key); return { Body: { transformToByteArray: async () => bytes } }; }
  throw new Error("Unexpected command");
} };
mock.module("server-only", { namedExports: {} });
mock.module(file("../lib/sirah/spaces.ts"), { namedExports: { createSpacesClient: () => client, safeFilename: (name: string) => name.replace(/[^\w.-]+/g, "-"), contentDisposition: () => "attachment" } });
mock.module("@aws-sdk/s3-request-presigner", { namedExports: { getSignedUrl: async () => "https://example.invalid/upload" } });
mock.module(file("../services/sirah-registration.service.ts"), { namedExports: {
  SirahError: TestError,
  registerSirah: async (_input: unknown, _user: unknown, payment: { manual: { receipt: typeof storedReceipt } }) => { storedReceipt = payment.manual.receipt; return { orderId: "order-a", userId: "student-a", existing: false }; },
  publicSirahOrder: async () => ({ id: "order-a" }),
} });
mock.module(file("../services/sirah-receipts.service.ts"), { namedExports: { validateSirahReceipt: async (data: Uint8Array, filename: string) => ({ data: Buffer.from(data), filename, mime: "image/jpeg", sha256: "test-hash" }) } });
mock.module(file("../lib/sirah/readiness.ts"), { namedExports: { sirahSchemaAvailable: async () => true } });
mock.module(file("../lib/auth/session.ts"), { namedExports: { getCurrentUser: async () => null, attachSessionCookie: async () => {} } });
mock.module(file("../lib/sirah/registration-payment.ts"), { namedExports: { sirahPaymentRegistrationSchema: { safeParse: (data: unknown) => ({ success: true, data }) } } });
mock.module(file("../lib/sirah/http.ts"), { namedExports: { checkSirahOrigin: () => {}, sirahUser: async () => null, privateJson: (body: unknown) => Response.json(body), sirahResponseError: (error: TestError) => Response.json({ error: error.message }, { status: error.status || 500 }) } });
mock.module(file("../lib/sirah/rate-limit.ts"), { namedExports: { sirahClientIp: () => "test", sirahRateLimit: () => null, MINUTE: 60000, HOUR: 3600000 } });
let submittedForm: FormData;
mock.module(file("../lib/sirah/multipart.ts"), { namedExports: { readSirahMultipart: async () => submittedForm } });
let upload: typeof import("../lib/sirah/direct-upload"), route: typeof import("../app/api/sirah/orders/route");
before(async () => {
  Object.assign(process.env, { SIRAH_UPLOAD_TOKEN_SECRET: "test-only-secret-that-is-long-enough", SPACES_ENDPOINT: "https://example.invalid", SPACES_REGION: "test", SPACES_BUCKET: "recordings", SPACES_ACCESS_KEY: "test", SPACES_SECRET_KEY: "test" });
  upload = await import("../lib/sirah/direct-upload");
  route = await import("../app/api/sirah/orders/route");
});
test("registration attaches the same already-verified Spaces object", async () => {
  const scope = "registration-a";
  const { token } = await upload.createDirectUpload("registration", scope, scope, "WhatsApp Image.jpeg", bytes.length);
  await upload.verifyDirectUpload(token, "registration", scope, scope);
  submittedForm = new FormData();
  submittedForm.set("details", JSON.stringify({ requestKey: scope, manualPayment: { method: "BANK_TRANSFER" } }));
  submittedForm.set("receiptToken", token);
  const response = await route.POST(new Request("https://example.test/api/sirah/orders", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=test" }, body: "" }));
  assert.equal(response.status, 200);
  assert.equal(storedReceipt?.storageKey, key);
  assert.equal(storedReceipt?.data.length, 0);
  assert.equal(storedReceipt?.mime, "image/jpeg");
});
