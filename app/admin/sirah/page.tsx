import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { SirahAdminStudents } from "@/components/sirah/admin-students";
import { getAdminNotifications } from "@/services/admin.service";

export default async function SirahAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  if (!(await getCurrentAdmin())) redirect("/admin");
  const [{ order }, notifications] = await Promise.all([
    searchParams,
    getAdminNotifications(),
  ]);
  return (
    <main className="ga-admin-page">
      <section className="ga-admin-page-section">
        <div className="ga-admin-container">
          <SirahAdminStudents key={order} initialOrder={order} initialNotifications={notifications} />
        </div>
      </section>
    </main>
  );
}
