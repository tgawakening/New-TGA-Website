import "server-only";
import { createCipheriv, createHash } from "node:crypto";
import {
  PDFArray,
  PDFBool,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFDocument,
  PDFString,
} from "pdf-lib";

/**
 * Loads a PDF and reports whether it opens without a password, plus its page
 * count when it does. Loading happens here so the object checks below always
 * use the same pdf-lib instance that parsed the file. Throws if unparseable.
 */
export async function inspectPdf(data: Uint8Array) {
  const document = await PDFDocument.load(data, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const access = pdfOpenAccess(document);
  const opens = access === "NONE" || access === "PERMISSIONS_ONLY";
  return { access, pages: opens ? document.getPageCount() : null };
}

/**
 * How a PDF can be opened.
 * - NONE: not encrypted.
 * - PERMISSIONS_ONLY: encrypted, but the empty user password opens it. These
 *   are "owner password" PDFs that only restrict printing/copying/editing —
 *   typical of bank and wallet e-receipts. Anyone (including staff) can view it.
 * - PASSWORD_REQUIRED: a real user password is needed to open the document.
 * - UNSUPPORTED: a non-standard or malformed security handler we cannot assess.
 */
export type PdfOpenAccess =
  | "NONE"
  | "PERMISSIONS_ONLY"
  | "PASSWORD_REQUIRED"
  | "UNSUPPORTED";

// PDF 32000-1 §7.6.3.3, Algorithm 2 padding string.
const PAD = Buffer.from(
  "28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A",
  "hex",
);

// RC4 is not in OpenSSL 3's default provider, so it is implemented here. It is
// only used to verify the standard handler's password check, not to decrypt.
function rc4(key: Buffer, data: Buffer) {
  const s = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = Buffer.alloc(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
    out[n] = data[n] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

const md5 = (...parts: Buffer[]) =>
  createHash("md5").update(Buffer.concat(parts)).digest();

// Algorithm 2.B (ISO 32000-2), revision 6, with the given password and salt.
function hash2B(password: Buffer, salt: Buffer, userData: Buffer) {
  let k = createHash("sha256")
    .update(Buffer.concat([password, salt, userData]))
    .digest();
  for (let round = 0; ; ) {
    const block = Buffer.concat([password, k, userData]);
    const k1 = Buffer.concat(Array<Buffer>(64).fill(block));
    const cipher = createCipheriv(
      "aes-128-cbc",
      k.subarray(0, 16),
      k.subarray(16, 32),
    ).setAutoPadding(false);
    const e = Buffer.concat([cipher.update(k1), cipher.final()]);
    let mod3 = 0;
    for (let i = 0; i < 16; i++) mod3 += e[i];
    k = createHash(["sha256", "sha384", "sha512"][mod3 % 3])
      .update(e)
      .digest();
    round++;
    if (round >= 64 && e[e.length - 1] <= round - 32) break;
  }
  return k.subarray(0, 32);
}

function bytesOf(value: unknown) {
  return value instanceof PDFString || value instanceof PDFHexString
    ? Buffer.from(value.asBytes())
    : null;
}

/** Tests whether the empty user password opens the document (Standard handler). */
export function pdfOpenAccess(document: PDFDocument): PdfOpenAccess {
  const { context } = document;
  if (!context.trailerInfo.Encrypt) return "NONE";
  try {
    const dict = context.lookup(context.trailerInfo.Encrypt);
    if (!(dict instanceof PDFDict)) return "UNSUPPORTED";
    if (dict.lookup(PDFName.of("Filter")) !== PDFName.of("Standard"))
      return "UNSUPPORTED";
    const number = (key: string) => {
      const value = dict.lookup(PDFName.of(key));
      return value instanceof PDFNumber ? value.asNumber() : undefined;
    };
    const revision = number("R");
    const permissions = number("P");
    const owner = bytesOf(dict.lookup(PDFName.of("O")));
    const user = bytesOf(dict.lookup(PDFName.of("U")));
    if (!revision || permissions === undefined || !owner || !user)
      return "UNSUPPORTED";

    if (revision === 5 || revision === 6) {
      if (user.length < 48) return "UNSUPPORTED";
      const validationSalt = user.subarray(32, 40);
      const expected = user.subarray(0, 32);
      const computed =
        revision === 5
          ? createHash("sha256").update(validationSalt).digest()
          : hash2B(Buffer.alloc(0), validationSalt, Buffer.alloc(0));
      return computed.equals(expected) ? "PERMISSIONS_ONLY" : "PASSWORD_REQUIRED";
    }
    if (revision < 2 || revision > 4 || user.length < 32 || owner.length < 32)
      return "UNSUPPORTED";

    const ids = context.lookup(context.trailerInfo.ID);
    const firstId =
      (ids instanceof PDFArray && bytesOf(ids.lookup(0))) || Buffer.alloc(0);
    const p = Buffer.alloc(4);
    p.writeInt32LE(permissions | 0);
    const length = number("Length");
    const keyBytes =
      revision === 2
        ? 5
        : revision === 4
          ? 16
          : Math.min(16, Math.max(5, Math.floor((length ?? 40) / 8)));
    const metadataUnencrypted =
      revision >= 4 &&
      dict.lookup(PDFName.of("EncryptMetadata")) instanceof PDFBool &&
      !(dict.lookup(PDFName.of("EncryptMetadata")) as PDFBool).asBoolean();

    // Algorithm 2: file key from the (empty, padded) user password.
    let key = md5(
      PAD,
      owner.subarray(0, 32),
      p,
      firstId,
      metadataUnencrypted ? Buffer.from([255, 255, 255, 255]) : Buffer.alloc(0),
    );
    if (revision >= 3)
      for (let i = 0; i < 50; i++) key = md5(key.subarray(0, keyBytes));
    key = key.subarray(0, keyBytes);

    // Algorithms 4/5: recompute U and compare.
    if (revision === 2)
      return rc4(key, PAD).equals(user.subarray(0, 32))
        ? "PERMISSIONS_ONLY"
        : "PASSWORD_REQUIRED";
    let check = rc4(key, md5(PAD, firstId));
    for (let i = 1; i <= 19; i++)
      check = rc4(
        Buffer.from(key.map((byte) => byte ^ i)),
        check,
      );
    return check.equals(user.subarray(0, 16))
      ? "PERMISSIONS_ONLY"
      : "PASSWORD_REQUIRED";
  } catch {
    return "UNSUPPORTED";
  }
}
