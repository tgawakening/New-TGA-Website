import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { LmsSession } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/email-layout";
import { sirahStudentCohortAccess } from "./access";
import { sessionEnd } from "./sessions";

/**
 * Per-student calendar feed (ICS), signed so it needs no login.
 *
 * Token: base64url(userId) "." base64url(HMAC-SHA256(secret, "lms-calendar:v1:" + userId)).
 * Secret: LMS_CALENDAR_FEED_SECRET (at least 32 characters). There is no
 * general signing secret in the codebase to reuse, so the feed has its own;
 * without it the feed is off (the route answers 503, the control is hidden).
 * Rotating the secret invalidates every subscribed link at once; there is no
 * per-student revocation (it would need a stored token).
 *
 * The feed holds only the student's own cohort sessions (the same paid +
 * active + cohort rule as the join route), and never the Zoom link or
 * passcode: each event links to the signed-in schedule page instead.
 */

export const CALENDAR_SECRET_ENV = "LMS_CALENDAR_FEED_SECRET";
const MIN_SECRET_LENGTH = 32;
const CONTEXT = "lms-calendar:v1:";

const b64url = (value: Buffer | string) => Buffer.from(value).toString("base64url");

function secret(env: NodeJS.ProcessEnv = process.env) {
  const value = env[CALENDAR_SECRET_ENV]?.trim();
  return value && value.length >= MIN_SECRET_LENGTH ? value : null;
}

export const calendarFeedConfigured = (env: NodeJS.ProcessEnv = process.env) => secret(env) !== null;

const mac = (key: string, userId: string) => createHmac("sha256", key).update(CONTEXT + userId).digest();

export function calendarToken(userId: string, env: NodeJS.ProcessEnv = process.env) {
  const key = secret(env);
  if (!key) return null;
  return `${b64url(userId)}.${b64url(mac(key, userId))}`;
}

/** The user id a token was issued for, or null. Constant-time comparison. */
export function verifyCalendarToken(token: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const key = secret(env);
  if (!key || token.length > 400) return null;
  const [idPart, sigPart, extra] = token.split(".");
  if (!idPart || !sigPart || extra !== undefined) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(idPart) || !/^[A-Za-z0-9_-]+$/.test(sigPart)) return null;
  const userId = Buffer.from(idPart, "base64url").toString("utf8");
  if (!/^[A-Za-z0-9_-]{1,191}$/.test(userId)) return null;
  const given = Buffer.from(sigPart, "base64url");
  const expected = mac(key, userId);
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
}

export const calendarPath = (token: string) => `/api/sirah/lms/calendar/${token}.ics`;

/** https:// and webcal:// forms of the student's feed, or null when the feed is off. */
export function calendarLinks(userId: string, env: NodeJS.ProcessEnv = process.env) {
  const token = calendarToken(userId, env);
  if (!token) return null;
  const https = `${appUrl(env)}${calendarPath(token)}`;
  return { https, webcal: https.replace(/^https?:\/\//, "webcal://") };
}

/* ---------- ICS ---------- */

const stamp = (at: Date) => at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** RFC 5545 TEXT escaping. */
export const escapeIcs = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Folds a content line at 75 octets (RFC 5545 3.1), never splitting a UTF-8 character. */
export function foldLine(line: string) {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char);
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

type FeedSession = Pick<LmsSession, "id" | "title" | "startsAt" | "durationMin" | "status" | "updatedAt">;

export function renderCalendar(sessions: FeedSession[], options: { now: Date; app?: string; name?: string }) {
  const app = options.app ?? appUrl();
  const schedule = `${app}/seerah/classroom/schedule`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Global Awakening//Sirah live classes//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(options.name ?? "Sīrah live classes")}`,
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const session of sessions) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${session.id}@lms.tga-awakening`,
      `DTSTAMP:${stamp(options.now)}`,
      `DTSTART:${stamp(session.startsAt)}`,
      `DTEND:${stamp(sessionEnd(session))}`,
      `LAST-MODIFIED:${stamp(session.updatedAt)}`,
      `SEQUENCE:${Math.floor(session.updatedAt.getTime() / 60_000)}`,
      `SUMMARY:${escapeIcs(session.title)}`,
      `DESCRIPTION:${escapeIcs(`Live on Zoom. Join from your class schedule (sign in first): ${schedule}`)}`,
      `URL:${schedule}`,
      `STATUS:${session.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/** The feed for this user: their cohort's sessions that have not ended yet
 * (cancelled ones stay, marked CANCELLED, so calendars drop them). Not
 * enrolled -> an empty calendar, so a subscription empties out. */
export async function calendarForUser(userId: string, now = new Date()) {
  const access = await sirahStudentCohortAccess(userId, now);
  if (!access.allowed || !access.cohortId) return renderCalendar([], { now });
  const rows = await prisma.lmsSession.findMany({
    where: { cohortId: access.cohortId },
    select: { id: true, title: true, startsAt: true, durationMin: true, status: true, updatedAt: true },
    orderBy: { startsAt: "asc" },
  });
  const upcoming = rows
    .filter((s) => s.status !== "ENDED" && sessionEnd(s) > now)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return renderCalendar(upcoming, { now });
}
