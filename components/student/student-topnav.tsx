"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import LogoutButton from "@/components/dashboard/logout-button";
import s from "./student-topnav.module.css";

/* The one student top bar: the dashboard, Live classes, Resources & notices
 * and the rest of the classroom all render this, so the shell never changes
 * between them. Navigation only: every destination keeps its own gate, and
 * the dashboard sections keep their hash links (#overview, #course,
 * #payments). Dark celestial, on the classroom tokens (styles/tokens.css). */

export type StudentNavKey = "overview" | "course" | "live" | "resources" | "payments";
export type DashboardSectionKey = "overview" | "course" | "payments";

type Item = { key: StudentNavKey; label: string; href: string; section?: DashboardSectionKey; classroom?: boolean };

const ITEMS: Item[] = [
  { key: "overview", label: "Overview", href: "/dashboard#overview", section: "overview" },
  { key: "course", label: "My course", href: "/dashboard#course", section: "course" },
  { key: "live", label: "Live classes", href: "/seerah/classroom/schedule", classroom: true },
  { key: "resources", label: "Resources & notices", href: "/seerah/classroom#resources", classroom: true },
  { key: "payments", label: "Payments & subscription", href: "/dashboard#payments", section: "payments" },
];

const icon = (path: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={path} />
  </svg>
);
const BELL = icon("M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0");
const LOGOUT = icon("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9");
const CHEVRON = icon("M6 9l6 6 6-6");

export function StudentTopNav({
  active,
  inbox = null,
  classroomLocked = false,
  lockedHint,
  accountName,
  accountLinks = [],
  onSection,
}: {
  /** The highlighted item (null: none, e.g. a single lesson or the inbox). */
  active: StudentNavKey | null;
  /** The notifications bell and its unread count (omitted when the student has no classroom inbox). */
  inbox?: { href: string; unread: number } | null;
  /** Live classes and Resources show but are inactive (the classroom would not admit the student yet). */
  classroomLocked?: boolean;
  lockedHint?: string;
  /** Shown at the top of the account menu. */
  accountName?: string;
  /** Extra account links (My sessions for hosts, Admin Panel for staff). */
  accountLinks?: { label: string; href: string }[];
  /** On the dashboard itself: switch the section in place instead of reloading. */
  onSection?: (id: DashboardSectionKey, event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // Escape closes either panel; a click outside closes the account menu.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setAccountOpen(false);
      }
    };
    const onClick = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const renderItem = (item: Item, place: "bar" | "sheet") => {
    const isActive = active === item.key;
    const cls = `${place === "bar" ? s.item : s.sheetItem} ${isActive ? s.active : ""}`;
    if (item.classroom && classroomLocked)
      return (
        <span className={`${cls} ${s.locked}`} aria-disabled="true" title={lockedHint}>
          {item.label}
        </span>
      );
    return (
      <Link
        href={item.href}
        className={cls}
        aria-current={isActive ? "page" : undefined}
        onClick={(event) => {
          setMenuOpen(false);
          if (item.section && onSection) onSection(item.section, event);
        }}
      >
        {item.label}
      </Link>
    );
  };

  const initial = accountName?.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className={s.header}>
      <div className={s.bar}>
        <Link href="/dashboard" className={s.logo} aria-label="Student dashboard: The Global Awakening">
          <BrandLogo alt="" sizes="(min-width: 64rem) 150px, 120px" priority className={s.logoImg} />
        </Link>

        <nav className={s.items} aria-label="Student">
          <ul>
            {ITEMS.map((item) => (
              <li key={item.key}>{renderItem(item, "bar")}</li>
            ))}
          </ul>
        </nav>

        <div className={s.right}>
          {inbox ? (
            <Link
              href={inbox.href}
              className={s.bell}
              aria-label={inbox.unread ? `Notifications, ${inbox.unread} unread` : "Notifications"}
            >
              {BELL}
              {inbox.unread ? (
                <span className={s.count} aria-hidden="true">
                  {inbox.unread > 99 ? "99+" : inbox.unread}
                </span>
              ) : null}
            </Link>
          ) : null}

          <div className={s.account} ref={accountRef}>
            <button
              type="button"
              className={s.accountButton}
              aria-expanded={accountOpen}
              aria-haspopup="true"
              onClick={() => setAccountOpen((open) => !open)}
            >
              <span className={s.avatar} aria-hidden="true">
                {initial}
              </span>
              <span className={s.accountLabel}>Account</span>
              <span className={s.chevron}>{CHEVRON}</span>
            </button>
            {accountOpen ? (
              <div className={s.accountMenu}>
                {accountName ? <p className={s.accountName}>{accountName}</p> : null}
                {accountLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={s.menuLink} onClick={() => setAccountOpen(false)}>
                    {link.label}
                  </Link>
                ))}
                <LogoutButton className={`${s.menuLink} ${s.logout}`}>{LOGOUT}</LogoutButton>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className={s.menuButton}
            aria-expanded={menuOpen}
            aria-controls="student-nav-sheet"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className={s.srOnly}>Menu</span>
            <span className={`${s.burger} ${menuOpen ? s.burgerOpen : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Phones and tablets: the items as a clean list under the bar. */}
      <div id="student-nav-sheet" className={`${s.sheet} ${menuOpen ? s.sheetOpen : ""}`} hidden={!menuOpen}>
        <ul>
          {ITEMS.map((item) => (
            <li key={item.key}>{renderItem(item, "sheet")}</li>
          ))}
        </ul>
        {classroomLocked && lockedHint ? <p className={s.hint}>{lockedHint}</p> : null}
      </div>
    </header>
  );
}
