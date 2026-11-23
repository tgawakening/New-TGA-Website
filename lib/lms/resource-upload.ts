import "server-only";
import {
  deleteObject,
  headObject,
  isClassroomObjectKey,
  newObjectKey,
  presignUpload,
  spacesConfigured,
  uploadProblem,
} from "@/lib/sirah/spaces";
import { createFileResource, LmsContentError, type ResourceScope } from "./content";

/**
 * Resource uploads on the existing classroom Spaces flow (lib/sirah/spaces):
 * step one hands the browser a 15-minute presigned PUT for one new object
 * key; step two trusts the stored object, not the form, reading its real size
 * and type back before the row is created. Same type and size rules as
 * classroom materials: audio/video up to 5 GB, documents up to 200 MB.
 * Callers check who may upload before calling either step.
 */

export type UploadTicket = { ok: true; uploadUrl: string; objectKey: string } | { ok: false; error: string };

const MEDIA = /^(audio|video)\//;
const ruleKind = (contentType: string) => (MEDIA.test(contentType) ? "RECORDING" : "PDF");

export async function resourceUploadTicket(input: { filename?: unknown; contentType?: unknown; size?: unknown }): Promise<UploadTicket> {
  if (!spacesConfigured()) return { ok: false, error: "File storage is not configured yet. Paste a link instead." };
  const contentType = String(input?.contentType || "").toLowerCase();
  const problem = uploadProblem(ruleKind(contentType), contentType, Number(input?.size));
  if (problem) return { ok: false, error: problem };
  const objectKey = newObjectKey(String(input?.filename || "file"));
  return { ok: true, uploadUrl: await presignUpload(objectKey, contentType), objectKey };
}

export async function confirmUploadedResource(input: {
  scope: ResourceScope;
  title: unknown;
  objectKey: string;
  originalFilename: string | null;
  uploadedBy: string;
}) {
  if (!spacesConfigured()) throw new LmsContentError("File storage is not configured yet.");
  if (!isClassroomObjectKey(input.objectKey)) throw new LmsContentError("That upload is not recognised. Upload the file again.");
  const stored = await headObject(input.objectKey);
  if (!stored) throw new LmsContentError("The upload did not finish. Upload the file again.");
  const contentType = (stored.contentType || "").toLowerCase();
  const problem = uploadProblem(ruleKind(contentType), contentType, stored.size);
  if (problem) {
    await deleteObject(input.objectKey).catch(() => {});
    throw new LmsContentError(problem);
  }
  return createFileResource({
    scope: input.scope,
    title: input.title,
    storageKey: input.objectKey,
    contentType,
    sizeBytes: stored.size,
    originalFilename: input.originalFilename,
    uploadedBy: input.uploadedBy,
  });
}

/** Removes a deleted resource's stored object, best effort (the row is already gone). */
export async function removeStoredObject(storageKey: string | null | undefined) {
  if (storageKey && spacesConfigured()) await deleteObject(storageKey).catch(() => {});
}
