import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sirahStudentCohortAccess } from "./access";

const marker = "video/x-external-recording";
const idPattern = /^[A-Za-z0-9_-]{1,191}$/;

export async function tasksAvailable() {
  try { await prisma.lmsTask.findFirst({ select: { id: true } }); await prisma.lmsTaskSubmission.findFirst({ select: { id: true } }); return true; }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return false; throw error; }
}

/** Exactly one existing class target. A published external link must remain a recording. */
export async function taskTarget(value: string) {
  const [kind, id, extra] = value.split(":");
  if (extra || !id || !idPattern.test(id)) throw new Error("Choose a valid class or recording.");
  if (kind === "session" && await prisma.lmsSession.findUnique({ where: { id }, select: { id: true } })) return { sessionId: id, recordingId: null, externalRecordingId: null };
  if (kind === "recording" && await prisma.recording.findUnique({ where: { id }, select: { id: true } })) return { sessionId: null, recordingId: id, externalRecordingId: null };
  if (kind === "external" && await prisma.lmsResource.findFirst({ where: { id, kind: "LINK", contentType: marker, parentRecordingId: null, OR: [{ sessionId: { not: null } }, { sessionId: null, cohortId: null }] }, select: { id: true } })) return { sessionId: null, recordingId: null, externalRecordingId: id };
  throw new Error("That class or recording is no longer available.");
}

export function validateTask(title: string, body: string) {
  title = title.trim(); body = body.trim();
  if (!title || title.length > 191 || !body || body.length > 50000) throw new Error("Enter a title (up to 191 characters) and task instructions (up to 50,000 characters).");
  return { title, body };
}

export function validateAnswer(answer: string, link: string) {
  answer = answer.trim(); link = link.trim();
  if (!answer || answer.length > 50000) throw new Error("Enter an answer of up to 50,000 characters.");
  if (link) {
    try { const url = new URL(link); if (url.protocol !== "https:" || url.username || url.password || link.length > 1024) throw new Error(); }
    catch { throw new Error("Use a valid HTTPS link of up to 1,024 characters."); }
  }
  return { answer, link: link || null };
}

function visibleWhere(cohortId: string, now: Date): Prisma.LmsTaskWhereInput {
  return {
    publishedAt: { lte: now },
    OR: [
      { session: { is: { cohortId } } },
      { recording: { is: { status: "READY", visibility: "PUBLISHED", session: { cohortId } } } },
      { externalRecording: { is: { kind: "LINK", contentType: marker, visibility: "PUBLISHED", parentRecordingId: null, OR: [{ session: { is: { cohortId } } }, { sessionId: null, cohortId: null }] } } },
    ],
  };
}

/** The caller must supply the authenticated student's ID, never an ID from form input. */
export async function studentTaskList(studentId: string, now = new Date()) {
  const access = await sirahStudentCohortAccess(studentId, now);
  if (!access.allowed || !access.cohortId || !(await tasksAvailable())) return [];
  return prisma.lmsTask.findMany({
    where: visibleWhere(access.cohortId, now),
    select: { id: true, title: true, sessionId: true, recordingId: true, externalRecordingId: true, submissions: { where: { studentId }, select: { submittedAt: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function studentTaskDetail(studentId: string, taskId: string, now = new Date()) {
  if (!idPattern.test(taskId)) return null;
  const access = await sirahStudentCohortAccess(studentId, now);
  if (!access.allowed || !access.cohortId || !(await tasksAvailable())) return null;
  return prisma.lmsTask.findFirst({
    where: { id: taskId, ...visibleWhere(access.cohortId, now) },
    select: { id: true, title: true, body: true, submissions: { where: { studentId }, select: { answer: true, link: true, submittedAt: true } } },
  });
}

export async function submitTask(studentId: string, taskId: string, answer: string, link: string) {
  const input = validateAnswer(answer, link);
  const access = await sirahStudentCohortAccess(studentId);
  if (!idPattern.test(taskId) || !access.allowed || !access.cohortId || !(await tasksAvailable())) throw new Error("This task is not available.");
  const cohortId = access.cohortId;
  await prisma.$transaction(async (tx) => {
    // Serialize submissions with unpublishing the task; no unchecked task ID can be written.
    await tx.$queryRaw`SELECT id FROM LmsTask WHERE id = ${taskId} FOR UPDATE`;
    const task = await tx.lmsTask.findFirst({ where: { id: taskId, ...visibleWhere(cohortId, new Date()) }, select: { id: true } });
    if (!task) throw new Error("This task is not available.");
    await tx.lmsTaskSubmission.upsert({
      where: { taskId_studentId: { taskId, studentId } },
      create: { taskId, studentId, ...input },
      update: { ...input, submittedAt: new Date() },
    });
  });
}
