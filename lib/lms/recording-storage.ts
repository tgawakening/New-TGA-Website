import "server-only";
import type { Readable } from "node:stream";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { contentDisposition, createSpacesClient, type SpacesConfig } from "@/lib/sirah/spaces";
import { RECORDING_STREAM_ONLY, RECORDING_UPLOAD_PART_BYTES, RECORDING_UPLOAD_QUEUE_SIZE } from "./recording-policy";

/**
 * Object storage for class recordings: DigitalOcean Spaces (S3-compatible).
 * The bucket stays private. Objects are written by streaming multipart upload
 * (never buffered whole in memory) and read only through short-lived
 * presigned GETs issued by the enrolment-checked play route.
 *
 * Configured by name only; values are never logged or put in errors. When
 * any is unset, recordingStorage() throws RecordingStorageConfigError naming
 * what is missing, and callers stop before touching any asset.
 */
export const RECORDING_STORAGE_ENV_NAMES = [
  "SPACES_ENDPOINT",
  "SPACES_REGION",
  "SPACES_BUCKET",
  "SPACES_ACCESS_KEY",
  "SPACES_SECRET_KEY",
] as const;

export type RecordingStorageEnvName = (typeof RECORDING_STORAGE_ENV_NAMES)[number];

export class RecordingStorageConfigError extends Error {
  constructor(readonly missing: RecordingStorageEnvName[]) {
    super(`Recording storage is not configured: missing or empty ${missing.join(", ")}.`);
    this.name = "RecordingStorageConfigError";
  }
}

/** Names of storage variables that are unset or empty (names only, never values). */
export function missingRecordingStorageEnv(env: NodeJS.ProcessEnv = process.env): RecordingStorageEnvName[] {
  return RECORDING_STORAGE_ENV_NAMES.filter((name) => !env[name]?.trim());
}

/** Shared configuration for private files stored in the recordings bucket. */
export function recordingSpacesConfig(env: NodeJS.ProcessEnv = process.env): SpacesConfig {
  const missing = missingRecordingStorageEnv(env);
  if (missing.length) throw new RecordingStorageConfigError(missing);
  return {
    endpoint: env.SPACES_ENDPOINT!.trim(),
    region: env.SPACES_REGION!.trim(),
    bucket: env.SPACES_BUCKET!.trim(),
    key: env.SPACES_ACCESS_KEY!.trim(),
    secret: env.SPACES_SECRET_KEY!.trim(),
  };
}

/** What the recordings code needs from storage. Tests swap in a fake via recordingStorageRuntime. */
export type RecordingStore = {
  /** The stored object's size, or null when it is not there. */
  head(key: string): Promise<{ size: number } | null>;
  /** Stream `body` into `key` (multipart). Resolves once the object is complete. */
  upload(input: { key: string; body: Readable; contentType: string }): Promise<void>;
  /** A short-lived GET URL that plays inline (never as an attachment). */
  presign(input: { key: string; contentType: string; filename: string; expiresIn: number }): Promise<string>;
};

function s3Store(env: NodeJS.ProcessEnv): RecordingStore {
  const config = recordingSpacesConfig(env);
  const bucket = config.bucket;
  const client = createSpacesClient(config);
  return {
    async head(key) {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { size: head.ContentLength ?? 0 };
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404) return null;
        throw error;
      }
    },
    async upload({ key, body, contentType }) {
      // Holds about partSize x queueSize in memory, whatever the file size.
      const upload = new Upload({
        client,
        params: { Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "private, max-age=0, no-store" },
        partSize: RECORDING_UPLOAD_PART_BYTES,
        queueSize: RECORDING_UPLOAD_QUEUE_SIZE,
        leavePartsOnError: false, // abort the multipart upload on failure: no orphaned parts
      });
      await upload.done();
    },
    async presign({ key, contentType, filename, expiresIn }) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentType: contentType,
          ResponseContentDisposition: contentDisposition(filename, RECORDING_STREAM_ONLY),
          ResponseCacheControl: "private, max-age=0, no-store",
        }),
        { expiresIn },
      );
    },
  };
}

/** How the store is built. Swappable in tests (mocked storage). */
export const recordingStorageRuntime = {
  create: (env: NodeJS.ProcessEnv): RecordingStore => s3Store(env),
};

/** The configured store. Throws RecordingStorageConfigError (names only) when storage is not set up. */
export function recordingStorage(env: NodeJS.ProcessEnv = process.env): RecordingStore {
  const missing = missingRecordingStorageEnv(env);
  if (missing.length) throw new RecordingStorageConfigError(missing);
  return recordingStorageRuntime.create(env);
}
