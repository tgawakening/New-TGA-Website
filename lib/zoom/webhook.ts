import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Zoom webhook verification (signature scheme v0).
 *
 *   x-zm-signature = "v0=" + hex(HMAC-SHA256(secret, `v0:${x-zm-request-timestamp}:${rawBody}`))
 *
 * The signature is computed over the exact raw request body, so callers must
 * pass the body text before any JSON parsing.
 */

export const ZOOM_SIGNATURE_HEADER = "x-zm-signature";
export const ZOOM_TIMESTAMP_HEADER = "x-zm-request-timestamp";
export const MAX_EVENT_AGE_SECONDS = 5 * 60;

export type ZoomWebhookBody = {
  event: string;
  event_ts?: number;
  payload?: {
    plainToken?: string;
    account_id?: string;
    object?: { uuid?: string; id?: string | number; participant?: { participant_uuid?: string; user_id?: string } } & Record<string, unknown>;
  } & Record<string, unknown>;
};

export type SignatureCheck =
  | { ok: true }
  | { ok: false; reason: "missing_headers" | "bad_timestamp" | "stale" | "bad_signature" };

function hmacHex(secret: string, message: string) {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // timingSafeEqual requires equal lengths; compare against self to keep timing flat.
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function signZoomPayload(secret: string, timestamp: string, rawBody: string) {
  return `v0=${hmacHex(secret, `v0:${timestamp}:${rawBody}`)}`;
}

/**
 * Verify a delivery. Rejects requests whose signed timestamp is more than five
 * minutes from now (either direction), which blocks replays of captured
 * requests. Zoom stamps each retry with a fresh request timestamp, so genuine
 * retries still pass and are then de-duplicated by dedupeKey.
 */
export function verifyZoomSignature(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  nowMs?: number;
}): SignatureCheck {
  const { rawBody, signature, timestamp, secret } = input;
  if (!signature || !timestamp) return { ok: false, reason: "missing_headers" };
  if (!/^\d{1,13}$/.test(timestamp)) return { ok: false, reason: "bad_timestamp" };
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_EVENT_AGE_SECONDS) return { ok: false, reason: "stale" };
  return safeEqual(signZoomPayload(secret, timestamp, rawBody), signature) ? { ok: true } : { ok: false, reason: "bad_signature" };
}

/** Zoom's plainToken is a short URL-safe string; anything else is refused. */
const PLAIN_TOKEN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Response to endpoint.url_validation. Returns null for a malformed
 * plainToken, so the endpoint can never be used to HMAC arbitrary text
 * (for example a forged "v0:<ts>:<body>" signature message).
 */
export function urlValidationResponse(plainToken: unknown, secret: string) {
  if (typeof plainToken !== "string" || !PLAIN_TOKEN.test(plainToken)) return null;
  return { plainToken, encryptedToken: hmacHex(secret, plainToken) };
}

/**
 * Stable key for one logical event: SHA-256 of event, event_ts and
 * payload.object.uuid. For participant events the participant's id is added,
 * so two people joining in the same millisecond are not merged into one.
 */
export function zoomDedupeKey(body: ZoomWebhookBody): string {
  const object = body.payload?.object;
  const participant = object?.participant;
  const parts = [body.event, String(body.event_ts ?? ""), String(object?.uuid ?? "")];
  const participantId = participant?.participant_uuid ?? participant?.user_id;
  if (participantId) parts.push(String(participantId));
  return createHash("sha256").update(parts.join("\u001f"), "utf8").digest("hex");
}

/** Narrow an unknown JSON value to the minimal webhook shape. */
export function asZoomWebhookBody(value: unknown): ZoomWebhookBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.event !== "string" || !body.event) return null;
  if (body.payload !== undefined && (typeof body.payload !== "object" || body.payload === null)) return null;
  return body as ZoomWebhookBody;
}
