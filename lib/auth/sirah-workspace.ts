import "server-only";
import { getCurrentAdmin } from "./admin-session";
import { requireAdminAccess } from "./admin";
import { getSessionIdentity } from "./session";

export async function getSirahWorkspaceAccess(request?: Request) {
  if (request ? !requireAdminAccess(request) : await getCurrentAdmin())
    return { readOnly: false, canApproveScholarships: true };
  const user = await getSessionIdentity(request);
  return user && ["SIRAH_VIEWER", "SIRAH_REVIEWER"].includes(user.role)
    ? { readOnly: true, canApproveScholarships: user.role === "SIRAH_REVIEWER" } : null;
}
