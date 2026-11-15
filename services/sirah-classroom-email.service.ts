import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EmailDeliveryError, sendTransactionalEmail } from "@/lib/email";
import { emailConfigured } from "@/lib/email-config";
import { SIRAH_SLUG } from "@/lib/sirah/catalog";
import { sirahEnrolmentAllows } from "@/lib/sirah/classroom";
import { announcementEmail, reminderEmail, welcomeEmail, type RenderedEmail } from "@/lib/sirah/classroom-emails";
import { canAccessSirah } from "./sirah-confirmation.service";

/** Classroom email: a queue in SirahClassroomEmail, filled by the sweep and by
 * two admin/payment events, drained by dispatchClassroomEmails. One row per
 * (kind, subject, student) under a unique key, so nothing is sent twice:
 *  - WELCOME       once per student, after their enrolment is confirmed;
 *  - REMINDER      once per session per student, in the 24 hours before it;
 *  - ANNOUNCEMENT  once per post per student, unless posted quietly.
 * Each message is rendered when it is sent, from the current session, and
 * only if the student is still enrolled. */

export const REMINDER_LEAD_HOURS = 24;
/** A confirmation older than this never gets a late welcome from the sweep. */
const WELCOME_BACKSTOP_DAYS = 7;
const MAX_ATTEMPTS = 5;
const LEASE_MS = 2 * 60_000;

export type ClassroomEmailKind = "WELCOME" | "REMINDER" | "ANNOUNCEMENT";
type Student = { id: string; email: string; fullName: string; timeZone: string | null };

/** False until this migration is deployed, so the payment sweep never fails
 * on a missing table. */
export async function classroomEmailAvailable() {
  try {
    await prisma.sirahClassroomEmail.findFirst({ select: { id: true } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return false;
    throw error;
  }
}

/* ---------- Who is enrolled (the same rule as the classroom gate) ---------- */

const studentSelect = {
  id: true,
  email: true,
  fullName: true,
  status: true,
  studentProfile: { select: { timezone: true } },
  enrollments: { select: { status: true, registrationId: true, course: { select: { slug: true } } } },
} as const;

type StudentRow = {
  id: string;
  email: string;
  fullName: string;
  status: string;
  studentProfile?: { timezone: string | null } | null;
  enrollments?: { status: string; registrationId: string; course?: { slug: string } | null }[];
};

async function latestOrders(userIds: string[]) {
  if (!userIds.length) return new Map<string, Awaited<ReturnType<typeof prisma.sirahOrder.findFirst>>>();
  const orders = await prisma.sirahOrder.findMany({
    where: { userId: { in: userIds }, course: { slug: SIRAH_SLUG } },
    orderBy: { createdAt: "desc" },
  });
  const latest = new Map<string, (typeof orders)[number]>();
  for (const order of [...orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))
    if (!latest.has(order.userId)) latest.set(order.userId, order);
  return latest;
}

function admitted(user: StudentRow, order: Awaited<ReturnType<typeof prisma.sirahOrder.findFirst>> | undefined, now: Date) {
  if (user.status !== "ACTIVE") return false;
  const enrollment = user.enrollments?.find((item) => item.course?.slug === SIRAH_SLUG) ?? null;
  return sirahEnrolmentAllows({ enrollment, order: order ?? null, orderGrantsAccess: Boolean(order && canAccessSirah(order, now)) });
}

const toStudent = (user: StudentRow): Student => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  timeZone: user.studentProfile?.timezone ?? null,
});

/** Every student the classroom gate would admit right now. */
export async function listEnrolledStudents(now = new Date()): Promise<Student[]> {
  const [withOrders, withEnrolments] = await Promise.all([
    prisma.sirahOrder.findMany({ where: { course: { slug: SIRAH_SLUG } }, select: { userId: true } }),
    prisma.enrollment.findMany({ where: { course: { slug: SIRAH_SLUG } }, select: { userId: true } }),
  ]);
  const ids = [...new Set([...withOrders, ...withEnrolments].map((row) => row.userId))];
  if (!ids.length) return [];
  const users = (await prisma.user.findMany({ where: { id: { in: ids } }, select: studentSelect })) as StudentRow[];
  const orders = await latestOrders(ids);
  return users.filter((user) => admitted(user, orders.get(user.id), now)).map(toStudent);
}

