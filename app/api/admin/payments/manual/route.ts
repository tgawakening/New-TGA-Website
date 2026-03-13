import { NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/auth/admin";
import { listManualPaymentsForAdmin } from "@/services/payment.service";

export async function GET(request: Request) {
  const unauthorized = requireAdminToken(request);
  if (unauthorized) return unauthorized;

  try {
    const rows = await listManualPaymentsForAdmin();
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load manual payments." },
      { status: 500 },
    );
  }
}
