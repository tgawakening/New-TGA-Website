import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth/admin";
import { missionSupportAdminStatusSchema } from "@/lib/validations/mission-support";
import { adminUpdateMissionSupportDonation } from "@/services/mission-support.service";

export async function POST(request: Request) {
  const unauthorized = requireAdminAccess(request);
  if (unauthorized) return unauthorized;

  try {
    const json = await request.json();
    const parsed = missionSupportAdminStatusSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid mission support payload.", details: parsed.error.flatten() }, { status: 400 });
    }

    const result = await adminUpdateMissionSupportDonation(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update mission support donation." },
      { status: 500 },
    );
  }
}
