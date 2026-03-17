import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth/admin";
import { adminRegistrationActionSchema } from "@/lib/validations/admin";
import { adminUpdateRegistrationRecord } from "@/services/admin.service";

export async function POST(request: Request) {
  const unauthorized = requireAdminAccess(request);
  if (unauthorized) return unauthorized;

  try {
    const json = await request.json();
    const parsed = adminRegistrationActionSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status update payload." }, { status: 400 });
    }

    const result = await adminUpdateRegistrationRecord(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update registration." },
      { status: 500 },
    );
  }
}
