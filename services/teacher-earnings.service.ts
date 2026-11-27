import "server-only";
import { prisma } from "@/lib/prisma";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { hostsForIdentity } from "@/lib/lms/schedule";
import { SIRAH_TEACHER_SHARE_PERCENT, teacherEarnings } from "@/lib/lms/teacher-earnings";
import type { RevenuePeriod } from "@/lib/sirah/course-revenue-period";
import { courseRevenueReport } from "./course-revenue.service";

/**
 * Earnings are visible to the Super Admin and to a host the Super Admin has
 * designated a revenue partner (the existing, audited ZoomHost.revenuePartner
 * switch on the admin Live classes page). Managers, community leads and other
 * hosts are refused.
 */
export async function teacherEarningsAccess(identity: { email: string } | null) {
  if ((await getSirahWorkspaceAccess())?.role === "SUPER_ADMIN") return { allowed: true as const, viewer: "SUPER_ADMIN" as const };
  const hosts = await hostsForIdentity(identity);
  if (!hosts.length) return { allowed: false as const, viewer: null };
  const partner = await prisma.zoomHost.findFirst({
    where: { id: { in: hosts.map(host => host.id) }, active: true, revenuePartner: true },
    select: { id: true },
  });
  return partner ? { allowed: true as const, viewer: "PARTNER" as const } : { allowed: false as const, viewer: null };
}

/**
 * The current Sīrah course's received-after-refunds money for a period (the
 * same figures as the admin "Payments by course" report) and the teacher's
 * agreed share of it, per currency. Legacy (pre-Sīrah) registrations are a
 * separate programme and are not included.
 */
export async function sirahTeacherEarnings(period: RevenuePeriod) {
  const report = await courseRevenueReport(period);
  const program = report.programs.find(item => item.id.endsWith(":sirah"));
  const percent = SIRAH_TEACHER_SHARE_PERCENT;
  return {
    period,
    percent,
    title: program?.title ?? null,
    rows: teacherEarnings(program?.received ?? [], program?.refunds ?? [], percent),
    /** Money awaiting finance review is not counted until it is confirmed. */
    inReview: program?.ambiguous ?? [],
    undatedRefunds: program?.undatedRefunds ?? 0,
  };
}
