import "server-only";
import { getCurrentAdmin } from "./admin-session";
import { requireAdminAccess } from "./admin";
import { getSessionIdentity } from "./session";

/** Display roles over the existing access model (no new auth):
 * SUPER_ADMIN = env admin, MANAGER = SIRAH_REVIEWER, COMMUNITY_LEAD = SIRAH_VIEWER. */
export type SirahWorkspaceRole = "SUPER_ADMIN" | "MANAGER" | "COMMUNITY_LEAD";
export const SIRAH_ROLE_LABELS: Record<SirahWorkspaceRole, string> = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Manager",
  COMMUNITY_LEAD: "Community Lead",
};

export async function getSirahWorkspaceAccess(request?: Request) {
  if (request ? !requireAdminAccess(request) : await getCurrentAdmin())
    return {
      role: "SUPER_ADMIN" as SirahWorkspaceRole,
      readOnly: false,
      canApproveScholarships: true,
      canCreateDiscountCodes: true,
      canManageEnrolments: true,
      // Only the env super admin manages who has workspace access.
      canManageAccess: true,
      canMarkGroupAdded: true,
    };
  const user = await getSessionIdentity(request);
  return user && ["SIRAH_VIEWER", "SIRAH_REVIEWER"].includes(user.role)
    ? {
        role: (user.role === "SIRAH_REVIEWER"
          ? "MANAGER"
          : "COMMUNITY_LEAD") as SirahWorkspaceRole,
        readOnly: true,
        canApproveScholarships: user.role === "SIRAH_REVIEWER",
        // Reviewers may issue discount codes; pure viewers stay read-only.
        canCreateDiscountCodes: user.role === "SIRAH_REVIEWER",
        // Reviewers may run enrolment actions (approve/complete/cancel/reject);
        // refunds remain env super-admin only, gated separately at the endpoint.
        canManageEnrolments: user.role === "SIRAH_REVIEWER",
        canManageAccess: false,
        // The single write a Community Lead (SIRAH_VIEWER) may make: the
        // "added to course group" toggle, via its own dedicated endpoint.
        canMarkGroupAdded: true,
      }
    : null;
}
