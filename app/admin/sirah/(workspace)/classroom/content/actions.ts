"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getSessionIdentity } from "@/lib/auth/session";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import {
  createAnnouncement,
  createLinkResource,
  deleteAnnouncement,
  deleteResource,
  LmsContentError,
  setAnnouncementPublished,
  setResourceVisibility,
  updateAnnouncement,
  type ResourceScope,
} from "@/lib/lms/content";
import { notifyAnnouncement, notifyResource } from "@/lib/lms/notifications";
import { notifyLater } from "@/lib/lms/notify-later";
import { confirmUploadedResource, removeStoredObject, resourceUploadTicket, type UploadTicket } from "@/lib/lms/resource-upload";

const PAGE = "/admin/sirah/classroom/content";

/** Creation is available to workspace staff; editing existing items is
 * restricted to the existing Manager and Super Admin roles. */
async function requireCreator() {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  const actor = access.role === "SUPER_ADMIN" ? (await getCurrentAdmin())?.email || "Super Admin" : (await getSessionIdentity())?.email || "Team member";
  return { actor, role: access.role };
}
async function requireEditor() {
  const access = await requireCreator();
  if (access.role === "COMMUNITY_LEAD") redirect("/admin/sirah/overview");
  return access;
}

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};
const safe = (value: string) => (/^[A-Za-z0-9_-]{1,191}$/.test(value) ? value : "");

function back(params: { notice?: string; error?: string; cohort?: string; anchor?: string }): never {
  const query = new URLSearchParams();
  if (params.cohort && safe(params.cohort)) query.set("cohort", params.cohort);
  if (params.notice) query.set("notice", params.notice);
  if (params.error) query.set("error", params.error);
  const anchor = params.anchor && safe(params.anchor) ? `#${params.anchor}` : "";
  redirect(`${PAGE}?${query.toString()}${anchor}`);
}

function done(notice: string, cohort: string, anchor?: string): never {
  revalidatePath(PAGE);
  revalidatePath("/seerah/classroom");
  back({ notice, cohort, anchor });
}

function describe(error: unknown) {
  if (error instanceof LmsContentError) return error.message;
  console.error("[lms-content] action failed", error instanceof Error ? error.name : "error");
  return "That could not be saved. Please try again.";
}

/* ---------- Resources ---------- */

/** Step one of an upload, called from the browser: answers instead of redirecting. */
export async function requestResourceUpload(input: { kind: string; filename: string; contentType: string; size: number }): Promise<UploadTicket> {
  const access = await getSirahWorkspaceAccess();
  if (!access) return { ok: false, error: "Workspace access is required to upload." };
  return resourceUploadTicket(input);
}

/** "cohort" = the whole cohort; otherwise a session id of that cohort. */
function scopeFrom(form: FormData, cohort: string): ResourceScope {
  const target = text(form, "target");
  if (target.startsWith("recording:")) return { parentRecordingId: safe(target.slice("recording:".length)) || "-" };
  return target && target !== "cohort" ? { sessionId: safe(target) || "-" } : { cohortId: cohort };
}

export async function addResource(form: FormData) {
  const { actor } = await requireCreator();
  const cohort = text(form, "cohortId");
  const scope = scopeFrom(form, cohort);
  let error = "";
  try {
    if (text(form, "storage") === "UPLOAD")
      await confirmUploadedResource({
        scope,
        title: text(form, "title"),
        objectKey: text(form, "objectKey"),
        originalFilename: text(form, "originalFilename") || null,
        uploadedBy: actor,
      });
    else await createLinkResource({ scope, title: text(form, "title"), url: text(form, "url"), uploadedBy: actor });
  } catch (failure) {
    error = describe(failure);
  }
  if (error) back({ error, cohort, anchor: "new-resource" });
  done("Resource added. It stays hidden from students until you publish it.", cohort, "resources");
}

export async function changeResourceVisibility(form: FormData) {
  await requireEditor();
  const cohort = text(form, "cohortId");
  const id = text(form, "id");
  const publish = text(form, "visibility") === "PUBLISHED";
  let error = "";
  try {
    const { published } = await setResourceVisibility(id, publish ? "PUBLISHED" : "HIDDEN");
    if (published) notifyLater(() => notifyResource(id));
  } catch (failure) {
    error = describe(failure);
  }
  if (error) back({ error, cohort, anchor: "resources" });
  done(publish ? "Published. Enrolled students in this cohort can now see it." : "Hidden from students.", cohort, `resource-${id}`);
}

export async function removeResource(form: FormData) {
  const access = await requireEditor();
  const cohort = text(form, "cohortId");
  const removed = await deleteResource(text(form, "id"), access.role === "SUPER_ADMIN");
  // The row is gone, so no student can reach the file; the object goes too.
  await removeStoredObject(removed?.storageKey);
  done("Resource removed.", cohort, "resources");
}

/* ---------- Announcements ---------- */

export async function saveAnnouncement(form: FormData) {
  const id = text(form, "id");
  const { actor } = id ? await requireEditor() : await requireCreator();
  const cohort = text(form, "cohortId");
  let error = "";
  let createdId = "";
  let publishNow = false;
  try {
    if (id) await updateAnnouncement(id, { title: text(form, "title"), body: text(form, "body") });
    else {
      publishNow = form.get("publish") === "on";
      createdId = (await createAnnouncement({ cohortId: cohort, title: text(form, "title"), body: text(form, "body"), publish: publishNow, createdBy: actor })).id;
    }
  } catch (failure) {
    error = describe(failure);
  }
  if (error) back({ error, cohort, anchor: id ? `announcement-${id}` : "new-announcement" });
  if (createdId && publishNow) notifyLater(() => notifyAnnouncement(createdId));
  done(
    id ? "Announcement saved." : publishNow ? "Announcement published to the cohort." : "Draft saved. Publish it when it is ready.",
    cohort,
    id ? `announcement-${id}` : "announcements",
  );
}

export async function changeAnnouncementPublished(form: FormData) {
  await requireEditor();
  const cohort = text(form, "cohortId");
  const id = text(form, "id");
  const publish = text(form, "publish") === "1";
  let error = "";
  try {
    const { published } = await setAnnouncementPublished(id, publish);
    if (published) notifyLater(() => notifyAnnouncement(id));
  } catch (failure) {
    error = describe(failure);
  }
  if (error) back({ error, cohort, anchor: `announcement-${id}` });
  done(publish ? "Announcement published to the cohort." : "Announcement moved back to drafts.", cohort, `announcement-${id}`);
}

export async function removeAnnouncement(form: FormData) {
  await requireEditor();
  const cohort = text(form, "cohortId");
  await deleteAnnouncement(text(form, "id"));
  done("Announcement removed.", cohort, "announcements");
}
