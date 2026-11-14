import { NextResponse } from "next/server";
import {
  checkSirahOrigin,
  sirahAdmin,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import { requireAdminAccess } from "@/lib/auth/admin";
import { sirahRecordsActionSchema } from "@/lib/sirah/admin-records";
import { applySirahRecordsAction } from "@/services/sirah-records.service";
import { SirahError } from "@/services/sirah-registration.service";

// Exclude / include / delete test records: env super admin only. Reviewers,
// viewers and community leads cannot reach this, whatever the UI shows.
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    if (requireAdminAccess(request) !== null)
      throw new SirahError("Only the super admin can manage test records.", 403);
    const parsed = sirahRecordsActionSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "Choose an action and between 1 and 100 records.",
          fields: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    return privateJson(
      await applySirahRecordsAction(parsed.data, await sirahAdmin(request)),
    );
  } catch (error) {
    return sirahResponseError(error);
  }
}
