import { redirect } from "next/navigation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { SirahAdminScholarships } from "@/components/sirah/admin-scholarships";

export default async function SirahScholarshipsPage() {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  return <main className="ga-admin-page"><section className="ga-admin-page-section"><div className="ga-admin-container"><SirahAdminScholarships readOnly={access.readOnly} canApproveScholarships={access.canApproveScholarships} canCreateDiscountCodes={access.canCreateDiscountCodes} /></div></section></main>;
}
