import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { presignDownload, spacesConfigured } from "@/lib/sirah/spaces";
import { materialFileHandler } from "@/services/sirah-classroom-files.service";

/** The editor's preview of an uploaded file: same handler as the student
 * route, gated on the classroom editor roles instead of enrolment. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = materialFileHandler({
  gate: async () => {
    const access = await getSirahWorkspaceAccess();
    return {
      studentId: access ? `staff:${access.role}` : null,
      allowed: Boolean(access && (access.role === "SUPER_ADMIN" || access.role === "MANAGER")),
    };
  },
  sign: presignDownload,
  configured: spacesConfigured,
  loginPath: "/admin/sirah/login",
  deniedPath: "/admin/sirah",
});
