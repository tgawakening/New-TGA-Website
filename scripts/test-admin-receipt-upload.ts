/**
 * Staff-attached receipts. In-memory only: the database is the fake Prisma and
 * private storage is stubbed; no bucket, database or email is touched. Run with:
 *   node --experimental-test-module-mocks --conditions=react-server --import tsx --test scripts/test-admin-receipt-upload.ts
 */
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test, { before, beforeEach, mock } from "node:test";
import sharp from "sharp";
import { installFakePrisma, table, tables } from "./fixtures/fake-prisma";

installFakePrisma();
const file = (relative: string) => pathToFileURL(path.resolve(__dirname, relative)).href;

// Private storage stub: a signed upload ticket names its key, owner and bytes.
const uploads = new Map<string, { key: string; owner: string; scope: string; filename: string; bytes: Uint8Array }>();
mock.module(file("../lib/sirah/direct-upload.ts"), {
  namedExports: {
    verifyDirectUpload: async (token: string, purpose: string, scope: string, owner: string) => {
      const upload = uploads.get(token);
      if (!upload || purpose !== "admin-evidence" || upload.scope !== scope || upload.owner !== owner) throw new Error("Upload is not valid for this form.");
      return { key: upload.key, filename: upload.filename };
    },
    readDirectUpload: async (key: string) => [...uploads.values()].find((upload) => upload.key === key)!.bytes,
  },
});

let service: typeof import("../services/sirah-receipts.service");
let policy: typeof import("../lib/sirah/direct-upload-policy");
before(async () => {
  service = await import("../services/sirah-receipts.service");
  policy = await import("../lib/sirah/direct-upload-policy");
});

let png: Buffer;
before(async () => { png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "white" } }).png().toBuffer(); });

beforeEach(() => {
  tables.clear(); uploads.clear();
  table("sirahOrder").push({ id: "order-a", userId: "student-a", revision: 1, paymentState: "AWAITING_REVIEW", enrolmentState: "PENDING", archivedAt: null });
  // The student's own earlier receipt (evidence version 1).
  table("sirahReceipt").push({ id: "receipt-student", orderId: "order-a", revision: 1, filename: "own.jpg", mime: "image/jpeg", sha256: "x", data: new Uint8Array(0), storageKey: "uploads/00000000-0000-4000-8000-000000000001/own.jpg", createdAt: new Date() });
});

function ticket(token: string, bytes: Uint8Array, filename = "whatsapp-receipt.png", owner = "admin:staff@example.test") {
  uploads.set(token, { key: `uploads/00000000-0000-4000-8000-00000000000${uploads.size + 2}/${filename}`, owner, scope: "order-a", filename, bytes });
}

test("the staff upload accepts PNG, JPG and PDF up to 5 MB, and nothing else", () => {
  assert.equal(policy.uploadFileProblem("admin-evidence", "receipt.png", 1000), "");
  assert.equal(policy.uploadFileProblem("admin-evidence", "receipt.JPG", 1000), "");
  assert.equal(policy.uploadFileProblem("admin-evidence", "receipt.jpeg", 1000), "");
  assert.equal(policy.uploadFileProblem("admin-evidence", "receipt.pdf", 5 * 1024 * 1024), "");
  assert.match(policy.uploadFileProblem("admin-evidence", "receipt.pdf", 5 * 1024 * 1024 + 1), /too large/i);
  assert.match(policy.uploadFileProblem("admin-evidence", "receipt.webp", 1000), /unsupported/i);
  assert.match(policy.uploadFileProblem("admin-evidence", "receipt.docx", 1000), /unsupported/i);
  // Student limits are unchanged.
  assert.match(policy.uploadFileProblem("evidence", "receipt.png", 4 * 1024 * 1024 + 1), /too large/i);
});

test("file contents are checked, not just the name", async () => {
  const webp = await sharp({ create: { width: 64, height: 64, channels: 3, background: "white" } }).webp().toBuffer();
  await assert.rejects(() => service.validateAdminSirahReceipt(webp, "renamed.png"), /PNG, JPG or PDF/);
  assert.equal((await service.validateAdminSirahReceipt(png, "receipt.png")).mime, "image/png");
  await assert.rejects(() => service.validateAdminSirahReceipt(new Uint8Array(5 * 1024 * 1024 + 1), "big.png"), /up to 5 MB/);
});

test("an attached receipt is stored like a student receipt and audited as staff-uploaded", async () => {
  ticket("t1", png);
  const result = await service.attachAdminSirahReceipt("order-a", "t1", "admin:staff@example.test", "Received on WhatsApp");
  const receipts = table("sirahReceipt").filter((row) => row.orderId === "order-a");
  assert.equal(receipts.length, 2);
  const added = receipts.find((row) => row.id === result.id)!;
  assert.equal(added.revision, 2);
  assert.equal(added.mime, "image/png");
  assert.equal(added.filename, "whatsapp-receipt.png");
  assert.match(String(added.storageKey), /^uploads\//);
  assert.equal((added.data as Uint8Array).byteLength, 0);
  const order = table("sirahOrder")[0];
  assert.equal(order.revision, 2);
  // Evidence only: payment and enrolment are untouched.
  assert.equal(order.paymentState, "AWAITING_REVIEW");
  assert.equal(order.enrolmentState, "PENDING");
  const audit = table("sirahAudit").find((row) => row.action === policy.ADMIN_RECEIPT_UPLOADED)!;
  assert.equal(audit.actor, "admin:staff@example.test");
  assert.equal(audit.orderId, "order-a");
  const detail = audit.detail as Record<string, unknown>;
  assert.equal(detail.receiptId, result.id);
  assert.equal(detail.note, "Received on WhatsApp");
  assert.equal(detail.sizeBytes, png.byteLength);
});

test("a later student submission gets a new evidence version, not a clash", async () => {
  ticket("t1", png);
  const { revision } = await service.attachAdminSirahReceipt("order-a", "t1", "admin:staff@example.test");
  // The student flow writes its receipt at order.revision + 1.
  const nextStudentRevision = Number(table("sirahOrder")[0].revision) + 1;
  assert.ok(nextStudentRevision > revision);
  assert.ok(!table("sirahReceipt").some((row) => row.revision === nextStudentRevision));
});

test("a ticket issued to someone else, a reused ticket, or an archived registration is refused", async () => {
  ticket("other", png, "receipt.png", "reviewer:someone-else@example.test");
  await assert.rejects(() => service.attachAdminSirahReceipt("order-a", "other", "admin:staff@example.test"));
  ticket("t1", png);
  await service.attachAdminSirahReceipt("order-a", "t1", "admin:staff@example.test");
  await assert.rejects(() => service.attachAdminSirahReceipt("order-a", "t1", "admin:staff@example.test"), /already attached/);
  table("sirahOrder")[0].archivedAt = new Date();
  ticket("t2", png);
  await assert.rejects(() => service.attachAdminSirahReceipt("order-a", "t2", "admin:staff@example.test"), /Restore/);
  assert.equal(table("sirahReceipt").length, 2);
  assert.equal(table("sirahAudit").filter((row) => row.action === policy.ADMIN_RECEIPT_UPLOADED).length, 1);
});
