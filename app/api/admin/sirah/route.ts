import { NextResponse } from "next/server";
import {
  checkSirahOrigin,
  sirahAdmin,
  sirahReadAccess,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import {
  listSirahAdmin,
  actOnSirahOrder,
  sirahCsv,
} from "@/services/sirah-admin.service";
import { sirahAdminActionSchema } from "@/lib/sirah/validation";
import { SirahError } from "@/services/sirah-registration.service";
export async function GET(request: Request) {
  try {
    await sirahReadAccess(request);
    const params = new URL(request.url).searchParams;
    const data = await listSirahAdmin(params);
    if (params.get("format") === "csv")
      return new Response(sirahCsv(data), {
        headers: {
          "Content-Type": "text/csv;charset=utf-8",
          "Content-Disposition": "attachment; filename=sirah-students-page.csv",
          "Cache-Control": "private,no-store",
        },
      });
    return privateJson(data);
  } catch (error) {
    return sirahResponseError(error);
  }
}
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const actor = await sirahAdmin(request);
    const parsed = sirahAdminActionSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        {
          error:
            "Check the action, verified amount, currency and required reason.",
          fields: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    if (!actor) throw new SirahError("Unauthorised.", 401);
    return privateJson(await actOnSirahOrder(parsed.data, actor));
  } catch (error) {
    return sirahResponseError(error);
  }
}
