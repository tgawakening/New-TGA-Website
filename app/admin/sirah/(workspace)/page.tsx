import { redirect } from "next/navigation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { SirahAdminStudents } from "@/components/sirah/admin-students";
import { getAdminNotifications } from "@/services/admin.service";

export default async function SirahAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; group?: string; payment?: string }>;
}) {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  const [{ order, group, payment }, notifications] = await Promise.all([
    searchParams,
    access.readOnly ? Promise.resolve([]) : getAdminNotifications(),
  ]);
  return (
    <SirahAdminStudents
      key={`${order}|${group}|${payment}`}
      initialOrder={order}
      initialGroup={group === "NOT_ADDED" || group === "ADDED" ? group : ""}
      initialPayment={payment === "PAID" ? payment : ""}
      initialNotifications={notifications}
      readOnly={access.readOnly}
      canManageEnrolments={access.canManageEnrolments}
      canMarkGroupAdded={access.canMarkGroupAdded}
    />
  );
}
