import { NextResponse } from "next/server";
import { processDueManualSubscriptions } from "@/services/payment.service";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const token = process.env.ADMIN_API_TOKEN?.trim();
  if (!token) return false;

  const authHeader = request.headers.get("authorization")?.trim();
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const headerToken = request.headers.get("x-admin-token")?.trim();

  return bearerToken === token || headerToken === token;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await processDueManualSubscriptions();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not process manual renewals." },
      { status: 500 },
    );
  }
}
