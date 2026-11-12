import { redirect } from "next/navigation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { SirahAdminStudents } from "@/components/sirah/admin-students";
import { getAdminNotifications } from "@/services/admin.service";

/** Payments and reviews: the Students list pre-filtered to registrations that
 * need staff attention. Same component, same actions, same endpoint gates. */
export default async function SirahPaymentsPage() {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  const notifications = access.readOnly ? [] : await getAdminNotifications();
  return (
    <SirahAdminStudents
      view="payments"
      initialPayment="NEEDS_ATTENTION"
      initialNotifications={notifications}
      readOnly={access.readOnly}
      canManageEnrolments={access.canManageEnrolments}
      canMarkGroupAdded={access.canMarkGroupAdded}
    />
  );
}
