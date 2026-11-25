import "server-only";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getSessionIdentity } from "@/lib/auth/session";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";

/** Do not expose submissions through an old super-admin cookie to a different
 * student signed in on the same browser. A manager keeps their own access. */
export async function taskAdminRole() {
  const access = await getSirahWorkspaceAccess();
  if (!access) return null;
  if (access.role !== "SUPER_ADMIN") return access.role === "MANAGER" ? "MANAGER" : null;
  const [admin, user] = await Promise.all([getCurrentAdmin(), getSessionIdentity()]);
  if (user && admin && user.email.trim().toLowerCase() !== admin.email.trim().toLowerCase()) {
    return user.role === "SIRAH_REVIEWER" ? "MANAGER" : null;
  }
  return "SUPER_ADMIN";
}
