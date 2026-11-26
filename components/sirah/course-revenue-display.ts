import { currencyScale, formatSirahMoney } from "@/lib/sirah/catalog";
import { addMoney, moneyGroups, type MoneyGroup } from "@/lib/sirah/course-revenue";

export function outstandingNow(pending: MoneyGroup[], due: MoneyGroup[]) {
  const totals = new Map<string, number>();
  for (const item of [...pending, ...due]) addMoney(totals, item.currency, item.amountMinor);
  return moneyGroups(totals);
}

export function formattedAmounts(rows: MoneyGroup[]) {
  return rows.filter(row => row.amountMinor !== 0).map(row => {
    try { return formatSirahMoney(row.amountMinor, row.currency); }
    catch { return `${row.currency} ${row.amountMinor} minor units`; }
  });
}

export function netReceived(received: MoneyGroup[], refunds: MoneyGroup[]) {
  const totals = new Map<string, number>();
  for (const item of received) addMoney(totals, item.currency, item.amountMinor);
  for (const item of refunds) addMoney(totals, item.currency, -item.amountMinor);
  return moneyGroups(totals);
}

export function formattedNetAmounts(rows: MoneyGroup[]) {
  return rows.filter(row => row.amountMinor !== 0).map(row => `${row.currency} ${new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: Math.max(2, currencyScale(row.currency)) }).format(row.amountMinor / 10 ** currencyScale(row.currency))}`);
}
