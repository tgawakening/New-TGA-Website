import { NextResponse } from "next/server";
import {
  checkSirahOrigin,
  sirahAdmin,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { requireAdminAccess } from "@/lib/auth/admin";
import { getSessionIdentity } from "@/lib/auth/session";
import { sirahAdminCustomLinkSchema } from "@/lib/sirah/admin-custom";
import { createSirahAdminCustomLink } from "@/services/sirah-admin-custom-link.service";
import { SirahError } from "@/services/sirah-registration.service";

// Same gate as enrolment actions: env super-admin or a DB SIRAH_REVIEWER.
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const access = await getSirahWorkspaceAccess(request);
    if (!access?.canManageEnrolments)
      throw new SirahError("You are not authorised to manage enrolments.", 401);
    const parsed = sirahAdminCustomLinkSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "Check the student details, country and custom amount.",
          fields: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    const isSuperAdmin = requireAdminAccess(request) === null;
    const actor = isSuperAdmin
      ? await sirahAdmin(request)
      : `reviewer:${(await getSessionIdentity(request))?.email ?? "unknown"}`;
    return privateJson(await createSirahAdminCustomLink(parsed.data, actor));
  } catch (error) {
    return sirahResponseError(error);
  }
}
