import "server-only";
import { prisma } from "@/lib/prisma";
import { sirahStudentCohortAccess } from "./access";
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
const standaloneWhere = { sessionId: null, cohortId: null, kind: "LINK" as const, contentType: EXTERNAL_RECORDING };

export async function standaloneRecordings(publishedOnly = false) {
  return prisma.lmsResource.findMany({
    where: { ...standaloneWhere, ...(publishedOnly ? { visibility: "PUBLISHED" as const } : {}) },
    select: { id: true, title: true, url: true, originalFilename: true, visibility: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function studentStandaloneRecordings(userId: string, now = new Date()) {
  const access = await sirahStudentCohortAccess(userId, now);
  if (!access.allowed || !access.cohortId) return [];
  return standaloneRecordings(true);
}

export async function saveStandaloneRecording(input: { id?: string; title: string; url: string; description: string; published: boolean; actor: string }) {
  const title = cleanTitle(input.title);
  const url = cleanHttpsUrl(input.url);
  const description = input.description.trim();
  if (description.length > 255) throw new LmsContentError("The description is longer than 255 characters.");
  const existing = input.id ? await prisma.lmsResource.findFirst({ where: { id: input.id, ...standaloneWhere } }) : null;
  if (input.id && !existing) throw new LmsContentError("That recording no longer exists.");
  const data = { title, url, originalFilename: description || null, visibility: input.published ? "PUBLISHED" as const : "HIDDEN" as const, publishedAt: input.published ? (existing?.publishedAt ?? new Date()) : null };
  if (existing) return prisma.lmsResource.update({ where: { id: existing.id }, data });
  return prisma.lmsResource.create({ data: { ...standaloneWhere, ...data, uploadedBy: input.actor.slice(0, 320) } });
}

export async function deleteStandaloneRecording(id: string) {
  const result = await prisma.lmsResource.deleteMany({ where: { id, ...standaloneWhere } });
  if (!result.count) throw new LmsContentError("That recording no longer exists.");
}
