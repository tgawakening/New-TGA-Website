import AdminLogoutButton from "@/components/admin/admin-logout-button";

export function SirahAdminNav({ active, readOnly, canApproveScholarships = false }: { active: "enrolments" | "scholarships"; readOnly: boolean; canApproveScholarships?: boolean }) {
  return <header className="ga-admin-topbar" style={{ flexWrap: "wrap", gap: "1rem" }}>
    <a href="/admin/sirah" className="ga-admin-brand"><span className="ga-admin-brand-mark">TGA</span><span className="ga-admin-brand-title">Sīrah workspace</span></a>
    <nav className="ga-admin-nav" aria-label="Sīrah admin" style={{ flexWrap: "wrap" }}>
      {!readOnly && <a href="/admin?workspace=overview" className="ga-admin-nav-pill">Dashboard</a>}
      <a href="/admin/sirah" className={`ga-admin-nav-pill${active === "enrolments" ? " is-active" : ""}`} aria-current={active === "enrolments" ? "page" : undefined}>Sīrah enrolments</a>
      <a href="/admin/sirah/scholarships" className={`ga-admin-nav-pill${active === "scholarships" ? " is-active" : ""}`} aria-current={active === "scholarships" ? "page" : undefined}>Sīrah scholarships</a>
    </nav>
    <div className="ga-admin-topbar-actions">{readOnly && <span className="ga-admin-pill">{canApproveScholarships ? "Scholarship approver" : "Read-only team access"}</span>}<AdminLogoutButton /></div>
  </header>;
}
