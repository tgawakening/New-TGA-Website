import { NextResponse } from "next/server";
import { getSessionIdentity } from "@/lib/auth/session";
import { BunnyConfigError, signedBunnyEmbed } from "@/lib/lms/bunny";
import { resolveBunnyPlayback } from "@/lib/lms/external-recordings";
import { LMS_ROUTE_HEADERS } from "@/lib/lms/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (status: number, body: object) => NextResponse.json(body, { status, headers: LMS_ROUTE_HEADERS });

/**
 * GET /api/sirah/lms/bunny-embed/[id]
 * Signed-in student with an active, paid enrolment, recording PUBLISHED ->
 * { src, expiresAt }: a Bunny iframe URL token-signed on the server that
 * stops opening at expiresAt. Called each time the recordings lightbox
 * opens, so the page HTML never holds a signed URL. Uncached; the token key
 * never leaves the server.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionIdentity(request);
  if (!user) return json(401, { error: "Sign in to your student account to watch this recording." });

  const decision = await resolveBunnyPlayback(user.id, id);
  if (!decision.ok)
    return decision.reason === "not_enrolled"
      ? json(403, { error: "Recordings are for students with an active, paid enrolment." })
      : json(404, { error: "This recording is not available." });

  try {
    const embed = signedBunnyEmbed(decision.videoId);
    return json(200, { src: embed.src, expiresAt: embed.expiresAt.toISOString() });
  } catch (error) {
    console.error("[lms-bunny] embed signing failed", id, error instanceof BunnyConfigError ? error.message : "error");
    return json(503, { error: "This recording cannot be played right now. Please try again later." });
  }
}
