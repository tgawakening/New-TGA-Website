import { SIRAH_DEFAULT_TIMEZONE, SIRAH_JOIN_WINDOW_MINUTES, isValidTimeZone } from "./classroom";

/** Classroom emails: plain, on-brand (ivory, charcoal, one gold action),
 * table-free single column that survives every client. Pure functions; the
 * service decides who receives them and when. */

export type RenderedEmail = { subject: string; html: string; text: string };

const COURSE = "Beyond Chronology: The Sīrah";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const appUrl = (env: NodeJS.ProcessEnv = process.env) =>
  (env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

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

function layout(input: { heading: string; paragraphs: string[]; action?: { label: string; href: string }; footnote?: string }) {
  const p = (text: string) =>
    `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#141611">${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;
  return `<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#f5efdf">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#f5efdf">
<p style="margin:0 0 24px;padding-bottom:12px;border-bottom:1px solid #c6c9b6;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#53564c">The Global Awakening · ${escapeHtml(COURSE)}</p>
<h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:28px;line-height:1.25;color:#141611">${escapeHtml(input.heading)}</h1>
${input.paragraphs.map(p).join("\n")}
${
  input.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(input.action.href)}" style="display:inline-block;padding:14px 22px;background:#d9ad4a;color:#141611;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none">${escapeHtml(input.action.label)}</a></p>`
    : ""
}
${input.footnote ? `<p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #c6c9b6;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#53564c">${escapeHtml(input.footnote)}</p>` : ""}
</div></body></html>`;
}

function text(input: { heading: string; paragraphs: string[]; action?: { label: string; href: string }; footnote?: string }) {
  return [
    input.heading,
    "",
    ...input.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...(input.action ? [`${input.action.label}: ${input.action.href}`, ""] : []),
    ...(input.footnote ? [input.footnote] : []),
    "",
    `The Global Awakening · ${COURSE}`,
  ].join("\n");
}

function render(subject: string, body: Parameters<typeof layout>[0]): RenderedEmail {
  return { subject, html: layout(body), text: text(body) };
}

const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] || "there";

export function welcomeEmail(input: { fullName: string; app?: string }): RenderedEmail {
  const app = input.app ?? appUrl();
  return render(`Welcome to ${COURSE}`, {
    heading: `Welcome, ${firstName(input.fullName)}`,
    paragraphs: [
      "Your enrolment is confirmed. The classroom is now open to you: the weekly sessions, the joining link for each live class, the recordings and the reading.",
      "Sign in with the email and password you registered with. Each live class shows a Join button from 30 minutes before it starts.",
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
  return render(`Reminder: ${input.title}, ${when}`, {
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
  return render(`${input.title} · ${COURSE}`, {
    heading: input.title,
    paragraphs: [`Assalamu alaykum ${firstName(input.fullName)},`, ...input.body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)],
    action: { label: "Open the classroom", href: `${app}/seerah/classroom` },
    footnote: "A notice from the course team, sent to enrolled students.",
  });
}
