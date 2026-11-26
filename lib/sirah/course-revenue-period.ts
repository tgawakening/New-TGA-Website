const zone = "Asia/Karachi";
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

function localParts(date: Date) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second) };
}

function localMidnight(year: number, month: number) {
  const utc = Date.UTC(year, month - 1, 1);
  const parts = localParts(new Date(utc));
  const offset = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - utc;
  return new Date(utc - offset);
}

export function karachiMonth(now: Date) {
  const { year, month } = localParts(now);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function previousMonth(month: string) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function reportPeriod(value: string | undefined, now = new Date()) {
  const current = karachiMonth(now);
  if (value === "all") return { key: "all", label: "All time", start: null, end: null, current };
  const month = value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= "1900-01" && value <= current ? value : current;
  const [year, number] = month.split("-").map(Number);
  const endYear = number === 12 ? year + 1 : year;
  const endMonth = number === 12 ? 1 : number + 1;
  const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, number - 1, 1)));
  return { key: month, label, start: localMidnight(year, number), end: localMidnight(endYear, endMonth), current };
}

export type RevenuePeriod = ReturnType<typeof reportPeriod>;
export function inRevenuePeriod(date: Date | null, period: RevenuePeriod) {
  if (!period.start || !period.end) return true;
  return date !== null && date >= period.start && date < period.end;
}
