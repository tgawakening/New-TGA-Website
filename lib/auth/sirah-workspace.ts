import "server-only";
import { getCurrentAdmin } from "./admin-session";
import { requireAdminAccess } from "./admin";
import { getSessionIdentity } from "./session";

export async function getSirahWorkspaceAccess(request?: Request) {
  if (request ? !requireAdminAccess(request) : await getCurrentAdmin())
    return { readOnly: false };
  const user = await getSessionIdentity(request);
  return user?.role === "SIRAH_VIEWER" ? { readOnly: true } : null;
}
