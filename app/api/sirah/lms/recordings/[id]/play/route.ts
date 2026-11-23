import { getSessionIdentity } from "@/lib/auth/session";
import { lmsNotice, lmsRedirect } from "@/lib/lms/http";
import { RECORDING_PLAYBACK_URL_SECONDS } from "@/lib/lms/recording-policy";
import { recordingStorage, RecordingStorageConfigError } from "@/lib/lms/recording-storage";
import { recordingsAvailable, resolveRecordingPlayback } from "@/lib/lms/recordings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sirah/lms/recordings/[id]/play
 * Signed-in student with an active, paid enrolment in the recording's
 * session's cohort, recording READY and PUBLISHED -> 302 to a short-lived
 * (RECORDING_PLAYBACK_URL_SECONDS) presigned URL that plays inline. Used as
 * the <video>/<audio> src, so the storage URL is never in any HTML; it
 * travels only in the Location header, uncached, and every request (each
 * seek) re-checks the enrolment. No Zoom URL is involved.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = new Date();

  const user = await getSessionIdentity(request);
  if (!user) return lmsNotice(401, "Please sign in", "Sign in to your student account to watch this recording.", { href: "/login", label: "Sign in" });
  if (!(await recordingsAvailable())) return lmsNotice(404, "Recording not found", "This recording is not available.");

  const decision = await resolveRecordingPlayback(user.id, id, now);
  if (!decision.ok) {
    if (decision.reason === "not_enrolled")
      return lmsNotice(403, "Not enrolled", "Recordings are for students with an active, paid enrolment in this class's cohort. Your dashboard shows your enrolment.", { href: "/dashboard", label: "Go to your dashboard" });
    return lmsNotice(404, "Recording not available", "This recording is not available.");
  }

  let url: string;
  try {
    url = await recordingStorage().presign({ key: decision.key, contentType: decision.contentType, filename: decision.filename, expiresIn: RECORDING_PLAYBACK_URL_SECONDS });
  } catch (error) {
    if (!(error instanceof RecordingStorageConfigError)) console.error("[lms-recordings] presign failed", id, error instanceof Error ? error.name : "error");
    return lmsNotice(503, "Recording unavailable", "This recording cannot be played right now. Please try again later.");
  }
  return lmsRedirect(url);
}
