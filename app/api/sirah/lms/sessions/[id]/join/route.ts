import { getSessionIdentity } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isZoomUrl, joinOpensAt, joinWindow, studentMayJoinCohort } from "@/lib/lms/access";
import { decryptField, sessionFieldContext } from "@/lib/lms/field-crypto";
import { lmsNotice, lmsRedirect, utcLabel } from "@/lib/lms/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sirah/lms/sessions/[id]/join
 * Signed-in student, paid + active in the session's cohort, inside the join
 * window -> log a SessionJoinIntent and 302 to the decrypted Zoom join URL.
 * The join URL is decrypted only here and only ever sent as the Location
 * header; it is never rendered or returned in a body.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = new Date();

  const user = await getSessionIdentity(request);
  if (!user) return lmsNotice(401, "Please sign in", "Sign in to your student account to join this class.", { href: "/login", label: "Sign in" });

  const session = await prisma.lmsSession.findUnique({
    where: { id },
    select: { id: true, cohortId: true, title: true, startsAt: true, durationMin: true, status: true, joinUrlEncrypted: true },
  });
  if (!session) return lmsNotice(404, "Class not found", "This class link is not valid.");

  if (!(await studentMayJoinCohort(user.id, session.cohortId, now)))
    return lmsNotice(403, "Not enrolled", "Your account does not have an active, paid enrolment for this class's cohort. If you think this is wrong, please contact support.");

  if (session.status === "CANCELLED") return lmsNotice(410, "Class cancelled", `"${session.title}" has been cancelled.`);

  const window = session.status === "ENDED" ? "ended" : joinWindow(session, now);
  if (window === "not_open")
    return lmsNotice(409, "Not open yet", `"${session.title}" opens for joining at ${utcLabel(joinOpensAt(session))}, 15 minutes before it starts. Please come back then.`);
  if (window === "ended") return lmsNotice(409, "Class has ended", `"${session.title}" has ended.`);

  if (!session.joinUrlEncrypted) return lmsNotice(503, "Not ready", "This class is still being set up. Please try again in a minute.");
  let joinUrl: string;
  try {
    joinUrl = decryptField(session.joinUrlEncrypted, sessionFieldContext(session.id, "joinUrl"));
  } catch (error) {
    console.error("[lms-join] join URL unavailable for session", session.id, error instanceof Error ? error.name : "error");
    return lmsNotice(503, "Not available", "The class link could not be opened. Please contact support.");
  }
  if (!isZoomUrl(joinUrl)) {
    console.error("[lms-join] stored join URL is not a Zoom URL for session", session.id);
    return lmsNotice(503, "Not available", "The class link could not be opened. Please contact support.");
  }

  await prisma.sessionJoinIntent.create({ data: { sessionId: session.id, userId: user.id, at: now } });
  return lmsRedirect(joinUrl);
}
