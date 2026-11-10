import { NextResponse, type NextRequest } from "next/server";

// General protection against case-sensitive 404s: members share links with
// inconsistent casing (e.g. /Seerah instead of /seerah) and Next.js routes are
// case-sensitive. Redirect any page request whose pathname contains uppercase
// letters to its lowercase form with a 308 (method/body preserving), keeping
// the query string intact.
//
// Scope (see `config.matcher`): this runs ONLY for human-facing page routes.
// It deliberately excludes:
//   - /api/*            payment-provider webhooks and internal fetch() calls use
//                       exact lowercase paths and must not be silently redirected
//   - /_next/*          framework internals
//   - any path with a "." (static assets) — /public contains case-sensitive
//                       served paths such as "/Seerah new/Seerah desktop hero.png"
//                       and "/Gen-Mumin.jpeg" that must be served verbatim.
// No route segment or dynamic param in app/ legitimately requires uppercase:
// all routed IDs are cuid (lowercase) and policy slugs are lowercase kebab-case.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const lower = pathname.toLowerCase();
  if (lower === pathname) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = lower;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
