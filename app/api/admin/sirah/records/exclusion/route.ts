import { NextResponse } from "next/server";
import {
  checkSirahOrigin,
  sirahExclusionActor,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import { sirahBulkExclusionSchema } from "@/lib/sirah/admin-records";
import { applySirahBulkExclusion } from "@/services/sirah-records.service";

// Checkbox selection: exclude / un-exclude many records from analytics.
// Super admin or manager. The schema only knows EXCLUDE and INCLUDE, and the
// service only toggles the analytics flag, so this endpoint can never archive,
// restore or delete anything. Delete stays one record at a time on /records.
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const actor = await sirahExclusionActor(request);
    const parsed = sirahBulkExclusionSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "Choose exclude or un-exclude and at least one record.",
          fields: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    return privateJson(await applySirahBulkExclusion(parsed.data, actor));
  } catch (error) {
    return sirahResponseError(error);
  }
}
