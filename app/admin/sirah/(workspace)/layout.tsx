import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  getSirahWorkspaceAccess,
  SIRAH_ROLE_LABELS,
} from "@/lib/auth/sirah-workspace";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getSessionIdentity } from "@/lib/auth/session";
import { SirahAdminShell } from "@/components/sirah/admin-shell";

/** Sīrah workspace shell (left nav, header, role badge). Renders inside the
 * installable-app provider from app/admin/sirah/layout.tsx; the (workspace)
 * route group keeps /admin/sirah/login outside this signed-in shell.
 * Each page still runs its own access check. */
export default async function SirahAdminLayout({ children }: { children: ReactNode }) {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  const signedInAs =
    access.role === "SUPER_ADMIN"
      ? (await getCurrentAdmin())?.email || "Super Admin"
      : (await getSessionIdentity())?.email || "Team member";
  return (
    <main className="ga-admin-page">
      <section className="ga-admin-page-section">
        <div className="ga-admin-container">
          <SirahAdminShell
            access={{
              role: access.role,
              roleLabel: SIRAH_ROLE_LABELS[access.role],
              canCreateDiscountCodes: access.canCreateDiscountCodes,
              canManageEnrolments: access.canManageEnrolments,
              canManageAccess: access.canManageAccess,
            }}
            signedInAs={signedInAs}
          >
            {children}
          </SirahAdminShell>
        </div>
      </section>
    </main>
  );
}
