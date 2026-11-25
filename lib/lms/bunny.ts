import "server-only";
import { createHash } from "crypto";
import { LmsContentError } from "./content";

/**
 * Protected Bunny Stream playback. A recording stores only the Bunny video
 * GUID; students get an embed URL signed here, on the server, per request.
 *
 * Bunny's embed token authentication: token = SHA256_HEX(tokenAuthKey +
 * videoId + expires), expires in UNIX seconds. Together with the library's
 * allowed-referrer domain lock, a copied embed URL stops working at
 * `expires` and does not play on another site. BUNNY_STREAM_TOKEN_AUTH_KEY
 * and BUNNY_STREAM_API_KEY are read only in this module and never leave the
 * server.
 */

/** How long a signed embed URL can be opened. A fresh one is issued each time the player opens. */
export const BUNNY_EMBED_TOKEN_SECONDS = 14400;

const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const EXACT_GUID = new RegExp(`^${GUID.source}$`, "i");

export class BunnyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BunnyConfigError";
  }
}

function env(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function libraryId() {
  const id = env("BUNNY_STREAM_LIBRARY_ID");
  return id && /^\d+$/.test(id) ? id : null;
}

/** Whether protected playback can be signed on this server. */
export function bunnyConfigured() {
  return Boolean(libraryId() && env("BUNNY_STREAM_TOKEN_AUTH_KEY"));
}

/** Whether admins can upload files straight to the library (needs the API key too). */
export function bunnyUploadConfigured() {
  return bunnyConfigured() && Boolean(env("BUNNY_STREAM_API_KEY"));
}

/** Accepts a bare GUID or any Bunny URL containing one; returns the lowercase GUID. */
export function cleanBunnyVideoId(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) throw new LmsContentError("Paste the Bunny video ID.");
  const match = raw.length <= 1024 ? raw.match(GUID) : null;
  if (!match) throw new LmsContentError("That is not a Bunny video ID. Copy the video's ID (for example 1a2b3c4d-…) from the Bunny Stream library.");
  return match[0].toLowerCase();
}

/**
 * When BUNNY_STREAM_API_KEY is set, confirm the video exists in this library
 * before it is saved, so a mistyped ID is caught by the admin, not a student.
 */
export async function verifyBunnyVideo(videoId: string) {
  const library = libraryId();
  if (!library || !env("BUNNY_STREAM_TOKEN_AUTH_KEY")) throw new LmsContentError("Bunny video is not configured on this server yet. Use a public link, or ask for Bunny Stream to be set up.");
  const apiKey = env("BUNNY_STREAM_API_KEY");
  if (!apiKey) return;
  let response: Response;
  try {
    response = await fetch(`https://video.bunnycdn.com/library/${library}/videos/${videoId}`, {
      headers: { AccessKey: apiKey, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new LmsContentError("Could not reach Bunny to check that video. Please try again.");
  }
  if (response.status === 404) throw new LmsContentError("No video with that ID is in the Bunny library.");
  if (!response.ok) throw new LmsContentError("Bunny could not confirm that video. Please try again.");
}

/** A short-lived, token-signed embed URL. Server-side only. */
export function signedBunnyEmbed(videoId: string, now = new Date()) {
  const library = libraryId();
  const key = env("BUNNY_STREAM_TOKEN_AUTH_KEY");
  if (!library || !key) throw new BunnyConfigError("Bunny Stream is not configured.");
  if (!EXACT_GUID.test(videoId)) throw new BunnyConfigError("Stored Bunny video ID is malformed.");
  const expires = Math.floor(now.getTime() / 1000) + BUNNY_EMBED_TOKEN_SECONDS;
  const token = createHash("sha256").update(`${key}${videoId}${expires}`).digest("hex");
  const url = new URL(`https://iframe.mediadelivery.net/embed/${library}/${videoId}`);
  url.searchParams.set("token", token);
  url.searchParams.set("expires", String(expires));
  return { src: url.toString(), expiresAt: new Date(expires * 1000) };
}

/** Bunny's poster image. If the CDN requires a token it fails to load and the branded card shows instead. */
export function bunnyThumbnailUrl(videoId: string) {
  const host = env("BUNNY_STREAM_CDN_HOSTNAME")?.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return host && /^[a-z0-9.-]+$/i.test(host) && EXACT_GUID.test(videoId) ? `https://${host}/${videoId}/thumbnail.jpg` : null;
}

/**
 * How long a direct-upload authorization stays valid. It is scoped to the
 * one video just created, and long enough for a multi-GB file on a slow
 * connection to finish or resume.
 */
export const BUNNY_UPLOAD_AUTH_SECONDS = 12 * 60 * 60;
export const BUNNY_TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";

export type BunnyUploadTicket = { endpoint: string; libraryId: string; videoId: string; expires: number; signature: string };

/**
 * Creates an empty video in the library with the API key (server-side), then
 * signs a TUS upload authorization for that video only:
 * SHA256_HEX(libraryId + apiKey + expires + videoId). The browser uploads the
 * file straight to Bunny with it; the API key never leaves the server, and the
 * signature cannot be used for any other video or any other API call.
 */
export async function createBunnyUpload(title: string, now = new Date()): Promise<BunnyUploadTicket> {
  const library = libraryId();
  const apiKey = env("BUNNY_STREAM_API_KEY");
  if (!library || !apiKey || !env("BUNNY_STREAM_TOKEN_AUTH_KEY")) throw new LmsContentError("Direct upload needs Bunny Stream to be configured on this server (library ID, API key and token key).");
  let response: Response;
  try {
    response = await fetch(`https://video.bunnycdn.com/library/${library}/videos`, {
      method: "POST",
      headers: { AccessKey: apiKey, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.slice(0, 191) || "Recording" }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new LmsContentError("Could not reach Bunny to start the upload. Please try again.");
  }
  const body = (await response.json().catch(() => null)) as { guid?: unknown } | null;
  const videoId = response.ok && typeof body?.guid === "string" && EXACT_GUID.test(body.guid) ? body.guid.toLowerCase() : null;
  if (!videoId) throw new LmsContentError("Bunny did not accept the new video. Please try again.");
  const expires = Math.floor(now.getTime() / 1000) + BUNNY_UPLOAD_AUTH_SECONDS;
  const signature = createHash("sha256").update(`${library}${apiKey}${expires}${videoId}`).digest("hex");
  return { endpoint: BUNNY_TUS_ENDPOINT, libraryId: library, videoId, expires, signature };
}

/** The route that issues a fresh signed embed for one recording. */
export const bunnyEmbedPath = (resourceId: string) => `/api/sirah/lms/bunny-embed/${encodeURIComponent(resourceId)}`;
