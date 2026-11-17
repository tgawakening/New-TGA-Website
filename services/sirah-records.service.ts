import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SIRAH_SLUG } from "@/lib/sirah/catalog";
import {
  DELETABLE_PAYMENT_STATES,
  sirahArchivePurgeCutoff,
  sirahDeletionRefusal,
  type SirahBulkExclusion,
  type SirahRecordsAction,
} from "@/lib/sirah/admin-records";
import { auditSirah, jsonValue, SirahError } from "./sirah-registration.service";

type Result = { id: string; reference?: string; ok: boolean; reason?: string };

const SERIALIZABLE = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10000,
  timeout: 20000,
};

/**
 * Housekeeping on ONE record (callers enforce the role gate: EXCLUDE / INCLUDE
 * for Super Admin or Manager, ARCHIVE / RESTORE for Super Admin only).
 * - EXCLUDE / INCLUDE set or clear the analytics flag.
 * - ARCHIVE is the admin "Delete" (never bulk): a soft delete that sets archivedAt after
 *   re-checking the payment-free rule. Nothing is removed.
 * - RESTORE clears archivedAt.
 * Each writes an audit row. The order state machine, checkout and enrolment
 * are never touched. No admin action deletes a row: only the maintenance purge
 * (purgeExpiredArchivedSirahOrders) does, 7 days after archiving.
 */
export async function applySirahRecordsAction(
  input: SirahRecordsAction,
  actor: string,
): Promise<Result & { action: SirahRecordsAction["action"] }> {
  const id = input.orderId;
  const result =
    input.action === "ARCHIVE"
      ? await archiveOne(id, actor, input.note)
      : input.action === "RESTORE"
        ? await restoreOne(id, actor, input.note)
        : await setExcluded(id, input.action === "EXCLUDE", actor, input.note);
  return { action: input.action, ...result };
}

/**
 * Exclude / un-exclude a checkbox selection. Structurally limited to the
 * analytics flag: it calls setExcluded and nothing else, so a selection can
 * never archive, restore or delete a record. Each record is its own
 * transaction; one failure (e.g. archived meanwhile) does not stop the rest.
 */
export async function applySirahBulkExclusion(
  input: SirahBulkExclusion,
  actor: string,
): Promise<{ action: SirahBulkExclusion["action"]; results: Result[] }> {
  const exclude = input.action === "EXCLUDE";
  const results: Result[] = [];
  for (const id of input.orderIds) {
    try {
      results.push(await setExcluded(id, exclude, actor));
    } catch (error) {
      results.push({
        id,
        ok: false,
        reason: error instanceof SirahError ? error.message : "Could not update this record.",
      });
    }
  }
  return { action: input.action, results };
}

async function setExcluded(id: string, exclude: boolean, actor: string, note?: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.sirahOrder.findFirst({
      where: { id, course: { slug: SIRAH_SLUG }, archivedAt: null },
      select: { id: true, reference: true, excludedAt: true },
    });
    if (!order) throw new SirahError("Registration not found. Restore it from the archive first.", 404);
    if (exclude === !!order.excludedAt)
      return {
        id,
        reference: order.reference,
        ok: true,
        reason: exclude ? "Already excluded." : "Already included.",
      };
    // Only the analytics flag changes: no revision bump, no state change.
    const changed = await tx.sirahOrder.updateMany({
      where: { id, archivedAt: null, excludedAt: exclude ? null : { not: null } },
      data: exclude
        ? { excludedAt: new Date(), excludedBy: actor }
        : { excludedAt: null, excludedBy: null },
    });
    if (!changed.count) throw new SirahError("This record changed. Reload and try again.", 409);
    await auditSirah(
      tx,
      id,
      actor,
      exclude ? "EXCLUDED_FROM_ANALYTICS" : "INCLUDED_IN_ANALYTICS",
      { note: note || null },
    );
    return { id, reference: order.reference, ok: true };
  });
}

/** Soft delete: set archivedAt on a payment-free order. Never removes a row. */
async function archiveOne(id: string, actor: string, note?: string): Promise<Result> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.sirahOrder.findFirst({
      where: { id, course: { slug: SIRAH_SLUG } },
    });
    if (!order) throw new SirahError("Registration not found.", 404);
    if (order.archivedAt)
      return { id, reference: order.reference, ok: true, reason: "Already archived." };
    const [paymentEvents, receipts] = await Promise.all([
      tx.sirahPaymentEvent.count({ where: { orderId: id } }),
      tx.sirahReceipt.count({ where: { orderId: id } }),
    ]);
    const refusal = sirahDeletionRefusal(order, { paymentEvents, receipts });
    if (refusal)
      throw new SirahError(`${refusal} It cannot be deleted. Exclude it instead.`, 409);
    // Guarded on the exact state checked above. The revision bump makes any
    // in-flight student checkout on this order fail its optimistic check.
    const changed = await tx.sirahOrder.updateMany({
      where: {
        id,
        revision: order.revision,
        archivedAt: null,
        paidCount: 0,
        paidMinor: 0,
        refundedMinor: 0,
        registrationId: null,
        providerOrderId: null,
        providerSubscriptionId: null,
        paymentState: { in: DELETABLE_PAYMENT_STATES },
      },
      data: { archivedAt: new Date(), revision: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new SirahError("This record changed. Reload and try again.", 409);
    await auditSirah(tx, id, actor, "ARCHIVED", { note: note || null });
    return { id, reference: order.reference, ok: true };
  }, SERIALIZABLE);
}