export async function enrolledStudent(userId: string, now = new Date()): Promise<Student | null> {
  const user = (await prisma.user.findUnique({ where: { id: userId }, select: studentSelect })) as StudentRow | null;
  if (!user) return null;
  const orders = await latestOrders([userId]);
  return admitted(user, orders.get(userId), now) ? toStudent(user) : null;
}

/* ---------- Queueing ---------- */

const keyOf = (...parts: string[]) => parts.join(":").slice(0, 191);

async function enqueue(
  kind: ClassroomEmailKind,
  student: Student,
  key: string,
  refs: { lessonId?: string; announcementId?: string } = {},
) {
  if (await prisma.sirahClassroomEmail.findUnique({ where: { key }, select: { id: true } })) return false;
  try {
    await prisma.sirahClassroomEmail.create({
      data: {
        key,
        kind,
        userId: student.id,
        toEmail: student.email,
        lessonId: refs.lessonId ?? null,
        announcementId: refs.announcementId ?? null,
        state: "PENDING",
        attempts: 0,
        lockedUntil: null,
      },
    });
    return true;
  } catch (error) {
    // Two sweeps raced to the same row: the unique key kept it to one.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
    throw error;
  }
}

/** Welcome follows the enrolment confirmation (the CONFIRMED notice). */
export async function queueWelcomeForOrder(orderId: string, now = new Date()) {
  const confirmed = await prisma.sirahNotification.findFirst({ where: { orderId, kind: "CONFIRMED" }, select: { id: true } });
  if (!confirmed) return false;
  const order = await prisma.sirahOrder.findUnique({ where: { id: orderId }, select: { userId: true } });
  const student = order && (await enrolledStudent(order.userId, now));
  return student ? enqueue("WELCOME", student, keyOf("welcome", student.id)) : false;
}

/** Sweep backstop: confirmations from the last week that have no welcome yet. */
async function queueRecentWelcomes(now: Date) {
  const since = new Date(now.getTime() - WELCOME_BACKSTOP_DAYS * 86_400_000);
  const confirmed = await prisma.sirahNotification.findMany({
    where: { kind: "CONFIRMED", createdAt: { gte: since } },
    select: { orderId: true },
    take: 500,
  });
  let queued = 0;
  for (const orderId of new Set(confirmed.map((row) => row.orderId)))
    if (await queueWelcomeForOrder(orderId, now)) queued++;
  return queued;
}

/** Sessions starting within the next 24 hours: one reminder per student. */
export async function queueReminders(now = new Date()) {
  const lessons = await prisma.sirahLesson.findMany({
    where: { scheduledAt: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_HOURS * 3_600_000) } },
    select: { id: true },
  });
  if (!lessons.length) return 0;
  const students = await listEnrolledStudents(now);
  let queued = 0;
  for (const lesson of lessons)
    for (const student of students)
      if (await enqueue("REMINDER", student, keyOf("reminder", lesson.id, student.id), { lessonId: lesson.id })) queued++;
  return queued;
}

export async function queueAnnouncementEmails(announcementId: string, now = new Date()) {
  const announcement = await prisma.sirahAnnouncement.findUnique({ where: { id: announcementId }, select: { id: true, emailStudents: true } });
  if (!announcement?.emailStudents) return 0;
  let queued = 0;
  for (const student of await listEnrolledStudents(now))
    if (await enqueue("ANNOUNCEMENT", student, keyOf("announcement", announcement.id, student.id), { announcementId: announcement.id }))
      queued++;
  return queued;
}

/* ---------- Sending ---------- */

type Row = Awaited<ReturnType<typeof prisma.sirahClassroomEmail.findFirstOrThrow>>;

