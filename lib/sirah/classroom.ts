/** Sīrah classroom rules (pure; no I/O). Status is always derived from
 * scheduledAt, never stored, so it cannot drift from the schedule. */
import { z } from "zod";

/** How long a session counts as "live" after it starts. */
export const SIRAH_LESSON_LIVE_MINUTES = 90;
/** The Join button appears this long before the start. */
export const SIRAH_JOIN_WINDOW_MINUTES = 30;
/** Wall-clock zone admins schedule in unless they pick another. */
export const SIRAH_DEFAULT_TIMEZONE = "Europe/London";

export const SIRAH_MATERIAL_KINDS = ["SLIDES", "PDF", "READING", "LINK", "RECORDING"] as const;
export type SirahMaterialKindName = (typeof SIRAH_MATERIAL_KINDS)[number];
export const SIRAH_MATERIAL_LABELS: Record<SirahMaterialKindName, string> = {
  SLIDES: "Slides",
  PDF: "PDF",
  READING: "Reading",
  LINK: "Link",
  RECORDING: "Recording",
};

export type SirahLessonStatus = "upcoming" | "live" | "past";
const MINUTE = 60_000;

export function lessonStatus(scheduledAt: Date, now = new Date()): SirahLessonStatus {
  const start = scheduledAt.getTime();
  const t = now.getTime();
  if (t < start) return "upcoming";
  return t < start + SIRAH_LESSON_LIVE_MINUTES * MINUTE ? "live" : "past";
}

/** True from 30 minutes before the start until the live window closes. */
export function canJoinLesson(scheduledAt: Date, now = new Date()) {
  const status = lessonStatus(scheduledAt, now);
  if (status === "live") return true;
  return status === "upcoming" && scheduledAt.getTime() - now.getTime() <= SIRAH_JOIN_WINDOW_MINUTES * MINUTE;
}

/** The session students should look at next: the live one, else the
 * soonest upcoming one. Null when the schedule has nothing ahead. */
export function nextLesson<T extends { scheduledAt: Date }>(lessons: T[], now = new Date()) {
  const ahead = lessons
    .filter((lesson) => lessonStatus(lesson.scheduledAt, now) !== "past")
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  return ahead[0] ?? null;
}

export function groupByWeek<T extends { weekNumber: number; scheduledAt: Date }>(lessons: T[]) {
  const weeks = new Map<number, T[]>();
  for (const lesson of [...lessons].sort(
    (a, b) => a.weekNumber - b.weekNumber || a.scheduledAt.getTime() - b.scheduledAt.getTime(),
  )) {
    const list = weeks.get(lesson.weekNumber) ?? [];
    list.push(lesson);
    weeks.set(lesson.weekNumber, list);
  }
  return [...weeks.entries()].map(([weekNumber, items]) => ({ weekNumber, lessons: items }));
}

export function isValidTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function zoneOffsetMs(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** "2026-11-20T19:30" read as wall-clock time in `timeZone` -> the UTC instant. */
export function zonedLocalToUtc(local: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match || !isValidTimeZone(timeZone)) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  if (new Date(naive).getUTCDate() !== d || h > 23 || mi > 59) return null;
  // Two passes settle the offset across a daylight-saving change.
  let guess = naive - zoneOffsetMs(new Date(naive), timeZone);
  guess = naive - zoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

/** UTC instant -> "YYYY-MM-DDTHH:mm" in `timeZone`, for a datetime-local field. */
export function utcToZonedLocal(instant: Date, timeZone: string) {
  const shifted = new Date(instant.getTime() + zoneOffsetMs(instant, timeZone));
  return shifted.toISOString().slice(0, 16);
}

/** Only https links reach a student's browser (no javascript:, data: or http:). */
const httpsUrl = z
  .string()
  .trim()
  .max(1024)
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Use a full https:// link.");

const optionalHttpsUrl = z.union([z.literal("").transform(() => null), httpsUrl]);
const text = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

export const lessonInput = z.object({
  title: text(191, "Title"),
  summary: z.string().trim().max(5000, "Summary is too long."),
  weekNumber: z.coerce.number().int().min(1, "Week must be 1 or more.").max(60, "Week must be 60 or less."),
  scheduledLocal: z.string().trim().min(1, "Date and time are required."),
  timeZone: z.string().trim().refine(isValidTimeZone, "Unknown time zone."),
  zoomJoinUrl: optionalHttpsUrl,
  zoomMeetingId: z
    .string()
    .trim()
    .max(64)
    .transform((value) => value.replace(/\s+/g, "") || null),
});

export const materialInput = z.object({
  lessonId: z
    .string()
    .trim()
    .max(191)
    .transform((value) => value || null),
  title: text(191, "Title"),
  kind: z.enum(SIRAH_MATERIAL_KINDS, "Pick a kind."),
  url: httpsUrl,
  order: z.coerce.number().int().min(0).max(999).default(0),
});

export const announcementInput = z.object({
  title: text(191, "Title"),
  body: text(5000, "Message"),
  pinned: z.boolean(),
});

export type FormResult<T> = { ok: true; data: T } | { ok: false; error: string };

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message || "Check the form.";
}

