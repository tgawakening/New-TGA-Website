import { redirect } from "next/navigation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { SirahAdminDiscount } from "@/components/sirah/admin-discount";

export default async function SirahDiscountCodesPage() {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  if (!access.canCreateDiscountCodes) redirect("/admin/sirah");
  return <SirahAdminDiscount />;
}
