import { NextResponse } from "next/server";
import { hasValidAdminSession } from "@/lib/auth/admin-session";

function normalizeEnvValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

export function requireAdminAccess(request: Request) {
  if (hasValidAdminSession(request)) {
    return null;
  }

  const expected = process.env.ADMIN_API_TOKEN ? normalizeEnvValue(process.env.ADMIN_API_TOKEN) : "";
  if (!expected) {
    return NextResponse.json(
      { error: "Admin access is not configured. Add admin dashboard credentials or ADMIN_API_TOKEN." },
      { status: 500 },
    );
  }

  const incoming = request.headers.get("x-admin-token");
  if (!incoming || incoming !== expected) {
    return NextResponse.json({ error: "Unauthorized admin access." }, { status: 401 });
  }

  return null;
}

export const requireAdminToken = requireAdminAccess;
