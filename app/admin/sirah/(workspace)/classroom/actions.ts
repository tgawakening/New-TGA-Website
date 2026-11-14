"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import {
  parseAnnouncementForm,
  parseLessonForm,
  parseMaterialForm,
  parseUploadedMaterialForm,
} from "@/lib/sirah/classroom";
import {
  deleteObject,
  headObject,
  isClassroomObjectKey,
  newObjectKey,
  presignUpload,
  spacesConfigured,
  uploadProblem,
} from "@/lib/sirah/spaces";
import { classroomFilePath } from "@/services/sirah-classroom-files.service";

const PAGE = "/admin/sirah/classroom";

/** Server actions are public POST endpoints: every one re-checks the role.
 * Reviewers (Manager) and the env super admin may edit; Community Leads may not. */
async function isClassroomEditor() {
  const access = await getSirahWorkspaceAccess();
  return Boolean(access && (access.role === "SUPER_ADMIN" || access.role === "MANAGER"));
}

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

export type UploadTicket = { ok: true; uploadUrl: string; objectKey: string } | { ok: false; error: string };

/** Step one of an upload: a presigned PUT for one file, valid 15 minutes.
 * The browser sends the file straight to Spaces; nothing passes through us.
 * Called from the client, so it answers with an error instead of redirecting. */
export async function requestMaterialUpload(input: {
  kind: string;
  filename: string;
  contentType: string;
  size: number;
}): Promise<UploadTicket> {
  if (!(await isClassroomEditor())) return { ok: false, error: "Only reviewers and admins can upload." };
  if (!spacesConfigured()) return { ok: false, error: "File storage is not configured yet. Paste a link instead." };
  const kind = String(input?.kind || "");
  const contentType = String(input?.contentType || "").toLowerCase();
  const problem = uploadProblem(kind, contentType, Number(input?.size));
  if (problem) return { ok: false, error: problem };
  const objectKey = newObjectKey(String(input?.filename || "file"));
  return { ok: true, uploadUrl: await presignUpload(objectKey, contentType), objectKey };
}

const MATERIAL_FIELDS = ["lessonId", "title", "kind", "order"];

export async function addMaterial(form: FormData) {
  await requireClassroomEditor();
  const anchor = form.get("lessonId") ? `session-${form.get("lessonId")}` : "course-materials";
  const upload = form.get("storage") === "UPLOAD";
  const parsed = upload
    ? parseUploadedMaterialForm(fields(form, [...MATERIAL_FIELDS, "objectKey", "originalFilename"]))
    : parseMaterialForm(fields(form, [...MATERIAL_FIELDS, "url"]));
  if (!parsed.ok) fail(parsed.error, anchor);
  if (parsed.data.lessonId) {
    const exists = await prisma.sirahLesson.findUnique({ where: { id: parsed.data.lessonId }, select: { id: true } });
    if (!exists) fail("That session no longer exists.");
  }
  if (!("objectKey" in parsed.data)) {
    await prisma.sirahMaterial.create({ data: parsed.data });
    done("Material added.", anchor);
  }

  // Step two of an upload. Trust the stored object, not the form: its real
  // size and type are read back from Spaces and checked again.
  const { objectKey, originalFilename, ...rest } = parsed.data;
  if (!spacesConfigured()) fail("File storage is not configured yet.", anchor);
  if (!isClassroomObjectKey(objectKey)) fail("That upload is not recognised. Upload the file again.", anchor);
  if (await prisma.sirahMaterial.findUnique({ where: { objectKey }, select: { id: true } }))
    fail("That file is already attached.", anchor);
  const stored = await headObject(objectKey);
  if (!stored) fail("The upload did not finish. Upload the file again.", anchor);
  const problem = uploadProblem(rest.kind, (stored.contentType || "").toLowerCase(), stored.size);
  if (problem) {
    await deleteObject(objectKey).catch(() => {});
    fail(problem, anchor);
  }
  const id = randomUUID();
  await prisma.sirahMaterial.create({
    data: {
      ...rest,
      id,
      url: classroomFilePath(id),
      storage: "UPLOAD",
      objectKey,
      contentType: (stored.contentType || "").toLowerCase(),
      sizeBytes: BigInt(stored.size),
      originalFilename,
    },
  });
  done("File uploaded and added.", anchor);
}

export async function removeMaterial(form: FormData) {
  await requireClassroomEditor();
  const id = String(form.get("id") || "");
  const anchor = String(form.get("anchor") || "");
  const material = await prisma.sirahMaterial.findUnique({ where: { id }, select: { objectKey: true } });
  await prisma.sirahMaterial.deleteMany({ where: { id } });
  // The row is gone, so no student can reach the file any more; the stored
  // object is removed too, best effort.
  if (material?.objectKey && spacesConfigured()) await deleteObject(material.objectKey).catch(() => {});
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
