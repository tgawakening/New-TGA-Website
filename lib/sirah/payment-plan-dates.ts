/** Calendar dates for monthly payment plans are represented as UTC dates. */
export function planDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Enter a valid date.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Enter a valid date.");
  return date;
}

/** Clamp the billing day to the last day of shorter months. */
export function monthlyDueDate(year: number, month: number, day: number): Date {
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error("Billing day must be between 1 and 31.");
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, last)));
}

export function nextMonthlyDue(date: Date, day: number): Date {
  return monthlyDueDate(date.getUTCFullYear(), date.getUTCMonth() + 1, day);
}

export function periodStatus(dueAt: Date, dueMinor: number, paidMinor: number, today: Date): "PAID" | "DUE" | "OVERDUE" {
  if (paidMinor >= dueMinor) return "PAID";
  // The platform's published billing calendar is Asia/Karachi (UTC+05:00).
  const local = new Date(today.getTime() + 5 * 60 * 60 * 1000);
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return dueAt.getTime() < day ? "OVERDUE" : "DUE";
}
