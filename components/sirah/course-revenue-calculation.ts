import { currencyScale } from "@/lib/sirah/catalog";
import type { MoneyGroup } from "@/lib/sirah/course-revenue";

export type CalculatorRow = { id: string; title: string; received: MoneyGroup[]; net: MoneyGroup[]; outstanding: MoneyGroup[] };
export type Rates = Record<string, string>;

export function validRate(value: string | undefined) {
  if (!value || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function estimateMoney(values: MoneyGroup[], target: string, rates: Rates) {
  let total = 0;
  let included = false;
  const missing: string[] = [];
  for (const value of values) {
    if (value.amountMinor === 0) continue;
    const rate = value.currency === target ? 1 : validRate(rates[value.currency]);
    if (rate === null) { missing.push(value.currency); continue; }
    const converted = value.amountMinor / 10 ** currencyScale(value.currency) * rate;
    if (!Number.isFinite(converted) || !Number.isFinite(total + converted)) { missing.push(value.currency); continue; }
    total += converted;
    included = true;
  }
  return { total, included, missing };
}

export function formatEstimate(value: number) {
  return new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
