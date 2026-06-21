"use client";

import Image from "next/image";
import Link from "next/link";

const footerGroups = [
  {
    title: "Explore TGA",
    links: [
      { label: "Home", href: "/" },
      { label: "About Us", href: "/about" },
      { label: "Our Mission", href: "/#mission" },
      { label: "Support Us", href: "/support-our-mission" },
    ],
  },
  {
    title: "Programs & Projects",
    links: [
      { label: "All Courses", href: "/#courses" },
      { label: "Seerah Course", href: "/seerah" },
      { label: "Gen-Mumin", href: "/projects/gen-mumin" },
      { label: "Future Projects", href: "/#projects" },
    ],
  },
  {
    title: "Policies",
    links: [
      { label: "Terms & Conditions", href: "/policies/terms-and-conditions" },
      { label: "Terms of Service", href: "/policies/terms-of-service" },
      { label: "Code of Conduct", href: "/policies/code-of-conduct" },
      { label: "Refund Policy", href: "/policies/refund-policy" },
    ],
  },
];

const socialLinks = [
  { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61563366532245" },
  { label: "YouTube", href: "https://www.youtube.com/@Globalawakeningchannel" },
  { label: "Instagram", href: "https://www.instagram.com/global_awakening_channel/" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#060c1f]">
      <div className="ga-container footer-main-grid py-16">
        {footerGroups.map((group) => (
          <div key={group.title}>
            {group.title === "Explore TGA" ? (
              <Image
                src="/logo.webp"
                alt="Global Awakening"
                width={220}
                height={74}
                className="footer-logo"
              />
            ) : null}
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
        <div className="ga-container footer-bottom">
          <p>Copyright © {new Date().getFullYear()} Global Awakening Ltd. All rights reserved.</p>
          <div className="footer-contact">
            <Link href="tel:+447886398150">+44 7886 398150</Link>
            <Link href="mailto:admin@tgaawakening.com">admin@tgaawakening.com</Link>
          </div>
          <div className="footer-socials" aria-label="Global Awakening social accounts">
            {socialLinks.map((link) => (
              <Link key={link.href} href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
