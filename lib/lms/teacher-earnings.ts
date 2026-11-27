import { addMoney, moneyGroups, type MoneyGroup } from "@/lib/sirah/course-revenue";

/**
 * The teacher's agreed share of Sīrah money received after refunds. One value
 * for the course until a per-teacher share is stored (proposed nullable
 * column ZoomHost.revenueSharePercent, not yet applied).
 */
export const SIRAH_TEACHER_SHARE_PERCENT = 70;

export type TeacherEarningsRow = {
  currency: string;
  receivedMinor: number;
  refundedMinor: number;
  /** Received after refunds: the same figure as the admin course report. */
  netMinor: number;
  /** The teacher's share of netMinor, rounded to the nearest minor unit. */
  shareMinor: number;
};

/** Per currency, never converted: received, refunds, net, and the teacher's share of net. */
export function teacherEarnings(received: MoneyGroup[], refunds: MoneyGroup[], percent: number): TeacherEarningsRow[] {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error("The share must be between 0 and 100 percent.");
  const receivedMap = new Map<string, number>(), refundMap = new Map<string, number>();
  for (const item of received) addMoney(receivedMap, item.currency, item.amountMinor);
  for (const item of refunds) addMoney(refundMap, item.currency, item.amountMinor);
  const currencies = moneyGroups(new Map([...receivedMap, ...refundMap].map(([currency]) => [currency, 0])));
  return currencies.map(({ currency }) => {
    const receivedMinor = receivedMap.get(currency) ?? 0;
    const refundedMinor = refundMap.get(currency) ?? 0;
    const netMinor = receivedMinor - refundedMinor;
    return { currency, receivedMinor, refundedMinor, netMinor, shareMinor: Math.round((netMinor * percent) / 100) };
  });
}
