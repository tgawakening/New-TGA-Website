import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type LmsNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EmailDeliveryError, sendTransactionalEmail } from "@/lib/email";
import { emailConfigured } from "@/lib/email-config";
import { appUrl, firstName, renderEmail, type RenderedEmail } from "@/lib/email-layout";
import { formatClassTime } from "@/lib/sirah/classroom-emails";
import { enrolledStudent } from "@/services/sirah-classroom-email.service";
import { sirahStudentCohortAccess } from "./access";
import { cohortStudents, type CohortStudent } from "./cohort-students";
import { lmsContentAvailable } from "./content";

/**
 * LMS notifications: one in-app row per (event, subject, student) under a
 * unique dedupeKey, which is also the email's queue entry, so an event never
 * notifies or emails anyone twice however often it is triggered.
 *
 * Events: a session is scheduled, its time changes, it is starting soon (the
 * hourly sweep), an announcement is published, a resource is published.
 * Recipients are the students the join route would admit to that cohort
 * (lib/lms/cohort-students). The email goes through the existing Resend
 * sender (lib/email), is rendered when it is sent, and is cancelled if the
 * student is no longer enrolled in that cohort or the subject has changed
 * (session cancelled or moved, post or resource taken down).
 *
 * Opt-outs: the codebase has no email opt-out today, so none is checked
 * beyond the account being ACTIVE and enrolled. See the Phase 5 notes.
 */

