import AdminDashboard from "@/components/admin/admin-dashboard";
import AdminLogin from "@/components/admin/admin-login";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getAdminDashboardSnapshot, getAdminNotifications } from "@/services/admin.service";

export default async function AdminPage() {
  const admin = await getCurrentAdmin();

  if (!admin) {
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

  const [data, notifications] = await Promise.all([
    getAdminDashboardSnapshot(),
    getAdminNotifications(),
  ]);

  return (
    <main className="ga-admin-page">
      <section className="ga-admin-page-section">
        <div className="ga-admin-container">
          <AdminDashboard data={data} adminEmail={admin.email} initialNotifications={notifications} />
        </div>
      </section>
    </main>
  );
}