/** The message for this row as of now, or why it should no longer go out. */
async function compose(row: Row, student: Student, now: Date): Promise<RenderedEmail | { cancel: string }> {
  if (row.kind === "WELCOME") return welcomeEmail({ fullName: student.fullName });
  if (row.kind === "REMINDER") {
    const lesson = row.lessonId ? await prisma.sirahLesson.findUnique({ where: { id: row.lessonId } }) : null;
    if (!lesson) return { cancel: "The session was removed." };
    if (lesson.scheduledAt <= now) return { cancel: "The session has already started." };
    return reminderEmail({
      fullName: student.fullName,
      lessonId: lesson.id,
      title: lesson.title,
      weekNumber: lesson.weekNumber,
      scheduledAt: lesson.scheduledAt,
      timeZone: student.timeZone,
    });
  }
  if (row.kind === "ANNOUNCEMENT") {
    const post = row.announcementId ? await prisma.sirahAnnouncement.findUnique({ where: { id: row.announcementId } }) : null;
    if (!post) return { cancel: "The announcement was removed." };
    return announcementEmail({ fullName: student.fullName, title: post.title, body: post.body });
  }
  return { cancel: `Unknown kind ${row.kind}.` };
}

export async function dispatchClassroomEmails(options: { now?: Date; limit?: number } = {}) {
  const now = options.now ?? new Date();
  const result = { sent: 0, cancelled: 0, deferred: 0 };
  if (!emailConfigured()) return { ...result, configured: false };
  const free = [{ lockedUntil: null }, { lockedUntil: { lt: now } }];
  const candidates = await prisma.sirahClassroomEmail.findMany({
    where: { state: { in: ["PENDING", "FAILED", "SENDING"] }, attempts: { lt: MAX_ATTEMPTS }, OR: free },
    orderBy: { createdAt: "asc" },
    take: options.limit ?? 100,
  });
  for (const row of candidates) {
    const claimed = await prisma.sirahClassroomEmail.updateMany({
      where: { id: row.id, state: row.state, attempts: row.attempts, OR: free },
      data: { state: "SENDING", attempts: { increment: 1 }, lockedUntil: new Date(now.getTime() + LEASE_MS) },
    });
    if (!claimed.count) continue;
    const settle = (data: Prisma.SirahClassroomEmailUpdateInput) =>
      prisma.sirahClassroomEmail.update({ where: { id: row.id }, data });

    const student = await enrolledStudent(row.userId, now);
    const message = student ? await compose(row, student, now) : { cancel: "No longer enrolled." };
    if ("cancel" in message) {
      await settle({ state: "CANCELLED", lockedUntil: null, error: message.cancel });
      result.cancelled++;
      continue;
    }
    try {
      const sent = await sendTransactionalEmail({
        to: student!.email,
        userId: student!.id,
        subject: message.subject,
        html: message.html,
        text: message.text,
        emailType: `SIRAH_CLASSROOM_${row.kind}`,
        // Resend drops a repeat within 24 hours, so a retried lease cannot
        // deliver the same email twice either.
        idempotencyKey: `sirah-classroom-${createHash("sha256").update(row.key).digest("hex").slice(0, 48)}`,
      });
      if (sent.status === "SENT") {
        await settle({
          state: "SENT",
          toEmail: student!.email,
          subject: message.subject.slice(0, 191),
          providerId: sent.id ?? null,
          sentAt: new Date(),
          lockedUntil: null,
          error: null,
        });
        result.sent++;
      } else {
        await settle({ state: "PENDING", attempts: row.attempts, lockedUntil: new Date(now.getTime() + 30 * 60_000), error: "Sender not configured." });
        result.deferred++;
      }
    } catch (error) {
      const retryMs = error instanceof EmailDeliveryError ? error.retryAfterMs : 5 * 60_000;
      await settle({
        state: row.attempts + 1 >= MAX_ATTEMPTS ? "GAVE_UP" : "FAILED",
        lockedUntil: new Date(now.getTime() + retryMs),
        error: "Delivery deferred after a provider error.",
      });
      result.deferred++;
      // A provider rate limit applies to the whole batch: stop here.
      if (error instanceof EmailDeliveryError && error.pauseBatch) break;
    }
  }
  return { ...result, configured: true };
}

/** The scheduled pass, called from the Sīrah maintenance sweep. */
export async function runClassroomEmails(now = new Date()) {
  if (!(await classroomEmailAvailable())) return { available: false as const };
  const welcomes = await queueRecentWelcomes(now);
  const reminders = await queueReminders(now);
  const dispatch = await dispatchClassroomEmails({ now, limit: 150 });
  return { available: true as const, queued: { welcomes, reminders }, ...dispatch };
}
