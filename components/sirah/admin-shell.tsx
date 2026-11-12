"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AdminLogoutButton from "@/components/admin/admin-logout-button";
import { SirahAppInstallButton } from "./admin-app";
import styles from "./admin-shell.module.css";

export type SirahShellAccess = {
  role: "SUPER_ADMIN" | "MANAGER" | "COMMUNITY_LEAD";
  roleLabel: string;
  canCreateDiscountCodes: boolean;
  canManageEnrolments: boolean;
  canManageAccess: boolean;
};

type Item = {
  href: string;
  label: string;
  icon: ReactNode;
  show: boolean;
  sub?: boolean;
};

const icon = (path: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={path} />
  </svg>
);
const ICONS = {
  overview: icon("M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z"),
  students: icon("M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8"),
  payments: icon("M3 7h18v10H3zM3 11h18M7 15h3"),
  scholarships: icon("M12 3 2 8l10 5 10-5zM6 10v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"),
  discounts: icon("M20 12 12 20l-8-8V4h8zM8 8h.01"),
  links: icon("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"),
  access: icon("M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM9 12l2 2 4-4"),
  dashboard: icon("M3 12 12 4l9 8M5 10v10h14V10"),
};

/** Sīrah workspace frame: role-aware left nav and a header role badge.
 * Hiding a section is cosmetic only; every endpoint keeps its own gate. */
export function SirahAdminShell({
  access,
  signedInAs,
  children,
}: {
  access: SirahShellAccess;
  signedInAs: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const groups: { label: string; items: Item[] }[] = [
    {
      label: "Workspace",
      items: [
        { href: "/admin/sirah/overview", label: "Overview", icon: ICONS.overview, show: true },
        { href: "/admin/sirah", label: "Students", icon: ICONS.students, show: true },
        { href: "/admin/sirah/payments", label: "Payments and reviews", icon: ICONS.payments, show: true },
        { href: "/admin/sirah/scholarships", label: "Scholarship reviews", icon: ICONS.scholarships, show: true, sub: true },
      ],
    },
    {
      label: "Tools",
      items: [
        { href: "/admin/sirah/discount-codes", label: "Discount codes", icon: ICONS.discounts, show: access.canCreateDiscountCodes },
        { href: "/admin/sirah/custom-link", label: "Custom payment links", icon: ICONS.links, show: access.canManageEnrolments },
      ],
    },
    {
      label: "Administration",
      items: [
        { href: "/admin/sirah/access", label: "Access and roles", icon: ICONS.access, show: access.canManageAccess },
        { href: "/admin?workspace=overview", label: "Main dashboard", icon: ICONS.dashboard, show: access.role === "SUPER_ADMIN" },
      ],
    },
  ];
  const current = groups
    .flatMap((group) => group.items)
    .find((item) => item.href === pathname);
  return (
    <div className={styles.frame}>
      <aside className={styles.sidebar}>
        <a href="/admin/sirah/overview" className={styles.brand}>
          <span className={styles.brandMark}>TGA</span>
          <span className={styles.brandText}>
            <strong>Sīrah workspace</strong>
            <span>Beyond Chronology</span>
          </span>
        </a>
        <nav className={styles.nav} aria-label="Sīrah admin sections">
          {groups.map((group) => {
            const visible = group.items.filter((item) => item.show);
            if (!visible.length) return null;
            return (
              <div key={group.label} className={styles.navGroup}>
                <span className={styles.navLabel}>{group.label}</span>
                {visible.map((item) => {
                  const active = item.href === pathname;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={`${styles.link}${item.sub ? ` ${styles.sub}` : ""}${active ? ` ${styles.active}` : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.icon}
                      {item.label}
                    </a>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className={styles.main}>
        <header className={styles.header}>
          <p className={styles.headerTitle}>{current?.label || "Sīrah workspace"}</p>
          <div className={styles.headerMeta}>
            <span className={styles.who}>
              <strong>{signedInAs}</strong>
              <span>Signed in</span>
            </span>
            <span className={`${styles.badge} ${styles[access.role]}`} title="Your workspace role">
              {access.roleLabel}
            </span>
            {/* From the installable-app work (was in the old top nav). */}
            <SirahAppInstallButton />
            <AdminLogoutButton redirectTo="/admin/sirah/login" />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
