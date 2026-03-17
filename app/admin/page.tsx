import AdminDashboard from "@/components/admin/admin-dashboard";
import AdminLogin from "@/components/admin/admin-login";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getAdminDashboardSnapshot } from "@/services/admin.service";

export default async function AdminPage() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return (
      <main className="ga-page">
        <section className="ga-section">
          <div className="ga-container">
            <AdminLogin />
          </div>
        </section>
      </main>
    );
  }

  const data = await getAdminDashboardSnapshot();

  return (
    <main className="ga-page">
      <section className="ga-section">
        <div className="ga-container">
          <AdminDashboard data={data} adminEmail={admin.email} />
        </div>
      </section>
    </main>
  );
}
