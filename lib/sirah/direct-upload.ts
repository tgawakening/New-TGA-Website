import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { CompleteMultipartUploadCommand, CreateMultipartUploadCommand, GetObjectCommand, HeadObjectCommand, ListPartsCommand, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { contentDisposition, createSpacesClient, safeFilename, type FileSigner } from "./spaces";
import { recordingSpacesConfig, RecordingStorageConfigError } from "@/lib/lms/recording-storage";
import { uploadFileProblem, uploadFileType, type UploadPurpose } from "./direct-upload-policy";
import { SirahError } from "@/services/sirah-registration.service";

type Claim = { key: string; uploadId: string; purpose: UploadPurpose; scope: string; owner: string; filename: string; type: string; size: number; exp: number };
type StorageError = { name?: string; Code?: string; code?: string; $metadata?: { httpStatusCode?: number } };
function missingStorageObject(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const e = error as StorageError;
  return [e.name, e.Code, e.code].some(code => code === "NoSuchUpload" || code === "NoSuchKey" || code === "NotFound") || e.$metadata?.httpStatusCode === 404;
}
function logVerificationError(stage: string, error: unknown) {
  const e = error && typeof error === "object" ? error as StorageError : {};
  const code = [e.name, e.Code, e.code].find(value => typeof value === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(value));
  // Never log object keys, filenames, upload tokens, request bodies, or credentials.
  console.error("[direct-upload] verification failed", { stage, code: code ?? "unknown", status: e.$metadata?.httpStatusCode });
}
function secret() { const key = process.env.SIRAH_UPLOAD_TOKEN_SECRET?.trim(); if (!key || key.length < 32) throw new SirahError("File uploads are not configured.", 503); return key; }
function storage() {
  try {
    const config = recordingSpacesConfig();
    return { client: createSpacesClient(config), bucket: config.bucket };
  } catch (error) {
    if (error instanceof RecordingStorageConfigError) throw new SirahError("File uploads are not configured.", 503);
    throw error;
  }
}
function sign(claim: Claim) { const payload = Buffer.from(JSON.stringify(claim)).toString("base64url"); return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`; }
function decode(token: string): Claim {
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra || token.length > 8192) throw new SirahError("Upload expired. Please select the file again.");
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(mac, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new SirahError("Upload expired. Please select the file again.");
  let claim: Claim;
  try { claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw new SirahError("Upload expired. Please select the file again."); }
  if (!claim.exp || claim.exp < Date.now()) throw new SirahError("Upload expired. Please select the file again.");
  return claim;
}
export async function createDirectUpload(purpose: UploadPurpose, scope: string, owner: string, filename: string, size: number) {
  const problem = uploadFileProblem(purpose, filename, size); if (problem) throw new SirahError(problem);
  secret();
  const type = uploadFileType(filename), key = `uploads/${randomUUID()}/${safeFilename(filename)}`;
  const { client, bucket } = storage();
  const created = await client.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: type }));
  if (!created.UploadId) throw new SirahError("Could not start upload. Please try again.", 503);
  const claim: Claim = { key, uploadId: created.UploadId, purpose, scope, owner, filename: filename.slice(0, 191), type, size, exp: Date.now() + 30 * 60_000 };
  const url = await getSignedUrl(client, new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: claim.uploadId, PartNumber: 1, ContentLength: size }), { expiresIn: 15 * 60, signableHeaders: new Set(["content-length"]) });
  return { url, token: sign(claim) };
}
export async function verifyDirectUpload(token: string, purpose: UploadPurpose, scope: string, owner: string) {
  const claim = decode(token);
  if (claim.purpose !== purpose || claim.scope !== scope || claim.owner !== owner || uploadFileProblem(purpose, claim.filename, claim.size) || uploadFileType(claim.filename) !== claim.type || !/^uploads\/[0-9a-f-]{36}\/[\w.-]{1,100}$/.test(claim.key)) throw new SirahError("Upload is not valid for this form.");
  const { client, bucket } = storage();
  async function head() {
    try { return await client.send(new HeadObjectCommand({ Bucket: bucket, Key: claim.key })); }
    catch (error) {
      if (missingStorageObject(error)) return null;
      logVerificationError("head", error);
      throw new SirahError("Upload could not be verified. Please retry.");
    }
  }
  function verifyHead(object: { ContentLength?: number; ContentType?: string }) {
    if (object.ContentLength !== claim.size || object.ContentType !== claim.type) {
      console.error("[direct-upload] verification failed", { stage: "metadata", sizeMatches: object.ContentLength === claim.size, typeMatches: object.ContentType === claim.type });
      throw new SirahError("Upload could not be verified. Please retry.");
    }
  }
  // Completion already happens before the UI shows Uploaded. Subsequent form
  // submission verifies the finished object directly, without listing parts
  // for an upload ID that Spaces has already removed.
  const existing = await head();
  if (existing) { verifyHead(existing); return claim; }
  try {
    const parts = await client.send(new ListPartsCommand({ Bucket: bucket, Key: claim.key, UploadId: claim.uploadId }));
    if (parts.Parts?.length !== 1 || parts.Parts[0].PartNumber !== 1 || parts.Parts[0].Size !== claim.size || !parts.Parts[0].ETag) throw new SirahError("Upload did not finish. Please retry.");
    await client.send(new CompleteMultipartUploadCommand({ Bucket: bucket, Key: claim.key, UploadId: claim.uploadId, MultipartUpload: { Parts: [{ PartNumber: 1, ETag: parts.Parts[0].ETag }] } }));
  } catch (error) {
    if (error instanceof SirahError) throw error;
    if (!missingStorageObject(error)) {
      logVerificationError("multipart", error);
      throw new SirahError("Upload could not be verified. Please retry.");
    }
  }
  // A concurrent completion or delayed visibility can briefly return 404.
  // Never accept a missing object, or one with different size/type.
  for (const delay of [0, 100, 250, 500]) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    const object = await head();
    if (object) { verifyHead(object); return claim; }
  }
  console.error("[direct-upload] verification failed", { stage: "head-after-completion", code: "not-found" });
  throw new SirahError("Upload could not be verified. Please retry.");
}
export async function readDirectUpload(key: string) {
  const { client, bucket } = storage();
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body) throw new SirahError("Upload could not be read.");
  return object.Body.transformToByteArray();
}

/** Downloads use the same bucket as uploads and remain private attachments. */
export const presignPrivateAttachment: FileSigner = async ({ key, filename, expiresIn }) => {
  const { client, bucket } = storage();
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket, Key: key,
    ResponseContentType: "application/octet-stream",
    ResponseContentDisposition: contentDisposition(filename || "file", false),
    ResponseCacheControl: "private, max-age=0, no-store",
  }), { expiresIn });
};
