import AdminLogoutButton from "@/components/admin/admin-logout-button";
import { SirahAppInstallButton } from "./admin-app";

export function SirahAdminNav({ active, readOnly, canApproveScholarships = false, canCreateDiscountCodes = false, canManageEnrolments = false }: { active: "enrolments" | "scholarships" | "discounts" | "custom-link"; readOnly: boolean; canApproveScholarships?: boolean; canCreateDiscountCodes?: boolean; canManageEnrolments?: boolean }) {
  return <header className="ga-admin-topbar" style={{ flexWrap: "wrap", gap: "1rem" }}>
    <a href="/admin/sirah" className="ga-admin-brand"><span className="ga-admin-brand-mark">TGA</span><span className="ga-admin-brand-title">Sīrah workspace</span></a>
    <nav className="ga-admin-nav" aria-label="Sīrah admin" style={{ flexWrap: "wrap" }}>
      {!readOnly && <a href="/admin?workspace=overview" className="ga-admin-nav-pill">Dashboard</a>}
      <a href="/admin/sirah" className={`ga-admin-nav-pill${active === "enrolments" ? " is-active" : ""}`} aria-current={active === "enrolments" ? "page" : undefined}>Sīrah enrolments</a>
      <a href="/admin/sirah/scholarships" className={`ga-admin-nav-pill${active === "scholarships" ? " is-active" : ""}`} aria-current={active === "scholarships" ? "page" : undefined}>Sīrah scholarships</a>
      {canCreateDiscountCodes && <a href="/admin/sirah/discount-codes" className={`ga-admin-nav-pill${active === "discounts" ? " is-active" : ""}`} aria-current={active === "discounts" ? "page" : undefined}>Discount codes</a>}
      {canManageEnrolments && <a href="/admin/sirah/custom-link" className={`ga-admin-nav-pill${active === "custom-link" ? " is-active" : ""}`} aria-current={active === "custom-link" ? "page" : undefined}>Custom payment link</a>}
    </nav>
    <div className="ga-admin-topbar-actions">{readOnly && <span className="ga-admin-pill">{canApproveScholarships ? "Scholarship approver" : "Read-only team access"}</span>}<SirahAppInstallButton /><AdminLogoutButton redirectTo="/admin/sirah/login" /></div>
  </header>;
}
