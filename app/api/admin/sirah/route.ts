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
  listSirahAdminForCsv,
  actOnSirahOrder,
  sirahCsv,
} from "@/services/sirah-admin.service";
import { sirahAdminActionSchema } from "@/lib/sirah/validation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { requireAdminAccess } from "@/lib/auth/admin";
import { getSessionIdentity } from "@/lib/auth/session";
import { SirahError } from "@/services/sirah-registration.service";

// Refunds (and the annual-refund quote that precedes them) stay env
// super-admin only; every other enrolment action is open to reviewers.
const REFUND_ACTIONS = new Set(["REFUND", "QUOTE_ANNUAL_REFUND"]);
export async function GET(request: Request) {
  try {
    const access = await sirahReadAccess(request);
    if (access.role === "COMMUNITY_LEAD") throw new SirahError("Student records are not available for this role.", 403);
    const params = new URL(request.url).searchParams;
    // The excluded (test / junk) view is for the super admin and managers,
    // who can exclude / un-exclude. The archive (soft-deleted records
    // awaiting purge) stays super-admin only.
    if (access.role !== "SUPER_ADMIN" && access.role !== "MANAGER")
      params.delete("excluded");
    if (access.role !== "SUPER_ADMIN") params.delete("archived");
    // The CSV covers every record matching the filters, not just one page.
    if (params.get("format") === "csv")
      return new Response(sirahCsv(await listSirahAdminForCsv(params)), {
        headers: {
          "Content-Type": "text/csv;charset=utf-8",
          "Content-Disposition": "attachment; filename=sirah-students.csv",
          "Cache-Control": "private,no-store",
        },
      });
    return privateJson(await listSirahAdmin(params));
  } catch (error) {
    return sirahResponseError(error);
  }
}
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    // Env super-admin or a DB SIRAH_REVIEWER may run enrolment actions; viewers
    // and everyone else may not.
    const access = await getSirahWorkspaceAccess(request);
    if (!access?.canManageEnrolments)
      throw new SirahError("You are not authorised to manage enrolments.", 401);
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
    const isSuperAdmin = requireAdminAccess(request) === null;
    // Refunds remain restricted to the main administrator.
    if (REFUND_ACTIONS.has(parsed.data.action) && !isSuperAdmin)
      throw new SirahError("Refunds require the main administrator.", 403);
    // Audit actor: reuse the admin identity for super-admins, else the
    // reviewer's signed-in email.
    const actor = isSuperAdmin
      ? await sirahAdmin(request)
      : `reviewer:${(await getSessionIdentity(request))?.email ?? "unknown"}`;
    return privateJson(await actOnSirahOrder(parsed.data, actor));
  } catch (error) {
    return sirahResponseError(error);
  }
}
