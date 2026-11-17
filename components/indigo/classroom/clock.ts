import { SIRAH_DEFAULT_TIMEZONE, isValidTimeZone, type SirahLessonStatus } from "@/lib/sirah/classroom";

/* Status labels and the student's clock for the classroom pages. */

export const STATUS_TEXT: Record<SirahLessonStatus, string> = {
  upcoming: "Upcoming",
  live: "Live now",
  past: "Took place",
};

/** Dates in the student's profile zone, London when unset or unknown. */
export function classroomClock(profileZone: string | null | undefined) {
  const timeZone = profileZone && isValidTimeZone(profileZone) ? profileZone : SIRAH_DEFAULT_TIMEZONE;
  const make = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone, ...options });
  return {
    timeZone,
    zoneName:
      make({ timeZoneName: "long" })
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName")?.value || timeZone,
    longDate: make({ weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true }),
    shortDate: make({ weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }),
    noticeDate: make({ day: "numeric", month: "long", year: "numeric" }),
    weekday: make({ weekday: "long" }),
    time: make({ hour: "numeric", minute: "2-digit", hour12: true }),
  };
}

export type ClassroomClock = ReturnType<typeof classroomClock>;
