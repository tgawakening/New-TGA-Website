import "server-only";
import { getCurrentAdmin } from "./admin-session";
import { requireAdminAccess } from "./admin";
import { getSessionIdentity } from "./session";

export async function getSirahWorkspaceAccess(request?: Request) {
  if (request ? !requireAdminAccess(request) : await getCurrentAdmin())
    return {
      readOnly: false,
      canApproveScholarships: true,
      canCreateDiscountCodes: true,
      canManageEnrolments: true,
    };
  const user = await getSessionIdentity(request);
  return user && ["SIRAH_VIEWER", "SIRAH_REVIEWER"].includes(user.role)
    ? {
        readOnly: true,
        canApproveScholarships: user.role === "SIRAH_REVIEWER",
        // Reviewers may issue discount codes; pure viewers stay read-only.
        canCreateDiscountCodes: user.role === "SIRAH_REVIEWER",
        // Reviewers may run enrolment actions (approve/complete/cancel/reject);
        // refunds remain env super-admin only, gated separately at the endpoint.
        canManageEnrolments: user.role === "SIRAH_REVIEWER",
      }
    : null;
}
