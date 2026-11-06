import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { SirahAdminStudents } from "@/components/sirah/admin-students";
import { sirahFont } from "@/lib/sirah/font";
import styles from "@/components/sirah/registration.module.css";
export default async function SirahAdminPage({searchParams}:{searchParams:Promise<{order?:string}>}) {
  if (!(await getCurrentAdmin())) redirect("/admin");
  return (
    <main className={`${styles.page} ${sirahFont.variable}`}>
      <SirahAdminStudents initialOrder={(await searchParams).order} />
    </main>
  );
}
