import { NextResponse } from "next/server";
import { RESET_COOKIE, RESET_COOKIE_PATH, RESET_COOKIE_SECONDS } from "@/lib/auth/password-reset-cookie";
import { isResetTokenShape } from "@/services/password-reset.service";
import { externalUrl } from "@/lib/external-origin";

/** The emailed link lands here. No page renders at this URL (so no analytics
 * sees the token): the token moves into a cookie and the browser goes on to
 * the clean /reset-password page. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const response = NextResponse.redirect(externalUrl(RESET_COOKIE_PATH, request), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (isResetTokenShape(token))
    response.cookies.set(RESET_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: RESET_COOKIE_PATH,
      maxAge: RESET_COOKIE_SECONDS,
    });
  return response;
}
