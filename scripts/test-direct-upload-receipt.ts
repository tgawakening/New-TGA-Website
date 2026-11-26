import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { uploadFileProblem, uploadFileType } from "../lib/sirah/direct-upload-policy";
import { validateSirahReceipt } from "../services/sirah-receipts.service";

test("a normal WhatsApp-style JPEG is allowed and passes receipt content validation", async () => {
  const jpeg = await sharp({ create: { width: 128, height: 128, channels: 3, background: "white" } }).jpeg().toBuffer();
  const filename = "WhatsApp Image 2026-11-26 at 10.42.20.jpeg";
  assert.equal(uploadFileType(filename), "image/jpeg");
  assert.equal(uploadFileProblem("registration", filename, jpeg.length), "");
  assert.equal((await validateSirahReceipt(jpeg, filename)).mime, "image/jpeg");
  assert.match(uploadFileProblem("registration", filename, 4 * 1024 * 1024 + 1), /too large/i);
});