export const NOTIFICATION_TYPES = [
  "SESSION_SCHEDULED",
  "SESSION_TIME_CHANGED",
  "SESSION_STARTING_SOON",
  "ANNOUNCEMENT",
  "RESOURCE",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** The hourly sweep (minute 15) sees every session once inside this lead. */
export const STARTING_SOON_LEAD_MINUTES = 90;
const MAX_ATTEMPTS = 5;
const LEASE_MS = 2 * 60_000;
const COURSE = "Beyond Chronology: The Sīrah";

export const SCHEDULE_LINK = "/seerah/classroom/schedule";
export const CLASSROOM_LINK = "/seerah/classroom";

/* ---------- Keys ---------- */

/** event:subject:version:user. `version` pins what the notice said (the
 * start time for session notices), "-" when there is nothing to pin. */
export function dedupeKey(type: NotificationType, subjectId: string, version: string, userId: string) {
  return [type, subjectId, version || "-", userId].join(":").slice(0, 191);
}

export function parseKey(key: string) {
  const [type, subjectId, version, userId] = key.split(":");
  return { type: type as NotificationType, subjectId, version, userId };
}

/* ---------- Fan-out ---------- */

type Draft = { title: string; body: string; link: string };

/** Writes one notification per student that does not have this one yet.
 * Returns how many were created. */
async function fanOut(
  cohortId: string,
  type: NotificationType,
  subjectId: string,
  version: string,
  render: (student: CohortStudent) => Draft,
  now: Date,
) {
  if (!(await lmsContentAvailable())) return 0;
  const students = await cohortStudents(cohortId, now);
  if (!students.length) return 0;
  const wanted = students.map((student) => ({ student, key: dedupeKey(type, subjectId, version, student.id) }));
  const existing = await prisma.lmsNotification.findMany({ where: { dedupeKey: { in: wanted.map((w) => w.key) } }, select: { dedupeKey: true } });
  const have = new Set(existing.map((row) => row.dedupeKey));
  let created = 0;
  for (const { student, key } of wanted) {
    if (have.has(key)) continue;
    const draft = render(student);
    try {
      await prisma.lmsNotification.create({
        data: {
          userId: student.id,
          type,
          title: draft.title.slice(0, 191),
          body: draft.body,
          link: draft.link,
          dedupeKey: key,
          emailState: "PENDING",
          emailAttempts: 0,
          emailLockedUntil: null,
          readAt: null,
        },
      });
      created++;
    } catch (error) {
      // Two triggers raced to the same row: the unique key kept it to one.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  return created;
}

/* ---------- Events ---------- */

export async function notifySessionScheduled(sessionId: string, now = new Date()) {
  const session = await prisma.lmsSession.findUnique({ where: { id: sessionId } });
  if (!session || session.status === "CANCELLED" || session.startsAt <= now) return 0;
  return fanOut(
    session.cohortId,
    "SESSION_SCHEDULED",
    session.id,
    String(session.startsAt.getTime()),
    (student) => ({
      title: `New live class: ${session.title}`,
      body: `${session.title} is scheduled for ${formatClassTime(session.startsAt, student.timeZone)}.`,
      link: SCHEDULE_LINK,
    }),
    now,
  );
}

/** Only when the start actually moved. Each new time is its own notice. */
export async function notifySessionTimeChanged(sessionId: string, previousStartsAt: Date, now = new Date()) {
  const session = await prisma.lmsSession.findUnique({ where: { id: sessionId } });
  if (!session || session.status === "CANCELLED" || session.startsAt <= now) return 0;
  if (session.startsAt.getTime() === previousStartsAt.getTime()) return 0;
  return fanOut(
    session.cohortId,
    "SESSION_TIME_CHANGED",
    session.id,
    String(session.startsAt.getTime()),
    (student) => ({
      title: `Time changed: ${session.title}`,
      body: `${session.title} has moved to ${formatClassTime(session.startsAt, student.timeZone)} (it was ${formatClassTime(previousStartsAt, student.timeZone)}).`,
      link: SCHEDULE_LINK,
    }),
    now,
  );
}

/** The sweep: sessions starting within the lead get one notice per start time. */
export async function queueStartingSoon(now = new Date()) {
  if (!(await lmsContentAvailable())) return 0;
  const sessions = await prisma.lmsSession.findMany({
    where: { status: "SCHEDULED", startsAt: { gt: now, lte: new Date(now.getTime() + STARTING_SOON_LEAD_MINUTES * 60_000) } },
  });
  let created = 0;
  for (const session of sessions)
    created += await fanOut(
      session.cohortId,
      "SESSION_STARTING_SOON",
      session.id,
      String(session.startsAt.getTime()),
      (student) => ({
        title: `Starting soon: ${session.title}`,
        body: `${session.title} starts at ${formatClassTime(session.startsAt, student.timeZone)}. Join from your schedule; the room opens 15 minutes before.`,
        link: SCHEDULE_LINK,
      }),
      now,
    );
  return created;
}

export async function notifyAnnouncement(announcementId: string, now = new Date()) {
  const post = await prisma.lmsAnnouncement.findUnique({ where: { id: announcementId } });
  if (!post?.publishedAt) return 0;
  return fanOut(
    post.cohortId,
    "ANNOUNCEMENT",
    post.id,
    "-",
    () => ({ title: post.title, body: post.body, link: `${CLASSROOM_LINK}#cohort-notices` }),
    now,
  );
}

export async function notifyResource(resourceId: string, now = new Date()) {
  const resource = await prisma.lmsResource.findUnique({ where: { id: resourceId } });
  if (!resource || resource.visibility !== "PUBLISHED") return 0;
  const session = resource.sessionId
    ? await prisma.lmsSession.findUnique({ where: { id: resource.sessionId }, select: { cohortId: true, title: true } })
    : null;
  const cohortId = resource.cohortId ?? session?.cohortId;
  if (!cohortId) return 0;
  return fanOut(
    cohortId,
    "RESOURCE",
    resource.id,
    "-",
    () => ({
      title: `New ${resource.kind === "FILE" ? "file" : "link"}: ${resource.title}`,
      body: session ? `Added to "${session.title}": ${resource.title}.` : `Added to your course resources: ${resource.title}.`,
      link: `${CLASSROOM_LINK}#resources`,
    }),
    now,
  );
}

/* ---------- Inbox ---------- */

export async function studentInbox(userId: string, limit = 50) {
  const rows = await prisma.lmsNotification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
  return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}

export async function unreadCount(userId: string) {
  return prisma.lmsNotification.count({ where: { userId, readAt: null } });
}

/** Marks one of the student's own notifications read. Another user's id is a no-op. */
export async function markRead(userId: string, notificationId: string, now = new Date()) {
  const result = await prisma.lmsNotification.updateMany({ where: { id: notificationId, userId, readAt: null }, data: { readAt: now } });
  return result.count;
}

export async function markAllRead(userId: string, now = new Date()) {
  const result = await prisma.lmsNotification.updateMany({ where: { userId, readAt: null }, data: { readAt: now } });
  return result.count;
}

/* ---------- Email ---------- */

/** The email for this notification as of now, or why it should not go out. */
async function compose(row: LmsNotification, now: Date): Promise<{ to: { id: string; email: string; fullName: string }; email: RenderedEmail } | { cancel: string }> {
  const student = await enrolledStudent(row.userId, now);
  if (!student) return { cancel: "No longer enrolled." };
  const access = await sirahStudentCohortAccess(row.userId, now);
  const { type, subjectId, version } = parseKey(row.dedupeKey);

  let cohortId: string | null = null;
  if (type === "SESSION_SCHEDULED" || type === "SESSION_TIME_CHANGED" || type === "SESSION_STARTING_SOON") {
    const session = await prisma.lmsSession.findUnique({ where: { id: subjectId } });
    if (!session || session.status === "CANCELLED") return { cancel: "The class was cancelled or removed." };
    if (String(session.startsAt.getTime()) !== version) return { cancel: "The class time has changed since." };
    if (session.startsAt <= now) return { cancel: "The class has already started." };
    cohortId = session.cohortId;
  } else if (type === "ANNOUNCEMENT") {
    const post = await prisma.lmsAnnouncement.findUnique({ where: { id: subjectId } });
    if (!post?.publishedAt) return { cancel: "The announcement was unpublished or removed." };
    cohortId = post.cohortId;
  } else if (type === "RESOURCE") {
    const resource = await prisma.lmsResource.findUnique({ where: { id: subjectId } });
    if (!resource || resource.visibility !== "PUBLISHED") return { cancel: "The resource was hidden or removed." };
    cohortId =
      resource.cohortId ??
      (resource.sessionId ? ((await prisma.lmsSession.findUnique({ where: { id: resource.sessionId }, select: { cohortId: true } }))?.cohortId ?? null) : null);
  } else return { cancel: `Unknown type ${row.type}.` };

  if (!access.allowed || access.cohortId !== cohortId) return { cancel: "No longer in this cohort." };
  const app = appUrl();
  return {
    to: student,
    email: renderEmail(`${row.title} · ${COURSE}`, {
      masthead: `The Global Awakening · ${COURSE}`,
      heading: row.title,
      paragraphs: [`Assalamu alaykum ${firstName(student.fullName)},`, ...row.body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)],
      action: row.link ? { label: "Open the classroom", href: `${app}${row.link}` } : undefined,
      footnote: "You are receiving this because you are enrolled in the course. Sign in with your registered email if asked.",
    }),
  };
}

export async function dispatchLmsNotificationEmails(options: { now?: Date; limit?: number } = {}) {
  const now = options.now ?? new Date();
  const result = { sent: 0, cancelled: 0, deferred: 0 };
  if (!emailConfigured()) return { ...result, configured: false };
  if (!(await lmsContentAvailable())) return { ...result, configured: true };
  const free = [{ emailLockedUntil: null }, { emailLockedUntil: { lt: now } }];
  const candidates = await prisma.lmsNotification.findMany({
    where: { emailState: { in: ["PENDING", "FAILED", "SENDING"] }, emailAttempts: { lt: MAX_ATTEMPTS }, OR: free },
    orderBy: { createdAt: "asc" },
    take: options.limit ?? 100,
  });
  for (const row of candidates.slice(0, options.limit ?? 100)) {
    const claimed = await prisma.lmsNotification.updateMany({
      where: { id: row.id, emailState: row.emailState, emailAttempts: row.emailAttempts, OR: free },
      data: { emailState: "SENDING", emailAttempts: { increment: 1 }, emailLockedUntil: new Date(now.getTime() + LEASE_MS) },
    });
    if (!claimed.count) continue;
    const settle = (data: Prisma.LmsNotificationUpdateInput) => prisma.lmsNotification.update({ where: { id: row.id }, data });

    const message = await compose(row, now);
    if ("cancel" in message) {
      await settle({ emailState: "CANCELLED", emailLockedUntil: null, emailError: message.cancel });
      result.cancelled++;
      continue;
    }
    try {
      const sent = await sendTransactionalEmail({
        to: message.to.email,
        userId: message.to.id,
        subject: message.email.subject,
        html: message.email.html,
        text: message.email.text,
        emailType: `LMS_${row.type}`,
        // Resend drops a repeat within 24 hours, so a retried lease cannot
        // deliver the same email twice either.
        idempotencyKey: `lms-notify-${createHash("sha256").update(row.dedupeKey).digest("hex").slice(0, 48)}`,
      });
      if (sent.status === "SENT") {
        await settle({ emailState: "SENT", emailSentAt: new Date(), emailProviderId: sent.id ?? null, emailLockedUntil: null, emailError: null });
        result.sent++;
      } else {
        await settle({ emailState: "PENDING", emailAttempts: row.emailAttempts, emailLockedUntil: new Date(now.getTime() + 30 * 60_000), emailError: "Sender not configured." });
        result.deferred++;
      }
    } catch (error) {
      const retryMs = error instanceof EmailDeliveryError ? error.retryAfterMs : 5 * 60_000;
      await settle({
        emailState: row.emailAttempts + 1 >= MAX_ATTEMPTS ? "GAVE_UP" : "FAILED",
        emailLockedUntil: new Date(now.getTime() + retryMs),
        emailError: "Delivery deferred after a provider error.",
      });
      result.deferred++;
      if (error instanceof EmailDeliveryError && error.pauseBatch) break;
    }
  }
  return { ...result, configured: true };
}

/** The scheduled pass, called from the Sīrah maintenance sweep. */
export async function runLmsNotifications(now = new Date()) {
  if (!(await lmsContentAvailable())) return { available: false as const };
  const startingSoon = await queueStartingSoon(now);
  const dispatch = await dispatchLmsNotificationEmails({ now, limit: 150 });
  return { available: true as const, queued: { startingSoon }, ...dispatch };
}
