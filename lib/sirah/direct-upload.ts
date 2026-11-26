import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { CompleteMultipartUploadCommand, CreateMultipartUploadCommand, GetObjectCommand, HeadObjectCommand, ListPartsCommand, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createSpacesClient, safeFilename, spacesConfig } from "./spaces";
import { uploadFileProblem, uploadFileType, type UploadPurpose } from "./direct-upload-policy";
import { SirahError } from "@/services/sirah-registration.service";

type Claim = { key: string; uploadId: string; purpose: UploadPurpose; scope: string; owner: string; filename: string; type: string; size: number; exp: number };
function secret() { const key = process.env.SIRAH_UPLOAD_TOKEN_SECRET?.trim(); if (!key || key.length < 32) throw new SirahError("File uploads are not configured.", 503); return key; }
function storage() { const config = spacesConfig(); if (!config) throw new SirahError("File uploads are not configured.", 503); return { client: createSpacesClient(config), bucket: config.bucket }; }
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
  const type = uploadFileType(filename), key = `sirah/direct/${randomUUID()}/${safeFilename(filename)}`;
  const { client, bucket } = storage();
  const created = await client.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: type }));
  if (!created.UploadId) throw new SirahError("Could not start upload. Please try again.", 503);
  const claim: Claim = { key, uploadId: created.UploadId, purpose, scope, owner, filename: filename.slice(0, 191), type, size, exp: Date.now() + 30 * 60_000 };
  const url = await getSignedUrl(client, new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: claim.uploadId, PartNumber: 1, ContentLength: size }), { expiresIn: 15 * 60, signableHeaders: new Set(["content-length"]) });
  return { url, token: sign(claim) };
}
export async function verifyDirectUpload(token: string, purpose: UploadPurpose, scope: string, owner: string) {
  const claim = decode(token);
  if (claim.purpose !== purpose || claim.scope !== scope || claim.owner !== owner || uploadFileProblem(purpose, claim.filename, claim.size) || uploadFileType(claim.filename) !== claim.type || !/^sirah\/direct\/[0-9a-f-]{36}\/[\w.-]{1,100}$/.test(claim.key)) throw new SirahError("Upload is not valid for this form.");
  const { client, bucket } = storage();
  try {
    const parts = await client.send(new ListPartsCommand({ Bucket: bucket, Key: claim.key, UploadId: claim.uploadId }));
    if (parts.Parts?.length !== 1 || parts.Parts[0].PartNumber !== 1 || parts.Parts[0].Size !== claim.size || !parts.Parts[0].ETag) throw new SirahError("Upload did not finish. Please retry.");
    await client.send(new CompleteMultipartUploadCommand({ Bucket: bucket, Key: claim.key, UploadId: claim.uploadId, MultipartUpload: { Parts: [{ PartNumber: 1, ETag: parts.Parts[0].ETag }] } }));
  } catch (error) {
    if (error instanceof SirahError) throw error;
    if ((error as { name?: string }).name !== "NoSuchUpload") throw new SirahError("Upload could not be verified. Please retry.");
  }
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: claim.key }));
  if (head.ContentLength !== claim.size || head.ContentType !== claim.type) throw new SirahError("Upload could not be verified. Please retry.");
  return claim;
}
export async function readDirectUpload(key: string) {
  const { client, bucket } = storage();
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body) throw new SirahError("Upload could not be read.");
  return object.Body.transformToByteArray();
}
