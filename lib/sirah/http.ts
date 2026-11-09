import { SirahDiscountError } from "./manual-discount";
import "server-only";
import { sirahOriginAllowed } from "@/lib/sirah/origin";
import { currentSirahResumeGrant } from "@/lib/sirah/resume";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { requireAdminAccess } from "@/lib/auth/admin";
import { SirahError } from "@/services/sirah-registration.service";
export function sirahResponseError(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof SirahError || error instanceof SirahDiscountError
          ? error.message
          : "The request could not be completed. Please try again or contact support.",
    },
    {
      status: error instanceof SirahError ? error.status : error instanceof SirahDiscountError ? 400 : 503,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
export function checkSirahOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!sirahOriginAllowed(origin, request.url, process.env.NEXT_PUBLIC_APP_URL))
    throw new SirahError("This request must come from the TGA website.", 403);
  return (
    origin || new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin
  );
}
export async function sirahUser(orderId?: string) {
  const user = await getCurrentUser();
  if (user?.status === "ACTIVE") return user;
  if (orderId) {
    const grant = await currentSirahResumeGrant();
    if (grant?.orderId === orderId) return grant.order.user;
  }
  throw new SirahError(
    "Please sign in or request a fresh payment link to continue.",
    401,
  );
}
export async function sirahAdmin(request: Request) {
  const denied = requireAdminAccess(request);
  if (denied) throw new SirahError("Authorised admin access is required.", 401);
  const admin = await getCurrentAdmin();
  return admin
    ? `admin:${admin.email}`
    : `admin-api:${createHash("sha256")
        .update(request.headers.get("x-admin-token") || "")
        .digest("hex")
        .slice(0, 12)}`;
}
export const privateJson = (value: unknown) =>
  NextResponse.json(value, {
    headers: { "Cache-Control": "private, no-store" },
  });
