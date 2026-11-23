import { getSessionIdentity } from "@/lib/auth/session";
import { getResource, hostMaySessionResources } from "@/lib/lms/content";
import { DOCUMENT_URL_SECONDS, RECORDING_URL_SECONDS, presignDownload, spacesConfigured } from "@/lib/sirah/spaces";

/** A session host's preview of a file on their own session (hidden or
 * published): the host check, then a short-lived presigned GET. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity(request);
  if (!identity) return new Response(null, { status: 302, headers: { ...NO_STORE, Location: new URL("/login", request.url).toString() } });
  const { id } = await params;
  const resource = await getResource(id);
  if (!resource?.sessionId || resource.kind !== "FILE" || !resource.storageKey || !(await hostMaySessionResources(identity, resource.sessionId)))
    return new Response("Not found.", { status: 404, headers: NO_STORE });
  if (!spacesConfigured()) return new Response("File storage is not configured.", { status: 503, headers: NO_STORE });
  const media = Boolean(resource.contentType && /^(audio|video)\//.test(resource.contentType));
  const url = await presignDownload({
    key: resource.storageKey,
    contentType: resource.contentType,
    filename: resource.originalFilename,
    expiresIn: media ? RECORDING_URL_SECONDS : DOCUMENT_URL_SECONDS,
  });
  return new Response(null, { status: 302, headers: { ...NO_STORE, Location: url } });
}
