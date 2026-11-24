"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getSessionIdentity } from "@/lib/auth/session";
import { LmsContentError } from "@/lib/lms/content";
import { addExternalRecording, deleteStandaloneRecording, saveStandaloneRecording, setExternalRecordingVisibility } from "@/lib/lms/external-recordings";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { LmsFieldCryptoError } from "@/lib/lms/field-crypto";
import { cancelSession, createSession, LmsSessionError, updateSession } from "@/lib/lms/sessions";
import { notifySessionScheduled, notifySessionTimeChanged } from "@/lib/lms/notifications";
import { notifyLater } from "@/lib/lms/notify-later";
import { prisma } from "@/lib/prisma";
import { RecordingActionError, retryRecordingAsset, setRecordingVisibility } from "@/lib/lms/recordings";
import { zonedLocalToUtc } from "@/lib/sirah/classroom";
import { ZoomApiError } from "@/lib/zoom/client";
import { ZoomConfigError } from "@/lib/zoom/env";

const PAGE = "/admin/sirah/classroom/live";

/** Server actions are public POST endpoints: every one re-checks the role.
 * Super Admin and Manager may manage live sessions; Community Leads may not. */
async function requireSessionEditor() {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  if (!(access.role === "SUPER_ADMIN" || access.role === "MANAGER")) redirect("/admin/sirah");
  return access;
}

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

/** Query-string values come back from the form: keep them to id-safe characters. */
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
  revalidatePath("/seerah/classroom/schedule");
  revalidatePath("/seerah/classroom/teaching");
  back({ notice, cohort, anchor });
}

/** A message safe to show staff. Config errors name variables, never values. */
function describe(error: unknown): string {
  if (error instanceof LmsSessionError) return error.message;
  if (error instanceof ZoomConfigError) return `Zoom is not configured on this server: missing ${error.missing.join(", ")}.`;
  if (error instanceof LmsFieldCryptoError) return error.message;
  if (error instanceof ZoomApiError) return error.message;
  console.error("[lms-admin] session action failed", error instanceof Error ? error.name : "error");
  return "The session could not be saved. Please try again.";
}

function readSchedule(form: FormData): { startsAt: Date; durationMin: number } | string {
  const startsAt = zonedLocalToUtc(text(form, "startsLocal"), text(form, "timeZone"));
  if (!startsAt) return "Enter a valid date and time.";
  const durationMin = Number(text(form, "durationMin"));
  if (!Number.isInteger(durationMin) || durationMin <= 0) return "Enter the duration in whole minutes.";
  return { startsAt, durationMin };
}

export async function createLiveSession(form: FormData) {
  await requireSessionEditor();
  const cohort = text(form, "cohortId");
  const schedule = readSchedule(form);
  if (typeof schedule === "string") back({ error: schedule, cohort, anchor: "new-session" });

  let error = "";
  let id = "";
  try {
    id = (await createSession({ cohortId: cohort, title: text(form, "title"), hostId: text(form, "hostId"), ...schedule })).id;
  } catch (failure) {
    error = describe(failure);
  }
  if (error) back({ error, cohort, anchor: "new-session" });
  if (form.get("notifyStudents") === "on") notifyLater(() => notifySessionScheduled(id));
  done("Session scheduled. The Zoom meeting was created.", cohort, `live-${id}`);
}

export async function updateLiveSession(form: FormData) {
  await requireSessionEditor();
  const id = text(form, "id");
  const cohort = text(form, "cohortId");
  const schedule = readSchedule(form);
  if (typeof schedule === "string") back({ error: schedule, cohort, anchor: `live-${id}` });

  let error = "";
  const before = await prisma.lmsSession.findUnique({ where: { id }, select: { startsAt: true } });
  try {
    await updateSession(id, { title: text(form, "title"), ...schedule });
  } catch (failure) {
    error = describe(failure);
  }
  if (error) back({ error, cohort, anchor: `live-${id}` });
  // Only a moved start notifies; a title or duration edit does not.
  if (before && before.startsAt.getTime() !== schedule.startsAt.getTime()) notifyLater(() => notifySessionTimeChanged(id, before.startsAt));
  done("Session saved. The Zoom meeting was updated.", cohort, `live-${id}`);
}

export async function cancelLiveSession(form: FormData) {
  await requireSessionEditor();
  const id = text(form, "id");
  const cohort = text(form, "cohortId");
  let error = "";
  try {
    await cancelSession(id);
  } catch (failure) {
    error = describe(failure);
  }
  if (error) back({ error, cohort, anchor: `live-${id}` });
  done("Session cancelled. The Zoom meeting was deleted.", cohort, `live-${id}`);
}

