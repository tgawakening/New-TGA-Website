"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { LmsFieldCryptoError } from "@/lib/lms/field-crypto";
import { cancelSession, createSession, LmsSessionError, updateSession } from "@/lib/lms/sessions";
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
  done("Session scheduled. The Zoom meeting was created.", cohort, `live-${id}`);
}

export async function updateLiveSession(form: FormData) {
  await requireSessionEditor();
  const id = text(form, "id");
  const cohort = text(form, "cohortId");
  const schedule = readSchedule(form);
  if (typeof schedule === "string") back({ error: schedule, cohort, anchor: `live-${id}` });

  let error = "";
  try {
    await updateSession(id, { title: text(form, "title"), ...schedule });
  } catch (failure) {
    error = describe(failure);
  }
  if (error) back({ error, cohort, anchor: `live-${id}` });
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
