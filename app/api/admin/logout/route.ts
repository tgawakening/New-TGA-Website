import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/auth/admin-session";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ message: "Admin logged out." });
  clearAdminSessionCookie(response);
  await clearSessionCookie(response);
  return response;
}
