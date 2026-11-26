import "server-only";
import { redirect } from "next/navigation";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";

/** Page-level gate, evaluated before reading any revenue data. */
export async function requireCourseRevenueAccess() {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  if (access.role !== "SUPER_ADMIN") redirect("/admin/sirah/overview");
}
