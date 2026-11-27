import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decimalToMinor } from "@/lib/sirah/catalog";
import { pakistanCalendarDate } from "@/lib/sirah/cohort-dates";
import { outstandingAdvances, parseSharePercent } from "@/lib/lms/teacher-earnings";
import { serializable } from "./sirah-confirmation.service";

export class TeacherRevenueError extends Error {}

/**
 * Read-only rollout check: false until the teacher-advances migration
 * (ZoomHost.revenueSharePercent, TeacherAdvance) is applied, so pages keep
 * working with the default share and no advances. Never creates anything.
 */
export async function teacherRevenueSchemaAvailable() {
  try {
    await Promise.all([
      prisma.teacherAdvance.findFirst({ select: { id: true } }),
      prisma.zoomHost.findFirst({ select: { revenueSharePercent: true } }),
    ]);
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022")) return false;
    throw error;
  }
}

const MAX_MINOR = 2147483647; // INTEGER column

/** Set (or clear, with an empty value) a host's agreed share. Audited with the before and after values. */
export async function setHostSharePercent(hostId: string, input: string, actor: string) {
  const parsed = parseSharePercent(input);
  if (!parsed.ok) throw new TeacherRevenueError(parsed.error);
  return prisma.$transaction(async tx => {
    const host = await tx.zoomHost.findFirst({ where: { id: hostId, active: true }, select: { id: true, email: true, revenueSharePercent: true } });
    if (!host) throw new TeacherRevenueError("That active host no longer exists.");
    const before = host.revenueSharePercent == null ? "DEFAULT" : Number(host.revenueSharePercent.toString()).toFixed(2);
    const after = parsed.value ?? "DEFAULT";
    if (before === after) return { changed: false, value: parsed.value };
    await tx.zoomHost.update({ where: { id: host.id }, data: { revenueSharePercent: parsed.value } });
    await tx.sirahAccessAudit.create({ data: { actor, action: parsed.value === null ? "REVENUE_SHARE_CLEARED" : "REVENUE_SHARE_SET", targetEmail: host.email, fromStatus: before, toStatus: after } });
    return { changed: true, value: parsed.value };
  });
}

export type AdvanceInput = { kind: "ADVANCE" | "REDUCTION"; amount: string; currency: string; reason: string; date: string };

/**
 * Append one ledger row: an advance given (+) or an advance reduced or
 * recovered (−). Rows are never edited or deleted; a mistake is corrected
 * with a further entry. A reduction cannot take the outstanding amount in
 * that currency below zero.
 */
export async function recordTeacherAdvance(hostId: string, input: AdvanceInput, actor: string) {
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new TeacherRevenueError("Enter a three-letter currency code, for example GBP.");
  let minor: number;
  try { minor = decimalToMinor(input.amount.trim(), currency); } catch { throw new TeacherRevenueError("Enter a valid amount for this currency."); }
  if (minor <= 0 || minor > MAX_MINOR) throw new TeacherRevenueError("Enter an amount above zero within the supported limit.");
  const reason = input.reason.trim();
  if (!reason || reason.length > 500) throw new TeacherRevenueError("Enter a reason (up to 500 characters).");
  const date = input.date.trim();
  const occurredOn = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(occurredOn.getTime()) || occurredOn.toISOString().slice(0, 10) !== date || date > pakistanCalendarDate(new Date()))
    throw new TeacherRevenueError("Choose a valid date that is not in the future.");
  if (input.kind !== "ADVANCE" && input.kind !== "REDUCTION") throw new TeacherRevenueError("Choose whether this records or reduces an advance.");
  return serializable(async tx => {
    const host = await tx.zoomHost.findFirst({ where: { id: hostId, active: true }, select: { id: true } });
    if (!host) throw new TeacherRevenueError("That active host no longer exists.");
    if (input.kind === "REDUCTION") {
      const entries = await tx.teacherAdvance.findMany({ where: { zoomHostId: host.id, currency }, select: { currency: true, amountMinor: true } });
      const outstanding = outstandingAdvances(entries)[0]?.amountMinor ?? 0;
      if (minor > outstanding) throw new TeacherRevenueError(outstanding > 0 ? "A reduction cannot be more than the outstanding advance in this currency." : "There is no outstanding advance in this currency to reduce.");
    }
    return tx.teacherAdvance.create({
      data: { zoomHostId: host.id, amountMinor: input.kind === "ADVANCE" ? minor : -minor, currency, reason, occurredOn, createdBy: actor },
      select: { id: true, amountMinor: true, currency: true },
    });
  });
}

/** Every entry, newest first, for the admin history and the teacher's own deductions. */
export async function teacherAdvanceHistory(hostIds: string[]) {
  if (!hostIds.length || !(await teacherRevenueSchemaAvailable())) return [];
  return prisma.teacherAdvance.findMany({
    where: { zoomHostId: { in: hostIds } },
    select: { id: true, zoomHostId: true, amountMinor: true, currency: true, reason: true, occurredOn: true, createdBy: true, createdAt: true },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
  });
}
