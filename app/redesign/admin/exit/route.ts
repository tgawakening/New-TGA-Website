import { NextResponse, type NextRequest } from "next/server";
import { INDIGO_PREVIEW_COOKIE } from "@/lib/indigo-preview";

/* Turns the admin preview theme off for this browser. */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/admin/sirah/overview", request.url));
  response.cookies.set(INDIGO_PREVIEW_COOKIE, "", { path: "/admin", maxAge: 0 });
  return response;
}
