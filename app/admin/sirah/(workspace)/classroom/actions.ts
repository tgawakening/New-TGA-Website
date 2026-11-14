"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import {
  parseAnnouncementForm,
  parseLessonForm,
  parseMaterialForm,
} from "@/lib/sirah/classroom";

const PAGE = "/admin/sirah/classroom";

/** Server actions are public POST endpoints: every one re-checks the role.
 * Reviewers (Manager) and the env super admin may edit; Community Leads may not. */
async function requireClassroomEditor() {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  if (!(access.role === "SUPER_ADMIN" || access.role === "MANAGER")) redirect("/admin/sirah");
}

function fields(form: FormData, names: string[]) {
  return Object.fromEntries(
    names.map((name) => {
      const value = form.get(name);
      return [name, typeof value === "string" ? value : ""];
    }),
  );
}

/** Fragments come from form fields: keep them to id-safe characters. */
function safeAnchor(value: unknown) {
  return typeof value === "string" && /^[a-z0-9-]{1,80}$/i.test(value) ? value : "";
}

function done(notice: string, anchor = ""): never {
  anchor = safeAnchor(anchor);
  revalidatePath(PAGE);
  revalidatePath("/seerah/classroom");
  redirect(`${PAGE}?notice=${encodeURIComponent(notice)}${anchor ? `#${anchor}` : ""}`);
}

function fail(error: string, anchor = ""): never {
  anchor = safeAnchor(anchor);
  redirect(`${PAGE}?error=${encodeURIComponent(error)}${anchor ? `#${anchor}` : ""}`);
}

const LESSON_FIELDS = ["title", "summary", "weekNumber", "scheduledLocal", "timeZone", "zoomJoinUrl", "zoomMeetingId"];

export async function createLesson(form: FormData) {
  await requireClassroomEditor();
  const parsed = parseLessonForm(fields(form, LESSON_FIELDS));
  if (!parsed.ok) fail(parsed.error, "new-session");
  const lesson = await prisma.sirahLesson.create({ data: parsed.data });
  done("Session created.", `session-${lesson.id}`);
}

export async function updateLesson(form: FormData) {
  await requireClassroomEditor();
  const id = String(form.get("id") || "");
  const parsed = parseLessonForm(fields(form, LESSON_FIELDS));
  if (!parsed.ok) fail(parsed.error, `session-${id}`);
  const result = await prisma.sirahLesson.updateMany({ where: { id }, data: parsed.data });
  if (!result.count) fail("That session no longer exists.");
  done("Session saved.", `session-${id}`);
}

export async function addMaterial(form: FormData) {
  await requireClassroomEditor();
  const parsed = parseMaterialForm(fields(form, ["lessonId", "title", "kind", "url", "order"]));
  const anchor = form.get("lessonId") ? `session-${form.get("lessonId")}` : "course-materials";
  if (!parsed.ok) fail(parsed.error, anchor);
  if (parsed.data.lessonId) {
    const exists = await prisma.sirahLesson.findUnique({ where: { id: parsed.data.lessonId }, select: { id: true } });
    if (!exists) fail("That session no longer exists.");
  }
  await prisma.sirahMaterial.create({ data: parsed.data });
  done("Material added.", anchor);
}

export async function removeMaterial(form: FormData) {
  await requireClassroomEditor();
  const id = String(form.get("id") || "");
  const anchor = String(form.get("anchor") || "");
  await prisma.sirahMaterial.deleteMany({ where: { id } });
  done("Material removed.", anchor);
}

export async function postAnnouncement(form: FormData) {
  await requireClassroomEditor();
  const parsed = parseAnnouncementForm(fields(form, ["title", "body", "pinned"]));
  if (!parsed.ok) fail(parsed.error, "announcements");
  await prisma.sirahAnnouncement.create({ data: parsed.data });
  done("Announcement posted.", "announcements");
}

export async function setAnnouncementPinned(form: FormData) {
  await requireClassroomEditor();
  const id = String(form.get("id") || "");
  await prisma.sirahAnnouncement.updateMany({ where: { id }, data: { pinned: form.get("pinned") === "true" } });
  done("Announcement updated.", "announcements");
}

export async function removeAnnouncement(form: FormData) {
  await requireClassroomEditor();
  const id = String(form.get("id") || "");
  await prisma.sirahAnnouncement.deleteMany({ where: { id } });
  done("Announcement removed.", "announcements");
}
