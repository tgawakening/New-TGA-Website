import { redirect } from "next/navigation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { SirahAdminDiscount } from "@/components/sirah/admin-discount";

export default async function SirahDiscountCodesPage() {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  if (!access.canCreateDiscountCodes) redirect("/admin/sirah");
  return (
    <main className="ga-admin-page">
      <section className="ga-admin-page-section">
        <div className="ga-admin-container">
          <SirahAdminDiscount
            readOnly={access.readOnly}
            canApproveScholarships={access.canApproveScholarships}
            canCreateDiscountCodes={access.canCreateDiscountCodes}
          />
        </div>
      </section>
    </main>
  );
}
