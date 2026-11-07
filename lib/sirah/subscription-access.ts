import type { SirahOrder } from "@prisma/client";
import { addMonthsClamped } from "@/services/sirah-confirmation.service";

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
  >,
): Date | null {
  if (order.plan !== "MONTHLY" || order.paidCount < 1) return null;
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
