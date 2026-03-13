import { NextResponse } from "next/server";

export function requireAdminToken(request: Request) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "ADMIN_API_TOKEN is not configured." }, { status: 500 });
  }

  const incoming = request.headers.get("x-admin-token");
  if (!incoming || incoming !== expected) {
    return NextResponse.json({ error: "Unauthorized admin access." }, { status: 401 });
  }

  return null;
}
