import { SIRAH_SLUG, SIRAH_TITLE } from "./catalog";
import { paymentPlanPeriods, type PlanTerms, type StoredPeriod } from "./payment-plan";
import { monthlyDueDate } from "./payment-plan-dates";

export type CourseIdentity = { id: string; slug: string; title: string };

/** The historical and new Seerah workflows share one Course row. */
export function revenueProgram(course: CourseIdentity, source: "legacy" | "sirah") {
  if (course.slug === SIRAH_SLUG) return source === "legacy"
    ? { id: `${course.id}:legacy`, title: "Prophetic Seerah and Planning (legacy)" }
    : { id: `${course.id}:sirah`, title: SIRAH_TITLE };
  return { id: course.id, title: course.title };
}

export type MoneyGroup = { currency: string; amountMinor: number };
export type MethodGroup = MoneyGroup & { method: string };

export function addMoney(map: Map<string, number>, currency: string, amount: number) {
  if (!Number.isSafeInteger(amount)) throw new Error("Invalid payment amount.");
  const total = (map.get(currency) ?? 0) + amount;
  if (!Number.isSafeInteger(total)) throw new Error("Payment total exceeds supported precision.");
  map.set(currency, total);
}

export function moneyGroups(map: Map<string, number>): MoneyGroup[] {
  return [...map].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amountMinor]) => ({ currency, amountMinor }));
}

/** Outstanding periods and the next future instalment, however far away it is. */
export function planNextDueTotals(plan: PlanTerms, saved: StoredPeriod[], now: Date) {
  const local = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const today = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  const nextMonth = monthlyDueDate(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate());
  const end = plan.firstDueAt > nextMonth ? plan.firstDueAt : nextMonth;
  const periods = paymentPlanPeriods(plan, saved, new Date(end.getTime() + 12 * 60 * 60 * 1000));
  let dueMinor = 0, upcomingMinor = 0;
  for (const period of periods) {
    const remaining = Math.max(0, period.amountMinor - period.paidMinor);
    if (period.dueAt <= today) dueMinor += remaining;
    else { upcomingMinor = remaining; break; }
  }
  return { dueMinor, upcomingMinor };
}
