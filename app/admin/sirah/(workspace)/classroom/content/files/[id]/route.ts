import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { externalUrl } from "@/lib/external-origin";
import { getResource } from "@/lib/lms/content";
import { DOCUMENT_URL_SECONDS, RECORDING_URL_SECONDS, presignDownload, spacesConfigured } from "@/lib/sirah/spaces";

/** Staff preview of an uploaded resource (hidden or published): Super Admin
 * and Manager only, then a short-lived presigned GET. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const to = (path: string) => externalUrl(path, request).toString();
  const access = await getSirahWorkspaceAccess();
  if (!access) return new Response(null, { status: 302, headers: { ...NO_STORE, Location: to("/admin/sirah/login") } });
  if (!(access.role === "SUPER_ADMIN" || access.role === "MANAGER"))
    return new Response(null, { status: 302, headers: { ...NO_STORE, Location: to("/admin/sirah") } });
  if (!spacesConfigured()) return new Response("File storage is not configured.", { status: 503, headers: NO_STORE });
  const { id } = await params;
  const resource = await getResource(id);
  if (!resource || resource.kind !== "FILE" || !resource.storageKey) return new Response("Not found.", { status: 404, headers: NO_STORE });
  const media = Boolean(resource.contentType && /^(audio|video)\//.test(resource.contentType));
  const url = await presignDownload({
    key: resource.storageKey,
    contentType: resource.contentType,
    filename: resource.originalFilename,
    expiresIn: media ? RECORDING_URL_SECONDS : DOCUMENT_URL_SECONDS,
  });
  return new Response(null, { status: 302, headers: { ...NO_STORE, Location: url } });
}
