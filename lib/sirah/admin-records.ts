import { z } from "zod";

/**
 * Housekeeping for test / junk Sīrah registrations.
 * - Exclude (soft, reversible; Super Admin or Manager, one row or a checkbox
 *   selection): the order is hidden from the admin Students and
 *   Payments lists, the CSV export and the Overview counts. Nothing about the
 *   order itself changes; students are unaffected.
 * - Delete = archive (soft, reversible for 7 days; Super Admin only, one row
 *   at a time, never from the selection): only for orders that never
 *   involved a real payment. archivedAt is set; the row is hidden from every
 *   admin list, count and student-facing query and shown only in the Archive
 *   view, where it can be restored. The sirah-maintenance job hard-deletes it
 *   once SIRAH_ARCHIVE_RETENTION_DAYS have passed; that purge is the only code
 *   path that deletes an order.
 */

/** Prisma filter for orders that count in admin lists and analytics. */
export const INCLUDED_ORDERS = { excludedAt: null, archivedAt: null };
/** Prisma filter for orders a super admin or manager marked as test / excluded. */
export const EXCLUDED_ORDERS = { excludedAt: { not: null }, archivedAt: null };
/** Prisma filter for orders in the Archive view (awaiting purge). */
export const ARCHIVED_ORDERS = { archivedAt: { not: null } };

/** Days an archived order stays restorable before the maintenance purge. */
export const SIRAH_ARCHIVE_RETENTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
/** When an order archived at `archivedAt` becomes eligible for purge. */
export const sirahArchivePurgeAt = (archivedAt: Date) =>
  new Date(archivedAt.getTime() + SIRAH_ARCHIVE_RETENTION_DAYS * DAY_MS);
/** Orders archived before this instant are past retention at `now`. */
export const sirahArchivePurgeCutoff = (now: Date) =>
  new Date(now.getTime() - SIRAH_ARCHIVE_RETENTION_DAYS * DAY_MS);

export const DELETABLE_PAYMENT_STATES = ["UNPAID", "FAILED", "REJECTED"];
export const DELETABLE_ENROLMENT_STATES = ["PENDING", "CANCELLED"];

/**
 * Why an order may NOT be archived (and so never purged), or null when it is a
 * payment-free junk row. Anything that ever touched real money, an open checkout that could
 * still settle, an enrolment or uploaded transfer evidence can only be excluded.
 */
export function sirahDeletionRefusal(
  order: {
    paidCount: number;
    paidMinor: number;
    refundedMinor: number;
    registrationId?: string | null;
    paymentState: string;
    enrolmentState: string;
    providerOrderId?: string | null;
    providerSubscriptionId?: string | null;
  },
  related: { paymentEvents: number; receipts: number; ledgerPayments?: number; paymentPlans?: number },
): string | null {
  if (related.ledgerPayments || related.paymentPlans) return "It has a ledger payment or monthly plan.";
  if (related.paymentEvents > 0 || order.paidCount > 0 || order.paidMinor > 0)
    return "It has a recorded payment.";
  if (order.refundedMinor > 0) return "It has a recorded refund.";
  if (order.registrationId) return "It has an enrolment record.";
  if (!DELETABLE_ENROLMENT_STATES.includes(order.enrolmentState))
    return `Its course access is ${order.enrolmentState.toLowerCase()}.`;
  if (!DELETABLE_PAYMENT_STATES.includes(order.paymentState))
    return order.paymentState === "PROCESSING"
      ? "It has an open online checkout that could still be paid."
      : order.paymentState === "AWAITING_REVIEW"
        ? "It has a payment receipt awaiting review."
        : `Its payment status is ${order.paymentState.toLowerCase()}.`;
  if (order.providerOrderId || order.providerSubscriptionId)
    return "It has a card/PayPal checkout reference that could still settle.";
  if (related.receipts > 0) return "It has an uploaded payment receipt.";
  return null;
}

/** One record per request. The only multi-record operation is the
 * exclude / un-exclude bulk below; there is no bulk archive or delete. */
export const sirahRecordsActionSchema = z
  .object({
    action: z.enum(["EXCLUDE", "INCLUDE", "ARCHIVE", "RESTORE"]),
    orderId: z.string().trim().min(1).max(191),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
export type SirahRecordsAction = z.infer<typeof sirahRecordsActionSchema>;

/** Record actions a Manager may run, alongside the Super Admin. Archive
 * ("delete") and restore stay Super Admin only. */
export const SIRAH_EXCLUSION_ACTIONS = ["EXCLUDE", "INCLUDE"] as const;

/** Most records one bulk exclusion request may touch (one list page and more). */
export const SIRAH_BULK_EXCLUSION_MAX = 100;

/**
 * Checkbox selection in the records list drives ONLY exclude / un-exclude.
 * This schema has no ARCHIVE, RESTORE or DELETE: the selection can never be
 * used to delete or archive anything. Delete stays a one-record, super-admin
 * action on sirahRecordsActionSchema.
 */
export const sirahBulkExclusionSchema = z
  .object({
    action: z.enum(SIRAH_EXCLUSION_ACTIONS),
    orderIds: z
      .array(z.string().trim().min(1).max(191))
      .min(1)
      .max(SIRAH_BULK_EXCLUSION_MAX)
      .transform((ids) => [...new Set(ids)]),
  })
  .strict();
export type SirahBulkExclusion = z.infer<typeof sirahBulkExclusionSchema>;
