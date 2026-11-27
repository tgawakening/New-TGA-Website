import { addMoney, moneyGroups, type MoneyGroup } from "@/lib/sirah/course-revenue";

/** The course default share when a host has no agreed share stored (ZoomHost.revenueSharePercent is null). */
export const SIRAH_TEACHER_SHARE_PERCENT = 70;

/** The host's stored share (Prisma Decimal, number or string), or the course default. */
export function resolveSharePercent(stored: { toString(): string } | number | string | null | undefined) {
  if (stored === null || stored === undefined) return SIRAH_TEACHER_SHARE_PERCENT;
  const value = Number(stored.toString());
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : SIRAH_TEACHER_SHARE_PERCENT;
}

/** A share entered by an admin: 0 to 100, at most two decimal places (DECIMAL(5,2)). Empty means "use the default". */
export function parseSharePercent(input: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const text = input.trim();
  if (!text) return { ok: true, value: null };
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return { ok: false, error: "Enter a share between 0 and 100, with up to two decimals." };
  const value = Number(text);
  if (value < 0 || value > 100) return { ok: false, error: "Enter a share between 0 and 100, with up to two decimals." };
  return { ok: true, value: value.toFixed(2) };
}

/** Outstanding advance per currency: the sum of the append-only ledger (+ given, − reduced). */
export function outstandingAdvances(entries: { currency: string; amountMinor: number }[]): MoneyGroup[] {
  const totals = new Map<string, number>();
  for (const entry of entries) addMoney(totals, entry.currency, entry.amountMinor);
  return moneyGroups(totals).filter(item => item.amountMinor !== 0);
}

export type TeacherEarningsRow = {
  currency: string;
  receivedMinor: number;
  refundedMinor: number;
  /** Received after refunds: the same figure as the admin course report. */
  netMinor: number;
  /** The teacher's share of netMinor, rounded to the nearest minor unit. */
  shareMinor: number;
  /** Outstanding advances in this currency (shown as a deduction). */
  advanceMinor: number;
  /** shareMinor minus advanceMinor. */
  payableMinor: number;
};

/**
 * Per currency, never converted: received, refunds, net, the teacher's share
 * of net, outstanding advances and net payable. A currency with only an
 * advance still appears, so a deduction is never hidden.
 */
export function teacherEarnings(received: MoneyGroup[], refunds: MoneyGroup[], percent: number, advances: MoneyGroup[] = []): TeacherEarningsRow[] {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error("The share must be between 0 and 100 percent.");
  const receivedMap = new Map<string, number>(), refundMap = new Map<string, number>(), advanceMap = new Map<string, number>();
  for (const item of received) addMoney(receivedMap, item.currency, item.amountMinor);
  for (const item of refunds) addMoney(refundMap, item.currency, item.amountMinor);
  for (const item of advances) addMoney(advanceMap, item.currency, item.amountMinor);
  const currencies = [...new Set([...receivedMap.keys(), ...refundMap.keys(), ...advanceMap.keys()])].sort((a, b) => a.localeCompare(b));
  return currencies.map(currency => {
    const receivedMinor = receivedMap.get(currency) ?? 0;
    const refundedMinor = refundMap.get(currency) ?? 0;
    const netMinor = receivedMinor - refundedMinor;
    const shareMinor = Math.round((netMinor * percent) / 100);
    const advanceMinor = advanceMap.get(currency) ?? 0;
    return { currency, receivedMinor, refundedMinor, netMinor, shareMinor, advanceMinor, payableMinor: shareMinor - advanceMinor };
  });
}
