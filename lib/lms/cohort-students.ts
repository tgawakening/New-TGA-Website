import "server-only";
import { prisma } from "@/lib/prisma";
import { SIRAH_BATCH, SIRAH_SLUG } from "@/lib/sirah/catalog";
import { listEnrolledStudents } from "@/services/sirah-classroom-email.service";

export type CohortStudent = { id: string; email: string; fullName: string; timeZone: string | null };

/**
 * Every student the join route would admit to this cohort right now: the
 * classroom's paid + active rule (listEnrolledStudents, the same check as the
 * classroom gate and its emails), then the cohort rule of
 * lib/lms/access.sirahStudentCohortAccess: the latest non-archived Sīrah
 * order's batchCode, or the catalog batch for a legacy enrolment.
 * Done in two batched reads so a fan-out never runs a query per student.
 */
export async function cohortStudents(cohortId: string, now = new Date()): Promise<CohortStudent[]> {
  const enrolled = await listEnrolledStudents(now);
  if (!enrolled.length) return [];
  const orders = await prisma.sirahOrder.findMany({
    where: { userId: { in: enrolled.map((s) => s.id) }, course: { slug: SIRAH_SLUG }, archivedAt: null },
    select: { userId: true, batchCode: true, createdAt: true },
  });
  const latest = new Map<string, { batchCode: string | null; createdAt: Date }>();
  for (const order of orders) {
    const seen = latest.get(order.userId);
    if (!seen || order.createdAt > seen.createdAt) latest.set(order.userId, order);
  }
  return enrolled.filter((student) => (latest.get(student.id)?.batchCode ?? SIRAH_BATCH) === cohortId);
}
