"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton({
  className = "ga-btn ga-btn-outline",
  children,
}: {
  className?: string;
  /** Optional icon shown before the label (the dashboard sidebar). */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" className={className} onClick={handleLogout} disabled={loading}>
      {children}
      <span>{loading ? "Logging out..." : "Logout"}</span>
    </button>
  );
}
