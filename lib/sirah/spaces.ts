import "server-only";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** DigitalOcean Spaces (S3-compatible) for classroom uploads. The bucket stays
 * private: nothing here produces a public URL. Students only ever receive a
 * short-lived presigned GET, issued by the enrolment-checked file route. */

const ENV = ["SIRAH_SPACES_ENDPOINT", "SIRAH_SPACES_REGION", "SIRAH_SPACES_BUCKET", "SIRAH_SPACES_KEY", "SIRAH_SPACES_SECRET"] as const;

export type SpacesConfig = { endpoint: string; region: string; bucket: string; key: string; secret: string };

export function spacesConfig(env: NodeJS.ProcessEnv = process.env): SpacesConfig | null {
  const values = ENV.map((name) => env[name]?.trim() || "");
  if (values.some((value) => !value)) return null;
  const [endpoint, region, bucket, key, secret] = values;
  return { endpoint, region, bucket, key, secret };
}

export const spacesConfigured = () => spacesConfig() !== null;

let cached: { client: S3Client; bucket: string } | null = null;

function connection() {
  if (cached) return cached;
  const config = spacesConfig();
  if (!config) throw new Error("Spaces is not configured.");
  cached = { client: createSpacesClient(config), bucket: config.bucket };
  return cached;
}

export function createSpacesClient(config: SpacesConfig) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.key, secretAccessKey: config.secret },
    // Recent SDKs add CRC32 checksum headers to every PUT by default. A browser
    // uploading to a presigned URL cannot send them, and Spaces does not use
    // them, so only add checksums where an operation requires one.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

/* ---------- Upload rules ---------- */

export const UPLOAD_PREFIX = "sirah/classroom/";
const MB = 1024 * 1024;
/** 5 GB is the single-PUT ceiling of S3 and Spaces. */
export const MAX_RECORDING_BYTES = 5 * 1024 * MB;
export const MAX_DOCUMENT_BYTES = 200 * MB;

const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/epub+zip",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const MEDIA_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav"]);

/** Which files a material of this kind may be. Recordings are audio/video;
 * everything else is a document. Returns an error message or null. */
export function uploadProblem(kind: string, contentType: string, size: number) {
  const recording = kind === "RECORDING";
  if (recording ? !MEDIA_TYPES.has(contentType) : !DOCUMENT_TYPES.has(contentType))
    return recording
      ? "A recording must be an MP4, WebM, MOV, MP3, M4A or WAV file."
      : "Upload a PDF, PowerPoint, Word, EPUB, text or image file.";
  if (!Number.isFinite(size) || size <= 0) return "That file is empty.";
  const limit = recording ? MAX_RECORDING_BYTES : MAX_DOCUMENT_BYTES;
  if (size > limit) return `That file is larger than ${recording ? "5 GB" : "200 MB"}.`;
  return null;
}

/** A filename safe for an object key: ASCII letters, digits, dot, dash. */
export function safeFilename(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(-100);
  return cleaned || "file";
}

/** Keys are ours alone: the prefix, a random folder, then the filename. */
export const newObjectKey = (filename: string) => `${UPLOAD_PREFIX}${randomUUID()}/${safeFilename(filename)}`;
export const isClassroomObjectKey = (key: string) =>
  key.length <= 191 && /^sirah\/classroom\/[0-9a-f-]{36}\/[\w.-]{1,100}$/.test(key);

/* ---------- Presigning ---------- */

export const UPLOAD_URL_SECONDS = 15 * 60;
export const DOCUMENT_URL_SECONDS = 10 * 60;
/** A recording plays for an hour or more and the browser keeps reading it by
 * range, so its link lives a little longer than a document's. */
export const RECORDING_URL_SECONDS = 3 * 60 * 60;

export async function presignUpload(key: string, contentType: string, client = connection()) {
  return getSignedUrl(client.client, new PutObjectCommand({ Bucket: client.bucket, Key: key, ContentType: contentType }), {
    expiresIn: UPLOAD_URL_SECONDS,
  });
}

/** RFC 6266 Content-Disposition with an ASCII fallback and the UTF-8 name. */
export function contentDisposition(filename: string, inline: boolean) {
  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export type FileSigner = (input: { key: string; contentType: string | null; filename: string | null; expiresIn: number }) => Promise<string>;

export const presignDownload: FileSigner = async ({ key, contentType, filename, expiresIn }) => {
  const client = connection();
  return getSignedUrl(
    client.client,
    new GetObjectCommand({
      Bucket: client.bucket,
      Key: key,
      ResponseContentType: contentType || undefined,
      ResponseContentDisposition: contentDisposition(filename || key.split("/").pop() || "file", true),
      ResponseCacheControl: "private, max-age=0, no-store",
    }),
    { expiresIn },
  );
};

/** The stored object's real size and type, or null if it is not there. */
export async function headObject(key: string) {
  const client = connection();
  try {
    const head = await client.client.send(new HeadObjectCommand({ Bucket: client.bucket, Key: key }));
    return { size: head.ContentLength ?? 0, contentType: head.ContentType ?? null };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || status === 403) return null;
    throw error;
  }
}

export async function deleteObject(key: string) {
  const client = connection();
  await client.client.send(new DeleteObjectCommand({ Bucket: client.bucket, Key: key }));
}
