import "server-only";
import { prisma } from "@/lib/prisma";
import { sirahStudentCohortAccess } from "./access";
import { cleanBunnyVideoId, verifyBunnyVideo } from "./bunny";
import { cleanHttpsUrl, cleanTitle, LmsContentError } from "./content";
import { phaseOf } from "./schedule";

// Session links use the existing resource title, URL and visibility fields.
const EXTERNAL_RECORDING = "video/x-external-recording";

export async function externalRecordingsForSessions(sessionIds: string[], publishedOnly = false) {
  if (!sessionIds.length) return [];
  return prisma.lmsResource.findMany({
    where: { sessionId: { in: sessionIds }, kind: "LINK", contentType: EXTERNAL_RECORDING, ...(publishedOnly ? { visibility: "PUBLISHED" } : {}) },
    select: { id: true, sessionId: true, title: true, url: true, visibility: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function studentExternalRecordings(userId: string, now = new Date()) {
  const access = await sirahStudentCohortAccess(userId, now);
  if (!access.allowed || !access.cohortId) return [];
  const sessions = await prisma.lmsSession.findMany({ where: { cohortId: access.cohortId }, select: { id: true } });
  return externalRecordingsForSessions(sessions.map((session) => session.id), true);
}

export async function addExternalRecording(input: { sessionId: string; title: string; url: string; published: boolean; actor: string }) {
  const title = cleanTitle(input.title);
  const url = cleanHttpsUrl(input.url);
  const session = await prisma.lmsSession.findUnique({ where: { id: input.sessionId }, select: { id: true, startsAt: true, durationMin: true, status: true } });
  if (!session || phaseOf(session) !== "past") throw new LmsContentError("External recordings can be added to past sessions only.");
  return prisma.lmsResource.create({
    data: { sessionId: session.id, title, url, kind: "LINK", contentType: EXTERNAL_RECORDING, uploadedBy: input.actor.slice(0, 320), visibility: input.published ? "PUBLISHED" : "HIDDEN", publishedAt: input.published ? new Date() : null },
  });
}

export async function setExternalRecordingVisibility(id: string, sessionId: string, published: boolean) {
  const resource = await prisma.lmsResource.findFirst({ where: { id, sessionId, kind: "LINK", contentType: EXTERNAL_RECORDING } });
  if (!resource) throw new LmsContentError("That external recording no longer exists.");
  await prisma.lmsResource.update({ where: { id }, data: { visibility: published ? "PUBLISHED" : "HIDDEN", publishedAt: published ? (resource.publishedAt ?? new Date()) : null } });
}

// Standalone links use the otherwise unused originalFilename field for their
// short description; the recording marker and empty scope distinguish them.
const standaloneWhere = { sessionId: null, cohortId: null, parentRecordingId: null, kind: "LINK" as const, contentType: EXTERNAL_RECORDING };

export async function standaloneRecordings(publishedOnly = false) {
  return prisma.lmsResource.findMany({
    where: { ...standaloneWhere, ...(publishedOnly ? { visibility: "PUBLISHED" as const } : {}) },
    select: { id: true, title: true, url: true, bunnyVideoId: true, originalFilename: true, visibility: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function studentStandaloneRecordings(userId: string, now = new Date()) {
  const access = await sirahStudentCohortAccess(userId, now);
  if (!access.allowed || !access.cohortId) return [];
  const recordings = await standaloneRecordings(true);
  const resources = await prisma.lmsResource.findMany({ where: { parentRecordingId: { in: recordings.map((recording) => recording.id) }, visibility: "PUBLISHED" }, select: { id: true, title: true, kind: true, url: true, parentRecordingId: true }, orderBy: { createdAt: "desc" } });
  return recordings.map((recording) => ({ ...recording, resources: resources.filter((resource) => resource.parentRecordingId === recording.id).map((resource) => ({ id: resource.id, title: resource.title, href: resource.kind === "FILE" ? `/api/sirah/lms/resources/${encodeURIComponent(resource.id)}` : resource.url ?? "" })).filter((resource) => resource.href) }));
}

export type RecordingSource = "bunny" | "link";

export async function saveStandaloneRecording(input: { id?: string; title: string; source: RecordingSource; url: string; bunnyVideoId: string; description: string; published: boolean; actor: string }) {
  const title = cleanTitle(input.title);
  // A Bunny recording keeps only its video ID (url stays empty); a public link keeps only its URL.
  const bunnyVideoId = input.source === "bunny" ? cleanBunnyVideoId(input.bunnyVideoId) : null;
  const url = bunnyVideoId ? null : cleanHttpsUrl(input.url);
  const description = input.description.trim();
  if (description.length > 255) throw new LmsContentError("The description is longer than 255 characters.");
  const existing = input.id ? await prisma.lmsResource.findFirst({ where: { id: input.id, ...standaloneWhere } }) : null;
  if (input.id && !existing) throw new LmsContentError("That recording no longer exists.");
  if (bunnyVideoId) await verifyBunnyVideo(bunnyVideoId);
  const data = { title, url, bunnyVideoId, originalFilename: description || null, visibility: input.published ? "PUBLISHED" as const : "HIDDEN" as const, publishedAt: input.published ? (existing?.publishedAt ?? new Date()) : null };
  if (existing) return prisma.lmsResource.update({ where: { id: existing.id }, data });
  return prisma.lmsResource.create({ data: { ...standaloneWhere, ...data, uploadedBy: input.actor.slice(0, 320) } });
}

/**
 * Whether this student may watch a published Bunny recording: the same paid
 * and active cohort rule as every other recording. A session-linked or
 * cohort-scoped one must also belong to the student's cohort.
 */
export async function resolveBunnyPlayback(userId: string, resourceId: string, now = new Date()) {
  const resource = await prisma.lmsResource.findFirst({
    where: { id: resourceId, kind: "LINK", contentType: EXTERNAL_RECORDING, visibility: "PUBLISHED", bunnyVideoId: { not: null } },
    select: { bunnyVideoId: true, cohortId: true, session: { select: { cohortId: true } } },
  });
  if (!resource?.bunnyVideoId) return { ok: false as const, reason: "not_found" as const };
  const access = await sirahStudentCohortAccess(userId, now);
  if (!access.allowed || !access.cohortId) return { ok: false as const, reason: "not_enrolled" as const };
  const cohort = resource.session?.cohortId ?? resource.cohortId;
  if (cohort && cohort !== access.cohortId) return { ok: false as const, reason: "not_enrolled" as const };
  return { ok: true as const, videoId: resource.bunnyVideoId };
}

export async function deleteStandaloneRecording(id: string) {
  const result = await prisma.lmsResource.deleteMany({ where: { id, ...standaloneWhere } });
  if (!result.count) throw new LmsContentError("That recording no longer exists.");
}
