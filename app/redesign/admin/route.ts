import { NextResponse, type NextRequest } from "next/server";
import { INDIGO_PREVIEW_COOKIE, INDIGO_PREVIEW_VALUE } from "@/lib/indigo-preview";

/* Hidden preview entry for the admin reskin. Turns the Indigo theme on for
 * this browser and opens the real Sīrah workspace, so every page, action,
 * permission check and redirect is the live one. Does not sign anyone in:
 * the workspace still requires its normal login. */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/admin/sirah/overview", request.url));
  response.cookies.set(INDIGO_PREVIEW_COOKIE, INDIGO_PREVIEW_VALUE, {
    path: "/admin",
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
