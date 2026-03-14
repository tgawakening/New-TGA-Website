import { NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/auth/admin";
import { freeWarriorReviewSchema } from "@/lib/validations/free-warrior";
import { reviewFreeWarriorApplication } from "@/services/free-warrior.service";

export async function POST(request: Request) {
  const unauthorized = requireAdminToken(request);
  if (unauthorized) return unauthorized;

  try {
    const json = await request.json();
    const parsed = freeWarriorReviewSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload.", details: parsed.error.flatten() }, { status: 400 });
    }

    const result = await reviewFreeWarriorApplication(parsed.data);
    return NextResponse.json({ application: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Free Warrior review failed." },
      { status: 500 },
    );
  }
}
