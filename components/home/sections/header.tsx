"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { navItems } from "@/components/home/data";

const SHOW_AUTH_BUTTONS = false;

function PillButton({
  label,
  variant = "register",
}: {
  label: string;
  variant?: "register" | "signin";
}) {
  return (
    <button
      type="button"
      className={`ga-btn ga-header-cta ${
        variant === "register" ? "ga-cta-register" : "ga-cta-signin"
      }`}
    >
      {label}
    </button>
  );
}

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 78);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`ga-header sticky top-0 z-50 ${isScrolled ? "ga-header-scrolled" : ""}`}>
      <div className="ga-container flex h-24 items-center justify-between gap-4">
        <div className="flex items-center">
          <Image
            src="/logo.webp"
            alt="Global Awakening"
            width={220}
            height={74}
            className="ga-header-logo h-auto w-[150px] md:w-[182px]"
            priority
          />
        </div>

        <nav className="hidden items-center gap-2 lg:flex">
          {navItems.map((item) => (
            item.children?.length ? (
              <div key={item.label} className="ga-nav-dropdown group relative">
                <button type="button" className="ga-nav-btn ga-nav-btn-dropdown">
                  {item.label}
                  <span aria-hidden className="ga-nav-caret">
                    v
                  </span>
                </button>
                <div className="ga-nav-dropdown-menu">
                  {item.children.map((child) => (
                    <Link key={child.href} href={child.href} className="ga-nav-dropdown-link">
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link key={item.label} href={item.href ?? "/"} className="ga-nav-btn ga-nav-link">
                {item.label}
              </Link>
            )
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/support-our-mission" className="ga-btn ga-header-cta ga-cta-signin">
            Support Our Mission
          </Link>
          <Link href="/seerah/register" className="ga-btn ga-header-cta ga-cta-register">
            Enroll Now
          </Link>
        </div>

        {SHOW_AUTH_BUTTONS ? (
          <div className="hidden items-center gap-3 md:flex">
            <span className="ga-header-divider hidden lg:block" />
            <PillButton label="Register" variant="register" />
            <PillButton label="Sign In" variant="signin" />
          </div>
        ) : null}
      </div>
    </header>
  );
}

