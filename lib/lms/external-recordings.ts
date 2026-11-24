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
