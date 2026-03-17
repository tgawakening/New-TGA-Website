import { NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/auth/admin";
import { listFreeWarriorApplicationsForAdmin } from "@/services/free-warrior.service";

export async function GET(request: Request) {
  const unauthorized = requireAdminToken(request);
  if (unauthorized) return unauthorized;

  try {
    const rows = await listFreeWarriorApplicationsForAdmin();
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load Fee Waiver applications." },
      { status: 500 },
    );
  }
}
