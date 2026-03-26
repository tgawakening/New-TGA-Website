import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth/admin";
import { getAdminNotifications } from "@/services/admin.service";

export async function GET(request: Request) {
  const unauthorized = requireAdminAccess(request);
  if (unauthorized) return unauthorized;

  try {
    const notifications = await getAdminNotifications();
    return NextResponse.json({ notifications });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load admin notifications." },
      { status: 500 },
    );
  }
}
