import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { SIRAH_SLUG } from "@/lib/sirah/catalog";
import { sirahSchemaAvailable } from "@/lib/sirah/readiness";
import { lessonNeighbours, sirahEnrolmentAllows, toLessonView } from "@/lib/sirah/classroom";
import { canAccessSirah } from "@/services/sirah-confirmation.service";

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** The signed-in student and whether the existing enrolment rule (paid +
 * active) admits them. Same rule as /seerah/lms. */
export async function getSirahStudentAccess(): Promise<
  { user: null; allowed: false; order: null } | { user: CurrentUser; allowed: boolean; order: Awaited<ReturnType<typeof latestOrder>> }
> {
  const user = await getCurrentUser();
  if (!user) return { user: null, allowed: false, order: null };
  const enrollment = user.enrollments.find((item) => item.course.slug === SIRAH_SLUG) ?? null;
  const order = (await sirahSchemaAvailable()) ? await latestOrder(user.id) : null;
  return {
    user,
    order,
    allowed: sirahEnrolmentAllows({
      enrollment,
      order,
      orderGrantsAccess: Boolean(order && canAccessSirah(order)),
    }),
  };
}

function latestOrder(userId: string) {
  return prisma.sirahOrder.findFirst({
    where: { userId, course: { slug: SIRAH_SLUG }, archivedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

/** Read-only rollout check, like sirahSchemaAvailable: false until the
 * classroom migration has been deployed. Never creates tables. */
export async function sirahClassroomAvailable() {
  try {
    await prisma.sirahLesson.findFirst({ select: { id: true } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return false;
    throw error;
  }
}

const materialOrder = [{ order: "asc" as const }, { createdAt: "asc" as const }];

export async function getClassroomData() {
  const [lessons, courseMaterials, announcements] = await Promise.all([
    prisma.sirahLesson.findMany({
      orderBy: [{ weekNumber: "asc" }, { scheduledAt: "asc" }],
      include: { materials: { orderBy: materialOrder } },
    }),
    prisma.sirahMaterial.findMany({ where: { lessonId: null }, orderBy: materialOrder }),
    prisma.sirahAnnouncement.findMany({
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      take: 20,
    }),
  ]);
  return { lessons, courseMaterials, announcements };
}

/** Who is asking, as the enrolment check resolved it. studentId is the
 * signed-in User id; allowed is the shared paid + active rule. */
export type StudentGate = { allowed: boolean; studentId: string | null };

export function gateFrom(access: Awaited<ReturnType<typeof getSirahStudentAccess>>): StudentGate {
  return { allowed: access.allowed, studentId: access.user?.id ?? null };
}

/** One session for the detail page. For a viewer the enrolment check did not
 * admit, materials are never read and every URL in the view is null. */
export async function getLessonDetail(lessonId: string, gate: StudentGate, now = new Date()) {
  const lesson = await prisma.sirahLesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return null;
  const enrolled = gate.allowed && Boolean(gate.studentId);
  const [materials, schedule, progress] = await Promise.all([
    enrolled ? prisma.sirahMaterial.findMany({ where: { lessonId } }) : Promise.resolve([]),
    prisma.sirahLesson.findMany({ select: { id: true, title: true, weekNumber: true, scheduledAt: true } }),
    enrolled
      ? prisma.sirahLessonProgress.findUnique({
          where: { lessonId_studentId: { lessonId, studentId: gate.studentId! } },
        })
      : Promise.resolve(null),
  ]);
  // Neighbours carry only what the navigation shows.
  const slim = schedule.map(({ id, title, weekNumber, scheduledAt }) => ({ id, title, weekNumber, scheduledAt }));
  return {
    lesson: toLessonView(lesson, materials, { enrolled }, now),
    ...lessonNeighbours(slim, lessonId),
    completedAt: progress?.completedAt ?? null,
  };
}

/** Ids of the sessions this student has marked complete. */
export async function getCompletedLessonIds(studentId: string) {
  const rows = await prisma.sirahLessonProgress.findMany({
    where: { studentId, completedAt: { not: null } },
    select: { lessonId: true },
  });
  return new Set(rows.map((row) => row.lessonId));
}

export type ProgressResult =
  | { ok: true; completed: boolean }
  | { ok: false; reason: "not-enrolled" | "not-found" };

/** Marks a session complete (or not) for the signed-in enrolled student. The
 * student is always the gate's own id, never a value from the form. */
export async function setLessonComplete(
  gate: StudentGate,
  lessonId: string,
  complete: boolean,
  now = new Date(),
): Promise<ProgressResult> {
  if (!gate.allowed || !gate.studentId) return { ok: false, reason: "not-enrolled" };
  const lesson = await prisma.sirahLesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!lesson) return { ok: false, reason: "not-found" };
  const completedAt = complete ? now : null;
  await prisma.sirahLessonProgress.upsert({
    where: { lessonId_studentId: { lessonId, studentId: gate.studentId } },
    update: { completedAt },
    create: { lessonId, studentId: gate.studentId, completedAt },
  });
  return { ok: true, completed: complete };
}
