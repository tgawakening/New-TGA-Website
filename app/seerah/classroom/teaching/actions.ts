"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hostsForIdentity } from "@/lib/lms/schedule";
import { createSession, LmsSessionError } from "@/lib/lms/sessions";
import { notifySessionScheduled } from "@/lib/lms/notifications";
import { zonedLocalToUtc } from "@/lib/sirah/classroom";
import { getSessionIdentity } from "@/lib/auth/session";
import {
  createLinkResource,
  deleteResource,
  getResource,
  hostMaySessionResources,
  LmsContentError,
  setResourceVisibility,
} from "@/lib/lms/content";
import { notifyResource } from "@/lib/lms/notifications";
import { notifyLater } from "@/lib/lms/notify-later";
import { confirmUploadedResource, removeStoredObject, resourceUploadTicket, type UploadTicket } from "@/lib/lms/resource-upload";

/* The session host's resource actions. A host is the signed-in account whose
 * email is the session's active ZoomHost (the start route's rule); every
 * action re-checks it for that very session, and only that session's own
 * resources can be changed here. */

const safe = (value: string) => (/^[A-Za-z0-9_-]{1,191}$/.test(value) ? value : "");
const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};
const page = (sessionId: string) => `/seerah/classroom/teaching/resources/${encodeURIComponent(sessionId)}`;

function back(sessionId: string, params: { notice?: string; error?: string }): never {
  const query = new URLSearchParams();
  if (params.notice) query.set("notice", params.notice);
  if (params.error) query.set("error", params.error);
  redirect(`${page(sessionId)}?${query.toString()}`);
}

async function requireHostOf(sessionId: string) {
  const identity = await getSessionIdentity();
  if (!identity) redirect("/login");
  if (!sessionId || !(await hostMaySessionResources(identity, sessionId))) redirect("/seerah/classroom/teaching");
  return identity;
}

/** A resource id from the form, only if it belongs to this session. */
async function ownResource(sessionId: string, id: string) {
  const resource = id ? await getResource(id) : null;
  return resource && resource.sessionId === sessionId ? resource : null;
}

function describe(error: unknown) {
  if (error instanceof LmsContentError) return error.message;
  console.error("[lms-host] action failed", error instanceof Error ? error.name : "error");
  return "That could not be saved. Please try again.";
}

/** Step one of an upload (bound to the session), called from the browser. */
export async function requestHostResourceUpload(
  sessionId: string,
  input: { kind: string; filename: string; contentType: string; size: number },
): Promise<UploadTicket> {
  const identity = await getSessionIdentity();
  if (!identity || !(await hostMaySessionResources(identity, safe(sessionId)))) return { ok: false, error: "Only this session's host can upload here." };
  return resourceUploadTicket(input);
}

export async function addHostResource(form: FormData) {
  const sessionId = safe(text(form, "sessionId"));
  const identity = await requireHostOf(sessionId);
  let error = "";
  try {
    if (text(form, "storage") === "UPLOAD")
      await confirmUploadedResource({
        scope: { sessionId },
        title: text(form, "title"),
        objectKey: text(form, "objectKey"),
        originalFilename: text(form, "originalFilename") || null,
        uploadedBy: identity.email,
      });
    else await createLinkResource({ scope: { sessionId }, title: text(form, "title"), url: text(form, "url"), uploadedBy: identity.email });
  } catch (failure) {
    error = describe(failure);
  }
  if (error) back(sessionId, { error });
  revalidatePath(page(sessionId));
  back(sessionId, { notice: "Resource added. It stays hidden from students until you publish it." });
}

export async function changeHostResourceVisibility(form: FormData) {
  const sessionId = safe(text(form, "sessionId"));
  await requireHostOf(sessionId);
  const resource = await ownResource(sessionId, text(form, "id"));
  if (!resource) back(sessionId, { error: "That resource is not part of this session." });
  const publish = text(form, "visibility") === "PUBLISHED";
  const { published } = await setResourceVisibility(resource.id, publish ? "PUBLISHED" : "HIDDEN");
  if (published) notifyLater(() => notifyResource(resource.id), "lms-host");
  revalidatePath(page(sessionId));
  revalidatePath("/seerah/classroom");
  back(sessionId, { notice: publish ? "Published to the session's students." : "Hidden from students." });
}

export async function removeHostResource(form: FormData) {
  const sessionId = safe(text(form, "sessionId"));
  await requireHostOf(sessionId);
  const resource = await ownResource(sessionId, text(form, "id"));
  if (!resource) back(sessionId, { error: "That resource is not part of this session." });
  const removed = await deleteResource(resource.id);
  await removeStoredObject(removed?.storageKey);
  revalidatePath(page(sessionId));
  revalidatePath("/seerah/classroom");
  back(sessionId, { notice: "Resource removed." });
}

/** Hosts can schedule for cohorts in which they already have an assigned session. */
export async function scheduleTeacherSession(form: FormData) {
  const identity = await getSessionIdentity();
  const hosts = await hostsForIdentity(identity);
  const hostId = safe(text(form, "hostId"));
  const cohortId = safe(text(form, "cohortId"));
  const assigned = hosts.some(host => host.id === hostId) && await prisma.lmsSession.findFirst({ where: { zoomHostId: hostId, cohortId }, select: { id: true } });
  if (!assigned) redirect("/seerah/classroom/teaching?error=Not+authorised+for+that+cohort#schedule");
  const startsAt = zonedLocalToUtc(text(form, "startsLocal"), text(form, "timeZone"));
  const durationMin = Number(text(form, "durationMin"));
  if (!startsAt || !Number.isInteger(durationMin)) redirect("/seerah/classroom/teaching?error=Enter+a+valid+date+and+duration#schedule");
  let id = "";
  let error = "";
  try { id = (await createSession({ hostId, cohortId, startsAt, durationMin, title: text(form, "title") })).id; }
  catch (failure) { error = failure instanceof LmsSessionError ? failure.message : "The session could not be scheduled. Please contact the administrator."; }
  if (error) redirect(`/seerah/classroom/teaching?error=${encodeURIComponent(error)}#schedule`);
  if (form.get("notifyStudents") === "on") notifyLater(() => notifySessionScheduled(id), "lms-host");
  revalidatePath("/seerah/classroom/teaching");
  revalidatePath("/seerah/classroom/schedule");
  redirect("/seerah/classroom/teaching?notice=Session+scheduled#upcoming");
}