/** Parses a lesson form into the stored shape, or returns the first error. */
export function parseLessonForm(form: Record<string, string>): FormResult<{
  title: string;
  summary: string;
  weekNumber: number;
  scheduledAt: Date;
  zoomJoinUrl: string | null;
  zoomMeetingId: string | null;
}> {
  const parsed = lessonInput.safeParse(form);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { scheduledLocal, timeZone, ...rest } = parsed.data;
  const scheduledAt = zonedLocalToUtc(scheduledLocal, timeZone);
  if (!scheduledAt) return { ok: false, error: "Enter a valid date and time." };
  return { ok: true, data: { ...rest, scheduledAt } };
}

export function parseMaterialForm(form: Record<string, string>): FormResult<z.output<typeof materialInput>> {
  const parsed = materialInput.safeParse({ ...form, order: form.order || 0 });
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: firstIssue(parsed.error) };
}

export function parseAnnouncementForm(form: Record<string, string>): FormResult<z.output<typeof announcementInput>> {
  const parsed = announcementInput.safeParse({ ...form, pinned: form.pinned === "on" });
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: firstIssue(parsed.error) };
}

/** The existing Sīrah enrolment rule (paid + active), shared by /seerah/lms
 * and the classroom. A current-batch order that no longer grants access
 * blocks its linked legacy enrolment too; otherwise either an ACTIVE legacy
 * enrolment or an order that grants access lets the student in. */
export function sirahEnrolmentAllows(input: {
  enrollment?: { status: string; registrationId: string } | null;
  order?: { registrationId: string | null } | null;
  orderGrantsAccess: boolean;
}) {
  const { enrollment, order, orderGrantsAccess } = input;
  if (order && order.registrationId === enrollment?.registrationId && !orderGrantsAccess) return false;
  return enrollment?.status === "ACTIVE" || Boolean(order && orderGrantsAccess);
}

/* ---------- Lesson detail, progress and the URL boundary ---------- */

/** A YouTube or Vimeo link -> its privacy-preserving embed URL; anything
 * else -> null (shown as a plain link). IDs are checked against the
 * providers' own formats, so nothing else can be framed. */
export function recordingEmbed(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  const parts = url.pathname.split("/").filter(Boolean);
  const youtubeId = (id: string | null | undefined) =>
    id && /^[A-Za-z0-9_-]{11}$/.test(id) ? { provider: "youtube" as const, src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  if (host === "youtu.be") return youtubeId(parts[0]);
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") return youtubeId(url.searchParams.get("v"));
    if (["embed", "live", "shorts"].includes(parts[0])) return youtubeId(parts[1]);
    return null;
  }
  const vimeo = (id: string | undefined, hash?: string | null) =>
    id && /^\d{6,12}$/.test(id)
      ? {
          provider: "vimeo" as const,
          src: `https://player.vimeo.com/video/${id}${hash && /^[a-f0-9]{6,20}$/.test(hash) ? `?h=${hash}` : ""}`,
        }
      : null;
  if (host === "vimeo.com") return vimeo(parts[0], parts[1] ?? url.searchParams.get("h"));
  if (host === "player.vimeo.com" && parts[0] === "video") return vimeo(parts[1], url.searchParams.get("h"));
  return null;
}

