import { NextResponse } from "next/server";
import {
  checkSirahOrigin,
  sirahAdmin,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import { requireAdminAccess } from "@/lib/auth/admin";
import { sirahBulkArchiveSchema } from "@/lib/sirah/admin-records";
import { applySirahBulkArchive } from "@/services/sirah-records.service";
import { SirahError } from "@/services/sirah-registration.service";

// Checkbox selection: archive many records (kept, never purged). Env super
// admin only. The schema carries only record ids and the service only sets the
// kept archive, so this endpoint can never delete anything; every record it
// archives is skipped by the maintenance purge and can be restored.
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    if (requireAdminAccess(request) !== null)
      throw new SirahError("Only the super admin can archive records.", 403);
    const actor = await sirahAdmin(request);
    const parsed = sirahBulkArchiveSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "Choose at least one record to archive.",
          fields: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    return privateJson(await applySirahBulkArchive(parsed.data, actor));
  } catch (error) {
    return sirahResponseError(error);
  }
}
