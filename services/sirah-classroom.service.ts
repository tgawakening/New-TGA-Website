import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { SIRAH_SLUG } from "@/lib/sirah/catalog";
import { sirahSchemaAvailable } from "@/lib/sirah/readiness";
import { sirahEnrolmentAllows } from "@/lib/sirah/classroom";
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
    where: { userId, course: { slug: SIRAH_SLUG } },
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
