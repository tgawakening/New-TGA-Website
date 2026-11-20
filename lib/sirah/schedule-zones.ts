/** Zones the team schedules from. The stored time is always UTC; students see
 * it in their own profile zone. Shared by the classroom and live-session admin. */
export const SCHEDULE_TIME_ZONES = [
  { value: "Europe/London", label: "London", hint: "Europe/London" },
  { value: "Asia/Karachi", label: "Pakistan", hint: "Asia/Karachi" },
  { value: "Asia/Dubai", label: "Gulf", hint: "Asia/Dubai" },
  { value: "Europe/Berlin", label: "Central Europe", hint: "Europe/Berlin" },
  { value: "America/New_York", label: "US Eastern", hint: "America/New_York" },
  { value: "America/Chicago", label: "US Central", hint: "America/Chicago" },
  { value: "America/Los_Angeles", label: "US Pacific", hint: "America/Los_Angeles" },
  { value: "Australia/Sydney", label: "Sydney", hint: "Australia/Sydney" },
  { value: "UTC", label: "UTC", hint: "Coordinated Universal Time" },
];
