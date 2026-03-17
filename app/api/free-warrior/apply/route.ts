import { NextResponse } from "next/server";
import { freeWarriorApplicationSchema } from "@/lib/validations/free-warrior";
import { submitFreeWarriorApplication } from "@/services/free-warrior.service";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = freeWarriorApplicationSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid Fee Waiver application data.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = await submitFreeWarriorApplication(parsed.data);
    return NextResponse.json({
      message: "Application submitted. We will email you after review.",
      applicationId: result.applicationId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fee Waiver application failed." },
      { status: 500 },
    );
  }
}