/** Recordings (Phase 4): a failed file goes back to the copy queue. */
export async function retryRecordingFile(form: FormData) {
  await requireSessionEditor();
  const sessionId = text(form, "sessionId");
  const cohort = text(form, "cohortId");
  let error = "";
  try {
    await retryRecordingAsset(text(form, "assetId"));
  } catch (failure) {
    error = failure instanceof RecordingActionError ? failure.message : describe(failure);
  }
  if (error) back({ error, cohort, anchor: `live-${sessionId}` });
  done("Queued again. The next copy run picks it up.", cohort, `live-${sessionId}`);
}

/** Recordings (Phase 4): publish to enrolled students, or hide again. */
export async function setRecordingPublished(form: FormData) {
  await requireSessionEditor();
  const sessionId = text(form, "sessionId");
  const cohort = text(form, "cohortId");
  const publish = text(form, "publish") === "1";
  let error = "";
  try {
    await setRecordingVisibility(text(form, "recordingId"), publish);
  } catch (failure) {
    error = failure instanceof RecordingActionError ? failure.message : describe(failure);
  }
  if (error) back({ error, cohort, anchor: `live-${sessionId}` });
  done(publish ? "Recording published to enrolled students." : "Recording hidden from students.", cohort, `live-${sessionId}`);
}

/** Session-linked external recordings use the existing resource visibility. */
export async function saveExternalRecording(form: FormData) {
  const access = await requireSessionEditor();
  const cohort = text(form, "cohortId");
  const sessionId = text(form, "sessionId");
  const actor = access.role === "SUPER_ADMIN" ? (await getCurrentAdmin())?.email || "Super Admin" : (await getSessionIdentity())?.email || "Manager";
  try {
    await addExternalRecording({ sessionId, title: text(form, "title"), url: text(form, "url"), published: form.get("publish") === "on", actor });
  } catch (failure) {
    back({ error: failure instanceof LmsContentError ? failure.message : describe(failure), cohort, anchor: `live-${sessionId}` });
  }
  done("External recording saved.", cohort, `live-${sessionId}`);
}

export async function changeExternalRecordingVisibility(form: FormData) {
  await requireSessionEditor();
  const cohort = text(form, "cohortId");
  const sessionId = text(form, "sessionId");
  const publish = text(form, "publish") === "1";
  try {
    await setExternalRecordingVisibility(text(form, "resourceId"), sessionId, publish);
  } catch (failure) {
    back({ error: failure instanceof LmsContentError ? failure.message : describe(failure), cohort, anchor: `live-${sessionId}` });
  }
  done(publish ? "External recording published." : "External recording hidden.", cohort, `live-${sessionId}`);
}

export async function saveStandaloneRecordingAction(form: FormData) {
  const access = await requireSessionEditor();
  const cohort = text(form, "cohortId");
  const actor = access.role === "SUPER_ADMIN" ? (await getCurrentAdmin())?.email || "Super Admin" : (await getSessionIdentity())?.email || "Manager";
  try {
    await saveStandaloneRecording({ id: text(form, "id") || undefined, title: text(form, "title"), url: text(form, "url"), description: text(form, "description"), published: form.get("publish") === "on", actor });
  } catch (failure) {
    back({ error: failure instanceof LmsContentError ? failure.message : describe(failure), cohort, anchor: "manual-recordings" });
  }
  done("Recording saved.", cohort, "manual-recordings");
}

export async function deleteStandaloneRecordingAction(form: FormData) {
  await requireSessionEditor();
  const cohort = text(form, "cohortId");
  try {
    await deleteStandaloneRecording(text(form, "id"));
  } catch (failure) {
    back({ error: failure instanceof LmsContentError ? failure.message : describe(failure), cohort, anchor: "manual-recordings" });
  }
  done("Recording deleted.", cohort, "manual-recordings");
}

/** Delete one session and its dependent database rows through existing cascades. */
export async function deleteLiveSession(form: FormData) {
  const access = await requireSessionEditor();
  if (access.role !== "SUPER_ADMIN") redirect("/admin/sirah");
  const id = safe(text(form, "id"));
  const cohort = safe(text(form, "cohortId"));
  if (!id || !cohort) back({ error: "Choose a session to delete.", cohort });
  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.lmsSession.deleteMany({ where: { id, cohortId: cohort } });
      if (result.count !== 1) throw new LmsSessionError("That session no longer exists.", "NOT_FOUND", 404);
    });
  } catch (failure) {
    back({ error: describe(failure), cohort, anchor: `live-${id}` });
  }
  done("Session deleted.", cohort);
}
