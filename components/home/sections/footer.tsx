"use client";

import Image from "next/image";
import Link from "next/link";

const footerGroups = [
  {
    title: "Programs",
    links: [
      { label: "All Courses", href: "/#courses" },
      { label: "Gen-Mumins", href: "/projects/gen-mumin" },
      { label: "Connect for Akhirah", href: "/#community" },
      { label: "Nashrah", href: "/#projects" },
    ],
  },
  {
    title: "Organisation",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Our Mission", href: "/#mission" },
      { label: "Support Us", href: "/support-our-mission" },
      { label: "Contact", href: "mailto:admin@tgaawakening.com" },
    ],
  },
  {
    title: "Quick Links",
    links: [
      { label: "Terms & Conditions", href: "/policies/terms-and-conditions" },
      { label: "Terms of Service", href: "/policies/terms-of-service" },
      { label: "Code of Conduct", href: "/policies/code-of-conduct" },
      { label: "Refund Policy", href: "/policies/refund-policy" },
      { label: "Privacy Policy", href: "/policies/privacy-policy" },
    ],
  },
  {
    title: "My Account",
    links: [
      { label: "My Dashboard", href: "/dashboard" },
      { label: "My Courses", href: "/dashboard" },
      { label: "My Orders", href: "/dashboard" },
      { label: "Settings", href: "/dashboard" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#060c1f]">
      <div className="ga-container grid gap-10 py-16 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <Image
            src="/logo.webp"
            alt="Global Awakening"
            width={220}
            height={74}
            className="h-auto w-[150px] md:w-[182px]"
          />
          <p className="mt-4 text-sm leading-7 text-white/70">
            Uniting minds, inspiring change. A global Muslim community grounded
            in the timeless wisdom of Qur&apos;an.
          </p>
          <p className="mt-5 text-sm text-white/70">admin@tgaawakening.com</p>
          <p className="mt-2 text-sm text-white/70">United Kingdom</p>
        </div>

        {footerGroups.map((group) => (
          <div key={group.title}>
            <h4 className="footer-title">{group.title}</h4>
            <ul className="footer-list">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 bg-[#050919] py-4">
        <div className="ga-container flex flex-wrap items-center justify-between gap-4 text-xs text-white/70">
          <p>globalawakening.co.uk</p>
          <Link href="tel:+447886398150">+44 7886 398150</Link>
          <Link href="mailto:admin@tgaawakening.com">admin@tgaawakening.com</Link>
        </div>
      </div>
    </footer>
  );
}