async function restoreOne(id: string, actor: string, note?: string): Promise<Result> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.sirahOrder.findFirst({
      where: { id, course: { slug: SIRAH_SLUG } },
      select: { id: true, reference: true, archivedAt: true },
    });
    if (!order) throw new SirahError("Registration not found. It may already have been purged.", 404);
    if (!order.archivedAt)
      return { id, reference: order.reference, ok: true, reason: "Not archived." };
    const changed = await tx.sirahOrder.updateMany({
      where: { id, archivedAt: { not: null } },
      data: { archivedAt: null },
    });
    if (!changed.count) throw new SirahError("This record changed. Reload and try again.", 409);
    await auditSirah(tx, id, actor, "RESTORED_FROM_ARCHIVE", {
      archivedAt: order.archivedAt.toISOString(),
      note: note || null,
    });
    return { id, reference: order.reference, ok: true };
  });
}

const PURGE_ACTOR = "system:archive-purge";

/**
 * THE ONLY code path that hard-deletes a SirahOrder. Called by the
 * sirah-maintenance job. Scope: orders whose archivedAt is more than
 * SIRAH_ARCHIVE_RETENTION_DAYS before `now`, nothing else.
 *
 * Each order is purged in its own serializable transaction that re-checks the
 * archive cutoff and the payment-free rule, writes a SirahRecordDeletion log
 * row (with a snapshot), removes the order's own audit / notification / resume
 * link rows (foreign keys), and deletes the order guarded on the state it read.
 * If anything changed (restored, paid, receipt attached) it is skipped. Every
 * deleted id is logged.
 */
export async function purgeExpiredArchivedSirahOrders(now = new Date()) {
  const cutoff = sirahArchivePurgeCutoff(now);
  const candidates = await prisma.sirahOrder.findMany({
    where: { archivedAt: { not: null, lt: cutoff } },
    select: { id: true },
    orderBy: { archivedAt: "asc" },
    take: 100,
  });
  const deleted: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const { id } of candidates) {
    try {
      const outcome = await prisma.$transaction(async (tx) => {
        const order = await tx.sirahOrder.findFirst({
          where: { id, archivedAt: { not: null, lt: cutoff } },
          include: { user: { select: { email: true, fullName: true } } },
        });
        if (!order) return "No longer archived past retention.";
        const [paymentEvents, receipts] = await Promise.all([
          tx.sirahPaymentEvent.count({ where: { orderId: id } }),
          tx.sirahReceipt.count({ where: { orderId: id } }),
        ]);
        const refusal = sirahDeletionRefusal(order, { paymentEvents, receipts });
        if (refusal) return refusal;
        const { user, ...row } = order;
        await tx.sirahRecordDeletion.create({
          data: {
            orderId: id,
            reference: order.reference,
            email: user.email,
            fullName: user.fullName,
            actor: PURGE_ACTOR,
            snapshot: jsonValue(row) as Prisma.InputJsonValue,
          },
        });
        await tx.sirahNotification.deleteMany({ where: { orderId: id } });
        await tx.sirahAudit.deleteMany({ where: { orderId: id } });
        await tx.sirahResumeLink.deleteMany({ where: { orderId: id } });
        const removed = await tx.sirahOrder.deleteMany({
          where: {
            id,
            revision: order.revision,
            archivedAt: { not: null, lt: cutoff },
            paidCount: 0,
            paidMinor: 0,
            refundedMinor: 0,
            registrationId: null,
          },
        });
        // Throwing rolls back the log row and child deletes above.
        if (removed.count !== 1) throw new SirahError("Order changed during purge.", 409);
        return null;
      }, SERIALIZABLE);
      if (outcome) {
        skipped.push({ id, reason: outcome });
        console.warn(`[sirah-archive-purge] skipped ${id}: ${outcome}`);
      } else {
        deleted.push(id);
        console.info(`[sirah-archive-purge] deleted SirahOrder ${id}`);
      }
    } catch (error) {
      const reason = error instanceof SirahError ? error.message : "Purge failed.";
      skipped.push({ id, reason });
      console.warn(`[sirah-archive-purge] skipped ${id}: ${reason}`);
    }
  }
  return { cutoff: cutoff.toISOString(), scanned: candidates.length, deleted, skipped };
}
