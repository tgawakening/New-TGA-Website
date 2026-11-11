import { redirect } from "next/navigation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { SirahAdminStudents } from "@/components/sirah/admin-students";
import { getAdminNotifications } from "@/services/admin.service";

export default async function SirahAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin");
  const [{ order }, notifications] = await Promise.all([
    searchParams,
    access.readOnly ? Promise.resolve([]) : getAdminNotifications(),
  ]);
  return (
    <main className="ga-admin-page">
      <section className="ga-admin-page-section">
        <div className="ga-admin-container">
          <SirahAdminStudents key={order} initialOrder={order} initialNotifications={notifications} readOnly={access.readOnly} canApproveScholarships={access.canApproveScholarships} canCreateDiscountCodes={access.canCreateDiscountCodes} canManageEnrolments={access.canManageEnrolments} />
        </div>
      </section>
    </main>
  );
}
