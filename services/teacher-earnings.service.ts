import "server-only";
import { prisma } from "@/lib/prisma";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { hostsForIdentity } from "@/lib/lms/schedule";
import { outstandingAdvances, resolveSharePercent, SIRAH_TEACHER_SHARE_PERCENT, teacherEarnings } from "@/lib/lms/teacher-earnings";
import type { RevenuePeriod } from "@/lib/sirah/course-revenue-period";
import { courseRevenueReport } from "./course-revenue.service";
import { teacherAdvanceHistory, teacherRevenueSchemaAvailable } from "./teacher-advances.service";
import type { Prisma } from "@prisma/client";

export type EarningsHost = { id: string; email: string; percent: number; customShare: boolean };

/**
 * Earnings are visible to the Super Admin and to a host the Super Admin has
 * designated a revenue partner (the audited ZoomHost.revenuePartner switch on
 * the admin Live classes page). Managers, community leads and other hosts are
 * refused. `hosts` are the partner hosts this viewer may see: every partner
 * for the Super Admin, only their own for a teacher.
 */
export async function teacherEarningsAccess(identity: { email: string } | null) {
  const toHost = (host: { id: string; email: string; revenueSharePercent?: { toString(): string } | null }): EarningsHost => ({
    id: host.id, email: host.email, percent: resolveSharePercent(host.revenueSharePercent ?? null), customShare: host.revenueSharePercent != null,
  });
  // Before the teacher-advances migration the share column does not exist yet: use the default.
  const partnerHosts = async (where: Prisma.ZoomHostWhereInput) => (await teacherRevenueSchemaAvailable())
    ? prisma.zoomHost.findMany({ where, select: { id: true, email: true, revenueSharePercent: true }, orderBy: { email: "asc" } })
    : prisma.zoomHost.findMany({ where, select: { id: true, email: true }, orderBy: { email: "asc" } });
  if ((await getSirahWorkspaceAccess())?.role === "SUPER_ADMIN") {
    const hosts = await partnerHosts({ active: true, revenuePartner: true });
    return { allowed: true as const, viewer: "SUPER_ADMIN" as const, hosts: hosts.map(toHost) };
  }
  const own = await hostsForIdentity(identity);
  if (!own.length) return { allowed: false as const, viewer: null, hosts: [] };
  const partners = await partnerHosts({ id: { in: own.map(host => host.id) }, active: true, revenuePartner: true });
  return partners.length
    ? { allowed: true as const, viewer: "PARTNER" as const, hosts: partners.map(toHost) }
    : { allowed: false as const, viewer: null, hosts: [] };
}

/**
 * The current Sīrah course's received-after-refunds money for a period (the
 * same figures as the admin "Payments by course" report), the host's agreed
 * share of it, their outstanding advances and the net payable, per currency.
 * Advances are a running balance, so the whole outstanding amount is
 * deducted whatever period is shown. Legacy (pre-Sīrah) registrations are a
 * separate programme and are not included.
 */
export async function sirahTeacherEarnings(period: RevenuePeriod, host: EarningsHost | null) {
  const [report, history] = await Promise.all([courseRevenueReport(period), host ? teacherAdvanceHistory([host.id]) : Promise.resolve([])]);
  const program = report.programs.find(item => item.id.endsWith(":sirah"));
  const percent = host?.percent ?? SIRAH_TEACHER_SHARE_PERCENT;
  const advances = outstandingAdvances(history);
  return {
    period,
    percent,
    title: program?.title ?? null,
    rows: teacherEarnings(program?.received ?? [], program?.refunds ?? [], percent, advances),
    history,
    /** Money awaiting finance review is not counted until it is confirmed. */
    inReview: program?.ambiguous ?? [],
    undatedRefunds: program?.undatedRefunds ?? 0,
  };
}
