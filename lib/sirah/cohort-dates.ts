// A confirmed calendar date is not a claim about the lesson's start time.
export const courseStartRefundThrough = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) + 14 * 86400000)
    .toISOString()
    .slice(0, 10);
export const pakistanCalendarDate = (now: Date) =>
  new Date(now.getTime() + 5 * 3600000).toISOString().slice(0, 10);
