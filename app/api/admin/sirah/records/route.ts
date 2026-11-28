import { NextResponse } from "next/server";
import {
  checkSirahOrigin,
  sirahAdmin,
  sirahExclusionActor,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import { requireAdminAccess } from "@/lib/auth/admin";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { sirahRecordsActionSchema } from "@/lib/sirah/admin-records";
import { applySirahRecordsAction } from "@/services/sirah-records.service";
import { SirahError } from "@/services/sirah-registration.service";

// ONE record per request. Exclude / include (mark as test): super admin or
// manager. Archive (kept), delete (archive then purge) and restore: env super
// admin only. Community leads, viewers and everyone else cannot reach this,
// whatever the UI shows. Nothing here hard-deletes a row.
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const access = await getSirahWorkspaceAccess(request);
    if (access?.role !== "SUPER_ADMIN" && access?.role !== "MANAGER")
      throw new SirahError("Only the super admin or a manager can manage test records.", 403);
    const parsed = sirahRecordsActionSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "Choose an action and one record.",
          fields: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    const { action } = parsed.data;
    let actor: string;
    if (action === "ARCHIVE" || action === "ARCHIVE_KEEP" || action === "RESTORE") {
      if (requireAdminAccess(request) !== null)
        throw new SirahError("Only the super admin can archive, delete or restore records.", 403);
      actor = await sirahAdmin(request);
    } else {
      actor = await sirahExclusionActor(request);
    }
    return privateJson(await applySirahRecordsAction(parsed.data, actor));
  } catch (error) {
    return sirahResponseError(error);
  }
}
