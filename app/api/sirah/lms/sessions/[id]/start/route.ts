import { requireAdminAccess } from "@/lib/auth/admin";
import { getSessionIdentity } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isAssignedHost, isZoomUrl } from "@/lib/lms/access";
import { lmsNotice, lmsRedirect } from "@/lib/lms/http";
import { getMeeting, ZoomApiError } from "@/lib/zoom/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sirah/lms/sessions/[id]/start
 * Admin (env super admin session or ADMIN_API_TOKEN) or the session's
 * assigned host -> fetch a fresh start_url from Zoom and 302 to it. The
 * start_url is a host credential: it is fetched on every call and never stored.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const isAdmin = requireAdminAccess(request) === null;
  const identity = isAdmin ? null : await getSessionIdentity(request);
  if (!isAdmin && !identity) return lmsNotice(401, "Please sign in", "Sign in as the class host or an admin to start this class.", { href: "/login", label: "Sign in" });

  const session = await prisma.lmsSession.findUnique({
    where: { id },
    select: { id: true, title: true, status: true, zoomMeetingId: true, zoomHost: { select: { email: true, active: true } } },
  });
  if (!session) return lmsNotice(404, "Class not found", "This class link is not valid.");
  if (!isAdmin && !isAssignedHost(identity, session.zoomHost))
    return lmsNotice(403, "Not the host", "Only the assigned host or an admin can start this class.");

  if (session.status === "CANCELLED") return lmsNotice(410, "Class cancelled", `"${session.title}" has been cancelled.`);
  if (session.status === "ENDED") return lmsNotice(409, "Class has ended", `"${session.title}" has ended.`);
  if (!session.zoomMeetingId) return lmsNotice(503, "Not ready", "This class has no Zoom meeting yet.");

  let startUrl: string;
  try {
    startUrl = (await getMeeting(session.zoomMeetingId)).start_url;
  } catch (error) {
    console.error("[lms-start] getMeeting failed for session", session.id, error instanceof ZoomApiError ? error.message : error instanceof Error ? error.name : "error");
    return lmsNotice(502, "Zoom unavailable", "Zoom did not return a start link. Please try again shortly.");
  }
  if (!startUrl || !isZoomUrl(startUrl)) return lmsNotice(502, "Zoom unavailable", "Zoom did not return a start link. Please try again shortly.");
  return lmsRedirect(startUrl);
}
