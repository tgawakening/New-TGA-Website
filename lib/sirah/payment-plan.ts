import { monthlyDueDate, periodStatus } from "./payment-plan-dates";

export type PlanTerms = { firstDueAt: Date; billingDay: number; monthlyMinor: number; arrearsPartMinor: number; openingArrearsMinor: number; changeAt: Date | null; nextMonthlyMinor: number | null; nextArrearsMinor: number | null };
export type StoredPeriod = { id: string; periodMonth: string; dueAt: Date; amountMinor: number; arrearsPartMinor: number; payments: { amountMinor: number }[] };

/** Existing snapshots take precedence over current plan terms, preserving history. */
export function paymentPlanPeriods(plan: PlanTerms, saved: StoredPeriod[], now = new Date()) {
  const local = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const start = plan.firstDueAt.getUTCFullYear() * 12 + plan.firstDueAt.getUTCMonth();
  const end = local.getUTCFullYear() * 12 + local.getUTCMonth();
  if (end - start > 600) throw new Error("Plan history exceeds supported length.");
  const byMonth = new Map(saved.map(period => [period.periodMonth, period]));
  const periods = [];
  let allocatedArrears = 0;
  for (let month = start; month <= end; month++) {
    const year = Math.floor(month / 12), index = month % 12;
    const monthKey = `${year}-${String(index + 1).padStart(2, "0")}`;
    const stored = byMonth.get(monthKey);
    const dueAt = stored?.dueAt ?? (month === start ? plan.firstDueAt : monthlyDueDate(year, index, plan.billingDay));
    const changed = plan.changeAt !== null && dueAt >= plan.changeAt;
    const configuredAmount = changed ? plan.nextMonthlyMinor! : plan.monthlyMinor;
    const configuredArrears = changed ? plan.nextArrearsMinor! : plan.arrearsPartMinor;
    // Reserve each part of the opening arrears only once, even if a period is overdue.
    const arrearsPartMinor = stored?.arrearsPartMinor ?? Math.min(configuredArrears, Math.max(0, plan.openingArrearsMinor - allocatedArrears));
    const amountMinor = stored?.amountMinor ?? configuredAmount - configuredArrears + arrearsPartMinor;
    allocatedArrears += arrearsPartMinor;
    const paidMinor = stored?.payments.reduce((sum, payment) => sum + payment.amountMinor, 0) ?? 0;
    periods.push({ id: stored?.id ?? null, periodMonth: monthKey, dueAt, amountMinor, arrearsPartMinor, paidMinor, status: periodStatus(dueAt, amountMinor, paidMinor, now) });
  }
  return periods;
}

/** Partial payments cover the regular portion first; only the remainder repays arrears. */
export function remainingArrears(opening: number, periods: { amountMinor: number; arrearsPartMinor: number; paidMinor: number }[]) {
  const repaid = periods.reduce((sum, period) => sum + Math.min(period.arrearsPartMinor, Math.max(0, period.paidMinor - (period.amountMinor - period.arrearsPartMinor))), 0);
  return Math.max(0, opening - repaid);
}

/** Opening arrears plus the unpaid regular portion of each elapsed/current period. */
export function totalPlanOutstanding(opening: number, periods: { amountMinor: number; arrearsPartMinor: number; paidMinor: number }[]) {
  return remainingArrears(opening, periods) + periods.reduce((sum, period) => sum + Math.max(0, period.amountMinor - period.arrearsPartMinor - period.paidMinor), 0);
}
