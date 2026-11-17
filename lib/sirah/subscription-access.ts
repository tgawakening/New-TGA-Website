import type { SirahOrder } from "@prisma/client";
import { addMonthsClamped } from "@/services/sirah-confirmation.service";
import { CYCLE_PAYMENTS, dueAfterPayments, orderCycle, type CycleFields } from "./billing-cycle";

/** Use a paid boundary, never the end of twelve unpaid programme months. */
export function paidSirahPeriodEnd(
  order: Pick<
    SirahOrder,
    | "plan"
    | "paymentState"
    | "cancelledAt"
    | "paidCount"
    | "accessEndsAt"
    | "nextBillingAt"
    | "programmeStart"
    | "programmeEnd"
  > &
    CycleFields,
): Date | null {
  if (order.plan !== "MONTHLY" || order.paidCount < 1) return null;
  // Cohort cycle: paid through the due date the verified payments reach.
  // Never a grace end: grace is access for an unpaid month, not a paid one.
  if (orderCycle(order)) {
    const due = dueAfterPayments(order, Math.min(order.paidCount, CYCLE_PAYMENTS))!;
    return new Date(
      Math.min(due.getTime(), order.programmeEnd?.getTime() ?? Infinity),
    );
  }
  const lockedEnd =
    order.paymentState === "FAILED" && !order.cancelledAt
      ? null
      : order.accessEndsAt;
  const end =
    lockedEnd ||
    order.nextBillingAt ||
    (order.programmeStart
      ? addMonthsClamped(order.programmeStart, Math.min(order.paidCount, 12))
      : null);
  if (!end || !Number.isFinite(end.getTime())) return null;
  return new Date(
    Math.min(end.getTime(), order.programmeEnd?.getTime() ?? Infinity),
  );
}
