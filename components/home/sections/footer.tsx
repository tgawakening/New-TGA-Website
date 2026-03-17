"use client";

import Image from "next/image";

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

        <div>
          <h4 className="footer-title">Programs</h4>
          <ul className="footer-list">
            <li>All Courses</li>
            <li>Gen-Mumins</li>
            <li>Connect for Akhirah</li>
            <li>Nashrah</li>
          </ul>
        </div>
        <div>
          <h4 className="footer-title">Organisation</h4>
          <ul className="footer-list">
            <li>About Us</li>
            <li>Our Mission</li>
            <li>Support Us</li>
            <li>Contact</li>
          </ul>
        </div>
        <div>
          <h4 className="footer-title">Resources</h4>
          <ul className="footer-list">
            <li>Join Community</li>
            <li>Privacy Policy</li>
            <li>Terms & Conditions</li>
            <li>Refund Policy</li>
          </ul>
        </div>
        <div>
          <h4 className="footer-title">My Account</h4>
          <ul className="footer-list">
            <li>My Dashboard</li>
            <li>My Courses</li>
            <li>My Orders</li>
            <li>Settings</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#050919] py-4">
        <div className="ga-container flex flex-wrap items-center justify-between gap-4 text-xs text-white/70">
          <p>globalawakening.co.uk</p>
          <p>+44 7886 398150</p>
          <p>admin@tgaawakening.com</p>
          <button type="button" className="ga-btn ga-btn-primary h-10">
            Support Our Mission
          </button>
        </div>
      </div>
    </footer>
  );
}
