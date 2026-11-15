import { SIRAH_DEFAULT_TIMEZONE, SIRAH_JOIN_WINDOW_MINUTES, isValidTimeZone } from "./classroom";
import { appUrl, firstName, renderEmail, type RenderedEmail } from "../email-layout";

/** Classroom emails in the shared plain layout. Pure functions; the service
 * decides who receives them and when. */

export type { RenderedEmail };

const COURSE = "Beyond Chronology: The Sīrah";
const MASTHEAD = `The Global Awakening · ${COURSE}`;

/** A class time in the student's zone, else UK time, always naming the zone. */
export function formatClassTime(at: Date, zone: string | null | undefined) {
  const timeZone = zone && isValidTimeZone(zone) ? zone : SIRAH_DEFAULT_TIMEZONE;
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(at);
  const zoneName =
    new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "long" }).formatToParts(at).find((p) => p.type === "timeZoneName")
      ?.value || timeZone;
  return `${date} (${zoneName})`;
}

export function welcomeEmail(input: { fullName: string; app?: string }): RenderedEmail {
  const app = input.app ?? appUrl();
  return renderEmail(`Welcome to ${COURSE}`, {
    masthead: MASTHEAD,
    heading: `Welcome, ${firstName(input.fullName)}`,
    paragraphs: [
      "Your enrolment is confirmed. The classroom is now open to you: the weekly sessions, the joining link for each live class, the recordings and the reading.",
      `Sign in with the email and password you registered with. Each live class shows a Join button from ${SIRAH_JOIN_WINDOW_MINUTES} minutes before it starts.`,
    ],
    action: { label: "Open the classroom", href: `${app}/seerah/classroom` },
    footnote: "You are receiving this because you enrolled in the course.",
  });
}

export function reminderEmail(input: {
  fullName: string;
  lessonId: string;
  title: string;
  weekNumber: number;
  scheduledAt: Date;
  timeZone: string | null | undefined;
  app?: string;
}): RenderedEmail {
  const app = input.app ?? appUrl();
  const when = formatClassTime(input.scheduledAt, input.timeZone);
  return renderEmail(`Reminder: ${input.title}, ${when}`, {
    masthead: MASTHEAD,
    heading: `Week ${input.weekNumber}: ${input.title}`,
    paragraphs: [
      `Assalamu alaykum ${firstName(input.fullName)}, a reminder that your next live class is on ${when}.`,
      `Join from the session page. The Join button appears there ${SIRAH_JOIN_WINDOW_MINUTES} minutes before the class starts, and stays while it is live.`,
    ],
    action: { label: "Join the class", href: `${app}/seerah/classroom/${encodeURIComponent(input.lessonId)}` },
    footnote: "You are receiving this because you are enrolled in the course. Sign in with your registered email if asked.",
  });
}

export function announcementEmail(input: { fullName: string; title: string; body: string; app?: string }): RenderedEmail {
  const app = input.app ?? appUrl();
  return renderEmail(`${input.title} · ${COURSE}`, {
    masthead: MASTHEAD,
    heading: input.title,
    paragraphs: [`Assalamu alaykum ${firstName(input.fullName)},`, ...input.body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)],
    action: { label: "Open the classroom", href: `${app}/seerah/classroom` },
    footnote: "A notice from the course team, sent to enrolled students.",
  });
}
