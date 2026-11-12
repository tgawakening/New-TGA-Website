import { NextResponse } from "next/server";
import {
  checkSirahOrigin,
  sirahAdmin,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { getSessionIdentity } from "@/lib/auth/session";
import {
  setSirahGroupAdded,
  sirahGroupStatusSchema,
} from "@/services/sirah-group.service";
import { SirahError } from "@/services/sirah-registration.service";

/**
 * The only write open to a Community Lead (SIRAH_VIEWER): mark a student as
 * added to (or removed from) the course group. Strict body, single purpose;
 * every other Sīrah mutation keeps its own unchanged gate.
 */
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const access = await getSirahWorkspaceAccess(request);
    if (!access?.canMarkGroupAdded)
      throw new SirahError("You are not authorised to update group status.", 401);
    const parsed = sirahGroupStatusSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Choose a registration and whether the student was added." },
        { status: 400 },
      );
    const actor =
      access.role === "SUPER_ADMIN"
        ? await sirahAdmin(request)
        : `${access.role === "MANAGER" ? "reviewer" : "lead"}:${(await getSessionIdentity(request))?.email ?? "unknown"}`;
    return privateJson(await setSirahGroupAdded(parsed.data, actor));
  } catch (error) {
    return sirahResponseError(error);
  }
}
