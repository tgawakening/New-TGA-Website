import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/lms/cron-auth";
import { RECORDING_BACKFILL_DEFAULT_DAYS, RECORDING_BACKFILL_MAX_DAYS } from "@/lib/lms/recording-policy";
import { backfillRecordings, recordingsAvailable } from "@/lib/lms/recordings";
import { ZoomApiError } from "@/lib/zoom/client";
import { ZoomConfigError } from "@/lib/zoom/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/lms/recordings/backfill
 * Safety net for missed recording.completed webhooks: lists every active
 * host's Zoom cloud recordings in a date window and ingests the ones that
 * belong to our sessions (PENDING rows; the process endpoint copies them).
 *
 * Auth: "Authorization: Bearer <CRON_SECRET>". Window: ?from=YYYY-MM-DD&to=
 * YYYY-MM-DD (UTC, at most RECORDING_BACKFILL_MAX_DAYS), or ?days=N back from
 * today (default RECORDING_BACKFILL_DEFAULT_DAYS). Returns counts only.
 */
const headers = { "Cache-Control": "no-store" };
const DAY = 86_400_000;

function window(url: URL, now = new Date()): { from: Date; to: Date } | string {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from || to) {
    const parse = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);
    const start = parse(from);
    const end = parse(to);
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Use from and to as YYYY-MM-DD.";
    return { from: start, to: end };
  }
  const days = Number(url.searchParams.get("days") || RECORDING_BACKFILL_DEFAULT_DAYS);
  if (!Number.isInteger(days) || days < 1 || days > RECORDING_BACKFILL_MAX_DAYS) return `days must be 1-${RECORDING_BACKFILL_MAX_DAYS}.`;
  return { from: new Date(now.getTime() - days * DAY), to: now };
}

export async function POST(request: Request) {
  const auth = checkCronAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers });

  const range = window(new URL(request.url));
  if (typeof range === "string") return NextResponse.json({ error: range }, { status: 400, headers });

  try {
    if (!(await recordingsAvailable()))
      return NextResponse.json({ error: "The recordings tables are not in this database yet (deploy the Phase 4 migration)." }, { status: 503, headers });
    return NextResponse.json(await backfillRecordings(range), { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    if (error instanceof ZoomConfigError) return NextResponse.json({ error: error.message }, { status: 503, headers });
    if (error instanceof ZoomApiError) return NextResponse.json({ error: error.message }, { status: 502, headers });
    console.error("[lms-recordings] backfill failed", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Recording backfill failed." }, { status: 500, headers });
  }
}
