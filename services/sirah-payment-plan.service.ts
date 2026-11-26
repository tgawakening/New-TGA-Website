import "server-only";
import type { Prisma } from "@prisma/client";
import { decimalToMinor } from "@/lib/sirah/catalog";
import { monthlyDueDate, planDate } from "@/lib/sirah/payment-plan-dates";
import { paymentPlanPeriods, remainingArrears, totalPlanOutstanding } from "@/lib/sirah/payment-plan";
import { SirahError } from "./sirah-registration.service";

const include = { periods: { include: { payments: { select: { amountMinor: true } } } } } as const;

export async function planSnapshot(tx: Prisma.TransactionClient, orderId: string) {
  const plan = await tx.sirahPaymentPlan.findUnique({ where: { orderId }, include });
  if (!plan) return null;
  const periods = paymentPlanPeriods(plan, plan.periods);
  return { ...plan, periods, remainingArrearsMinor: remainingArrears(plan.openingArrearsMinor, periods), outstandingMinor: totalPlanOutstanding(plan.openingArrearsMinor, periods) };
}

/** Persist calculated periods before changing terms or allocating a payment. Call with the order row locked. */
export async function freezePeriods(tx: Prisma.TransactionClient, orderId: string) {
  const snapshot = await planSnapshot(tx, orderId);
  if (!snapshot) return null;
  for (const period of snapshot.periods) if (!period.id) {
    await tx.sirahPaymentPeriod.create({ data: { planId: snapshot.id, periodMonth: period.periodMonth, dueAt: period.dueAt, amountMinor: period.amountMinor, arrearsPartMinor: period.arrearsPartMinor } });
  }
  return planSnapshot(tx, orderId);
}

function amount(value: unknown, currency: string, label: string) {
  if (typeof value !== "string" || value.length > 20) throw new SirahError(`Enter a valid ${label}.`);
  try {
    const minor = decimalToMinor(value, currency);
    if (minor > 2147483647) throw new Error();
    return minor;
  } catch { throw new SirahError(`Enter a valid ${label}.`); }
}
function date(value: unknown, label: string) {
  if (typeof value !== "string") throw new SirahError(`Enter a valid ${label}.`);
  try { return planDate(value); } catch { throw new SirahError(`Enter a valid ${label}.`); }
}

export async function savePaymentPlan(tx: Prisma.TransactionClient, orderId: string, currency: string, input: Record<string, unknown>) {
  const existing = await freezePeriods(tx, orderId);
  const monthlyMinor = amount(input.monthly, currency, "monthly amount");
  const arrearsPartMinor = amount(input.arrearsPart, currency, "monthly arrears portion");
  const billingDay = Number(input.billingDay);
  if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31 || !monthlyMinor || arrearsPartMinor > monthlyMinor) throw new SirahError("Check the billing day and monthly amounts. The arrears portion cannot exceed the monthly amount.");
  const firstDueAt = existing?.firstDueAt ?? date(input.firstDue, "first due date");
  const now = new Date();
  if (!existing && (firstDueAt < new Date(Date.UTC(now.getUTCFullYear() - 40, now.getUTCMonth(), 1)) || firstDueAt > new Date(Date.UTC(now.getUTCFullYear() + 5, now.getUTCMonth(), 1)))) throw new SirahError("Choose a first due date within the supported range.");
  if (!existing && monthlyDueDate(firstDueAt.getUTCFullYear(), firstDueAt.getUTCMonth(), billingDay).getTime() !== firstDueAt.getTime()) throw new SirahError("The first due date must match the billing day (or the last day of a shorter month).");
  const openingArrearsMinor = existing?.openingArrearsMinor ?? amount(input.openingArrears, currency, "opening arrears");
  const changeAt = input.changeAt ? date(input.changeAt, "change date") : null;
  const nextMonthlyMinor = changeAt ? amount(input.nextMonthly, currency, "second monthly amount") : null;
  const nextArrearsMinor = changeAt ? amount(input.nextArrears, currency, "second arrears portion") : null;
  if (changeAt && (!nextMonthlyMinor || nextArrearsMinor! > nextMonthlyMinor)) throw new SirahError("Check the second monthly amount and arrears portion.");
  if (changeAt && changeAt < firstDueAt) throw new SirahError("The change date cannot precede the first due date.");
  const terms = { billingDay, monthlyMinor, arrearsPartMinor, changeAt, nextMonthlyMinor, nextArrearsMinor };
  if (existing) return tx.sirahPaymentPlan.update({ where: { orderId }, data: terms });
  return tx.sirahPaymentPlan.create({ data: { ...terms, orderId, firstDueAt, openingArrearsMinor } });
}
