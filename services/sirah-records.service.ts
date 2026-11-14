import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SIRAH_SLUG } from "@/lib/sirah/catalog";
import {
  sirahDeletionRefusal,
  type SirahRecordsAction,
} from "@/lib/sirah/admin-records";
import { auditSirah, jsonValue, SirahError } from "./sirah-registration.service";

type Result = { id: string; reference?: string; ok: boolean; reason?: string };

/**
 * Super-admin bulk housekeeping (callers must enforce the super-admin gate).
 * Exclude / include only set or clear the analytics flag and write an audit
 * row. Delete re-checks the payment-free rule inside a serializable
 * transaction per order and logs a SirahRecordDeletion before removing it.
 * The order state machine, checkout and enrolment are never touched.
 */
export async function applySirahRecordsAction(
  input: SirahRecordsAction,
  actor: string,
) {
  if (input.action === "DELETE" && input.confirmation !== "DELETE")
    throw new SirahError("Type DELETE to confirm permanent deletion.", 400);
  const ids = [...new Set(input.orderIds)];
  const results: Result[] = [];
  for (const id of ids) {
    try {
      results.push(
        input.action === "DELETE"
          ? await deleteOne(id, actor)
          : await setExcluded(id, input.action === "EXCLUDE", actor, input.note),
      );
    } catch (error) {
      results.push({
        id,
        ok: false,
        reason: error instanceof SirahError ? error.message : "Could not update this record.",
      });
    }
  }
  return {
    action: input.action,
    done: results.filter((result) => result.ok).length,
    refused: results.filter((result) => !result.ok).length,
    results,
  };
}

async function setExcluded(id: string, exclude: boolean, actor: string, note?: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.sirahOrder.findFirst({
      where: { id, course: { slug: SIRAH_SLUG } },
      select: { id: true, reference: true, excludedAt: true },
    });
    if (!order) throw new SirahError("Registration not found.", 404);
    if (exclude === !!order.excludedAt)
      return {
        id,
        reference: order.reference,
        ok: true,
        reason: exclude ? "Already excluded." : "Already included.",
      };
    // Only the analytics flag changes: no revision bump, no state change.
    const changed = await tx.sirahOrder.updateMany({
      where: { id, excludedAt: exclude ? null : { not: null } },
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

async function deleteOne(id: string, actor: string): Promise<Result> {
  return prisma.$transaction(
    async (tx) => {
      const order = await tx.sirahOrder.findFirst({
        where: { id, course: { slug: SIRAH_SLUG } },
        include: { user: { select: { email: true, fullName: true } } },
      });
      if (!order) throw new SirahError("Registration not found.", 404);
      const [paymentEvents, receipts] = await Promise.all([
        tx.sirahPaymentEvent.count({ where: { orderId: id } }),
        tx.sirahReceipt.count({ where: { orderId: id } }),
      ]);
      const refusal = sirahDeletionRefusal(order, { paymentEvents, receipts });
      if (refusal)
        return {
          id,
          reference: order.reference,
          ok: false,
          reason: `${refusal} Exclude it instead.`,
        };
      const { user, ...row } = order;
      await tx.sirahRecordDeletion.create({
        data: {
          orderId: id,
          reference: order.reference,
          email: user.email,
          fullName: user.fullName,
          actor,
          snapshot: jsonValue(row) as Prisma.InputJsonValue,
        },
      });
      await tx.sirahNotification.deleteMany({ where: { orderId: id } });
      await tx.sirahAudit.deleteMany({ where: { orderId: id } });
      await tx.sirahResumeLink.deleteMany({ where: { orderId: id } });
      // Guard the final delete on the state that was checked above.
      const deleted = await tx.sirahOrder.deleteMany({
        where: {
          id,
          revision: order.revision,
          paidCount: 0,
          paidMinor: 0,
          registrationId: null,
        },
      });
      if (deleted.count !== 1)
        throw new SirahError("This record changed. Reload and try again.", 409);
      return { id, reference: order.reference, ok: true };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 20000 },
  );
}
