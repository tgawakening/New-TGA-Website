"use client";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#060c1f]">
      <div className="ga-container grid gap-10 py-16 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <h3 className="ga-logo">GlobalAwakening</h3>
          <p className="mt-4 text-sm leading-7 text-white/70">
            Uniting minds, inspiring change. A global Muslim community grounded
            in the timeless wisdom of Qur&apos;an.
          </p>
          <p className="mt-5 text-sm text-white/70">info@globalawakening.co.uk</p>
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
          <h4 className="footer-title">Organization</h4>
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
          <p>info@globalawakening.co.uk</p>
          <button type="button" className="ga-btn ga-btn-primary h-10">
            Support Our Mission
          </button>
        </div>
      </div>
    </footer>
  );
}
