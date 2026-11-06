import "server-only";
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
        error instanceof SirahError
          ? error.message
          : "The request could not be completed. Please try again or contact support.",
    },
    {
      status: error instanceof SirahError ? error.status : 503,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
export function checkSirahOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (
    origin &&
    origin !== new URL(request.url).origin &&
    origin !== process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  )
    throw new SirahError("This request must come from the TGA website.", 403);
}
export async function sirahUser() {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE")
    throw new SirahError("Please sign in to continue.", 401);
  return user;
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