type Orderable = { id: string; weekNumber: number; scheduledAt: Date };
const scheduleOrder = (a: Orderable, b: Orderable) =>
  a.weekNumber - b.weekNumber || a.scheduledAt.getTime() - b.scheduledAt.getTime() || a.id.localeCompare(b.id);

/** Previous and next sessions in week order (then start time). */
export function lessonNeighbours<T extends Orderable>(
  lessons: T[],
  lessonId: string,
): { previous: T | null; next: T | null } {
  const sorted = [...lessons].sort(scheduleOrder);
  const index = sorted.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return { previous: null, next: null };
  return { previous: sorted[index - 1] ?? null, next: sorted[index + 1] ?? null };
}

/** The overview line: where the course is, and where this student is. */
export function courseProgress<T extends Orderable>(lessons: T[], completedLessonIds: Set<string>, now = new Date()) {
  const started = lessons.filter((lesson) => lesson.scheduledAt.getTime() <= now.getTime()).sort(scheduleOrder);
  const ids = new Set(lessons.map((lesson) => lesson.id));
  return {
    currentWeek: started.length ? started[started.length - 1].weekNumber : null,
    totalWeeks: lessons.reduce((max, lesson) => Math.max(max, lesson.weekNumber), 0),
    totalSessions: lessons.length,
    // Only marks on sessions that still exist count.
    completed: [...completedLessonIds].filter((id) => ids.has(id)).length,
    next: nextLesson(lessons, now),
  };
}

export type MaterialGroupKey = "RECORDING" | "SLIDES" | "READINGS" | "LINKS";
export const MATERIAL_GROUPS: { key: MaterialGroupKey; label: string; kinds: SirahMaterialKindName[] }[] = [
  { key: "RECORDING", label: "Recording", kinds: ["RECORDING"] },
  { key: "SLIDES", label: "Slides", kinds: ["SLIDES"] },
  { key: "READINGS", label: "Readings", kinds: ["READING", "PDF"] },
  { key: "LINKS", label: "Links", kinds: ["LINK"] },
];

type MaterialRecord = { id: string; title: string; kind: SirahMaterialKindName; url: string; order: number };
type LessonRecord = Orderable & {
  title: string;
  summary: string;
  zoomJoinUrl: string | null;
  zoomMeetingId: string | null;
};

export type MaterialView = {
  id: string;
  title: string;
  kind: SirahMaterialKindName;
  url: string | null;
  embed: ReturnType<typeof recordingEmbed>;
};

/** The one place that decides which URLs leave the server. Material and
 * recording URLs: enrolled students only, at any time. The Zoom link:
 * enrolled students inside the join window only. Everything rendered for a
 * student goes through here, so a page cannot leak a field by accident. */
export function toLessonView(
  lesson: LessonRecord,
  materials: MaterialRecord[],
  viewer: { enrolled: boolean },
  now = new Date(),
) {
  const status = lessonStatus(lesson.scheduledAt, now);
  const inWindow = canJoinLesson(lesson.scheduledAt, now);
  const views: MaterialView[] = [...materials]
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .map((material) => ({
      id: material.id,
      title: material.title,
      kind: material.kind,
      url: viewer.enrolled ? material.url : null,
      embed: viewer.enrolled && material.kind === "RECORDING" ? recordingEmbed(material.url) : null,
    }));
  return {
    id: lesson.id,
    title: lesson.title,
    summary: lesson.summary,
    weekNumber: lesson.weekNumber,
    scheduledAt: lesson.scheduledAt,
    status,
    inJoinWindow: inWindow,
    zoomJoinUrl: viewer.enrolled && inWindow ? lesson.zoomJoinUrl : null,
    zoomMeetingId: viewer.enrolled && inWindow ? lesson.zoomMeetingId : null,
    hasRecording: materials.some((material) => material.kind === "RECORDING"),
    materials: views,
    groups: MATERIAL_GROUPS.map((group) => ({
      ...group,
      items: views.filter((material) => group.kinds.includes(material.kind)),
    })).filter((group) => group.items.length > 0),
  };
}
export type LessonView = ReturnType<typeof toLessonView>;

/** Where the completion form may send the student back to. */
export function safeClassroomReturn(value: unknown, lessonId: string) {
  return value === `/seerah/classroom/${lessonId}` ? value : "/seerah/classroom";
}
