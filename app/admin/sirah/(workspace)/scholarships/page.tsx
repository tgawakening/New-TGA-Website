import { redirect } from "next/navigation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { AdminScholarshipApplications } from "@/components/sirah/admin-scholarship-applications";
import { SirahAdminScholarships } from "@/components/sirah/admin-scholarships";

export default async function SirahScholarshipsPage() {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  return <>{access.canManageEnrolments && <AdminScholarshipApplications canEdit />}<SirahAdminScholarships readOnly={access.readOnly} canApproveScholarships={access.canApproveScholarships} /></>;
}
