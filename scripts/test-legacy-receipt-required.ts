import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const file = (name: string) => pathToFileURL(path.resolve(__dirname, name)).href;
let calls = 0;
mock.module(file("../lib/auth/session.ts"), { namedExports: { getCurrentUser: async () => ({ id: "user" }) } });
mock.module(file("../lib/sirah/direct-upload.ts"), { namedExports: {
  verifyDirectUpload: async (token: string, purpose: string, scope: string, owner: string) => {
    assert.deepEqual([purpose, scope, owner], ["legacy-evidence", "registration", "user"]);
    if (token !== "valid") throw new Error("Invalid upload");
    return { key: "uploads/example/receipt.pdf", filename: "receipt.pdf" };
  },
  readDirectUpload: async () => new Uint8Array([1]),
} });
mock.module(file("../services/sirah-receipts.service.ts"), { namedExports: { validateSirahReceipt: async () => ({}) } });
mock.module(file("../services/payment.service.ts"), { namedExports: { submitManualPayment: async (input: { screenshotUrl: string }) => { assert.equal(input.screenshotUrl, "uploads/example/receipt.pdf"); calls++; return { ok: true }; } } });
let post: typeof import("../app/api/payments/manual/submit/route").POST;
before(async () => { ({ POST: post } = await import("../app/api/payments/manual/submit/route")); });
const payload = { registrationId: "registration", method: "JAZZCASH", senderName: "Sender", referenceKey: "1234" };
const request = (body: object) => new Request("https://example.test/api/payments/manual/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
test("manual submission requires a completed receipt upload and validates its owner", async () => {
  calls = 0;
  const missing = await post(request(payload));
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error, "Please attach your payment receipt to continue.");
  assert.equal(calls, 0);
  assert.equal((await post(request({ ...payload, receiptToken: "invalid" }))).status, 500);
  assert.equal(calls, 0);
  assert.equal((await post(request({ ...payload, receiptToken: "valid" }))).status, 200);
  assert.equal(calls, 1);
});
