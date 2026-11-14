import { z } from "zod";

/**
 * Super-admin housekeeping for test / junk Sīrah registrations.
 * - Exclude (soft, reversible): the order is hidden from the admin Students and
 *   Payments lists, the CSV export and the Overview counts. Nothing about the
 *   order itself changes; students are unaffected.
 * - Delete permanently: only for orders that never involved a real payment.
 */

/** Prisma filter for orders that count in admin lists and analytics. */
export const INCLUDED_ORDERS = { excludedAt: null };
/** Prisma filter for orders a super admin marked as test / excluded. */
export const EXCLUDED_ORDERS = { excludedAt: { not: null } };

export const DELETABLE_PAYMENT_STATES = ["UNPAID", "FAILED", "REJECTED"];
export const DELETABLE_ENROLMENT_STATES = ["PENDING", "CANCELLED"];

/**
 * Why an order may NOT be deleted permanently, or null when it is a payment-free
 * junk row. Anything that ever touched real money, an open checkout that could
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
  related: { paymentEvents: number; receipts: number },
): string | null {
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

export const sirahRecordsActionSchema = z
  .object({
    action: z.enum(["EXCLUDE", "INCLUDE", "DELETE"]),
    orderIds: z.array(z.string().trim().min(1).max(191)).min(1).max(100),
    /** Required for DELETE: the typed confirmation word. */
    confirmation: z.string().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
export type SirahRecordsAction = z.infer<typeof sirahRecordsActionSchema>;
