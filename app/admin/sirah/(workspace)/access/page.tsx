import { redirect } from "next/navigation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { SirahAdminAccess } from "@/components/sirah/admin-access";

export default async function SirahAccessPage() {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  // Cosmetic: the API itself refuses every non-Super-Admin caller.
  if (!access.canManageAccess) redirect("/admin/sirah");
  return <SirahAdminAccess />;
}
