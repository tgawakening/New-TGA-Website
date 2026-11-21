import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processPendingZoomEvents } from "@/lib/zoom/processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/lms/zoom/process-events
 * Catch-up for Zoom webhook events still unprocessed (a missed after() run,
 * a participants report that was not ready yet). Safety net for a scheduled
 * job; the webhook route already processes each event as it arrives.
 *
 * Auth: "Authorization: Bearer <CRON_SECRET>". Optional ?limit= (1-500,
 * default 100). Returns counts only, never event contents.
 */
const headers = { "Cache-Control": "no-store" };

/** Constant-time comparison of the bearer token with CRON_SECRET (hashed to equal lengths). */
function authorized(request: Request, secret: string) {
  const header = request.headers.get("authorization")?.trim() ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(token), digest(secret));
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Catch-up processing is not configured (CRON_SECRET)." }, { status: 503, headers });
  if (!authorized(request, secret)) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers });

  const limit = Number(new URL(request.url).searchParams.get("limit")) || 100;
  try {
    return NextResponse.json(await processPendingZoomEvents({ limit }), { headers });
  } catch (error) {
    console.error("[zoom-events] catch-up failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Catch-up processing failed." }, { status: 500, headers });
  }
}
