import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for LMS fields stored at rest (Zoom join URL and
 * passcode). Decrypt only on the server, in the join/start routes.
 *
 * Key: LMS_FIELD_ENCRYPTION_KEY, 32 random bytes as base64 (44 chars) or hex
 * (64 chars). Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 * The key value is never logged or included in error messages.
 *
 * Stored format: v1.<iv>.<tag>.<ciphertext>, each part base64url. The
 * optional context string is bound as additional authenticated data, so a
 * ciphertext copied to another row or field fails to decrypt.
 */

export const LMS_FIELD_KEY_ENV = "LMS_FIELD_ENCRYPTION_KEY";
const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class LmsFieldCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LmsFieldCryptoError";
  }
}

function decodeKey(raw: string): Buffer | null {
  const value = raw.trim();
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, "hex");
  const buffer = Buffer.from(value, "base64");
  return buffer.length === 32 ? buffer : null;
}

/** The 32-byte key. Throws naming the variable (never its value) if missing or malformed. */
export function lmsFieldKey(env: Record<string, string | undefined> = process.env): Buffer {
  const raw = env[LMS_FIELD_KEY_ENV];
  if (!raw?.trim()) throw new LmsFieldCryptoError(`LMS field encryption is not configured: missing or empty ${LMS_FIELD_KEY_ENV}.`);
  const key = decodeKey(raw);
  if (!key) throw new LmsFieldCryptoError(`${LMS_FIELD_KEY_ENV} must be 32 bytes, as base64 (44 chars) or hex (64 chars).`);
  return key;
}

export function encryptField(plaintext: string, context = "", key: Buffer = lmsFieldKey()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptField(stored: string, context = "", key: Buffer = lmsFieldKey()): string {
  const [version, ivPart, tagPart, dataPart, ...rest] = stored.split(".");
  if (version !== VERSION || !ivPart || !tagPart || dataPart === undefined || rest.length)
    throw new LmsFieldCryptoError("Encrypted LMS field has an unknown format.");
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new LmsFieldCryptoError("Encrypted LMS field has an unknown format.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new LmsFieldCryptoError("Encrypted LMS field could not be decrypted (wrong key, context or tampered data).");
  }
}

/** AAD context for an LmsSession field, binding ciphertext to its row and column. */
export const sessionFieldContext = (sessionId: string, field: "joinUrl" | "passcode") => `LmsSession:${sessionId}:${field}`;
