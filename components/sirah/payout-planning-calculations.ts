import { addMoney, moneyGroups, type MoneyGroup } from "@/lib/sirah/course-revenue";

export function planningBalances(received: MoneyGroup[], payouts: MoneyGroup[]) {
  const balances = new Map<string, number>();
  for (const item of received) addMoney(balances, item.currency, item.amountMinor);
  for (const item of payouts) addMoney(balances, item.currency, -item.amountMinor);
  return moneyGroups(balances);
}

export function splitShare(amountMinor: number, percentage: number) {
  const share = Math.round(amountMinor * percentage / 100);
  return { share, remaining: amountMinor - share };
}
