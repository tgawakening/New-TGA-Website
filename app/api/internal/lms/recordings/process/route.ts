import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/lms/cron-auth";
import { RECORDING_COPY_BATCH_SIZE } from "@/lib/lms/recording-policy";
import { missingRecordingStorageEnv, RecordingStorageConfigError } from "@/lib/lms/recording-storage";
import { copyRecordingAssets, ingestRecordingEvents, recordingCopyRuntime, recordingsAvailable } from "@/lib/lms/recordings";
import { missingZoomEnv, ZoomConfigError } from "@/lib/zoom/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/lms/recordings/process
 * For a scheduled job. 1) Ingest stored recording.completed events into
 * Recording / RecordingAsset rows (PENDING; nothing downloaded). 2) Copy a
 * small batch of assets from Zoom into object storage, after the response
 * (or inline with ?wait=1, for a manual run).
 *
 * Auth: "Authorization: Bearer <CRON_SECRET>". Optional ?limit= (assets per
 * run, 1-10, default RECORDING_COPY_BATCH_SIZE). Fails safe with 503 and the
 * missing variable NAMES when storage or Zoom is not configured; no asset is
 * claimed then. Returns counts only, never URLs or keys.
 */
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const auth = checkCronAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers });

  try {
    if (!(await recordingsAvailable()))
      return NextResponse.json({ error: "The recordings tables are not in this database yet (deploy the Phase 4 migration)." }, { status: 503, headers });

    const ingest = await ingestRecordingEvents();

    const missing = [...missingRecordingStorageEnv(), ...missingZoomEnv().filter((name) => name !== "ZOOM_WEBHOOK_SECRET_TOKEN")];
    if (missing.length)
      return NextResponse.json(
        { ingest, copy: { started: false }, error: `Copying is not configured: missing ${missing.join(", ")}. Assets stay PENDING.` },
        { status: 503, headers },
      );

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit")) || RECORDING_COPY_BATCH_SIZE;
    if (url.searchParams.get("wait") === "1") return NextResponse.json({ ingest, copy: await copyRecordingAssets({ limit }) }, { headers });

    recordingCopyRuntime.schedule(async () => {
      try {
        await copyRecordingAssets({ limit });
      } catch (error) {
        console.error("[lms-recordings] scheduled copy failed", error instanceof Error ? error.name : "error");
      }
    });
    return NextResponse.json({ ingest, copy: { started: true, limit } }, { status: 202, headers });
  } catch (error) {
    if (error instanceof RecordingStorageConfigError || error instanceof ZoomConfigError)
      return NextResponse.json({ error: error.message }, { status: 503, headers });
    console.error("[lms-recordings] process failed", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Recording processing failed." }, { status: 500, headers });
  }
}
