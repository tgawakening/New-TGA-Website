import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin/admin-dashboard";
import AdminLogin from "@/components/admin/admin-login";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import {
  getAdminDashboardSnapshot,
  getAdminNotifications,
} from "@/services/admin.service";
import {
  processDueManualSubscriptions,
  reconcileMissingStripeSubscriptions,
} from "@/services/payment.service";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; tab?: string }>;
}) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    if (await getSirahWorkspaceAccess()) redirect("/admin/sirah");
    return (
      <main className="ga-admin-page">
        <section className="ga-admin-page-section">
          <div className="ga-admin-container">
            <AdminLogin />
          </div>
        </section>
      </main>
    );
  }

  const params = await searchParams;
  if (params.workspace !== "overview") redirect("/admin/sirah");

  await processDueManualSubscriptions();
  await reconcileMissingStripeSubscriptions();

  const [data, notifications] = await Promise.all([
    getAdminDashboardSnapshot(),
    getAdminNotifications(),
  ]);

  return (
    <main className="ga-admin-page">
      <section className="ga-admin-page-section">
        <div className="ga-admin-container">
          <AdminDashboard
            data={data}
            adminEmail={admin.email}
            initialNotifications={notifications}
            initialTab={params.tab === "scholarships" ? "scholarships" : "home"}
          />
        </div>
      </section>
    </main>
  );
}
