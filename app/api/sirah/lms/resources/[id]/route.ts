import { getSessionIdentity } from "@/lib/auth/session";
import { resolveResourceFile } from "@/lib/lms/content";
import { presignDownload, spacesConfigured } from "@/lib/sirah/spaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sirah/lms/resources/[id]
 * A PUBLISHED file resource, for a signed-in student who is paid + active in
 * its cohort: a redirect to a short-lived presigned GET. Nothing else ever
 * causes a signature; the bucket stays private.
 */
const NO_STORE = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const to = (path: string) => new URL(path, request.url).toString();
  const user = await getSessionIdentity(request);
  if (!user) return new Response(null, { status: 302, headers: { ...NO_STORE, Location: to("/login") } });
  if (!spacesConfigured()) return new Response("File storage is not configured.", { status: 503, headers: NO_STORE });
  const access = await resolveResourceFile(id, user.id, presignDownload);
  if (access.kind === "denied") return new Response(null, { status: 302, headers: { ...NO_STORE, Location: to("/dashboard") } });
  if (access.kind !== "redirect") return new Response("Not found.", { status: 404, headers: NO_STORE });
  return new Response(null, { status: 302, headers: { ...NO_STORE, Location: access.url } });
}
