import { redirect } from "next/navigation";
import AdminLogin from "@/components/admin/admin-login";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { SirahAppInstallButton } from "@/components/sirah/admin-app";
import styles from "@/components/sirah/admin-app.module.css";

export default async function SirahAppLoginPage() {
  if (await getSirahWorkspaceAccess()) redirect("/admin/sirah");
  return <main className="ga-admin-page"><section className="ga-admin-page-section"><div className="ga-admin-container"><div className={styles.loginInstall}><SirahAppInstallButton /></div><AdminLogin workspace="sirah" /></div></section></main>;
}
