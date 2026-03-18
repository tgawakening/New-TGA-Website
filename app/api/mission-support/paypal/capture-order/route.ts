import { NextResponse } from "next/server";
import { missionSupportPaypalCaptureSchema } from "@/lib/validations/mission-support";
import { captureMissionSupportPaypalOrder } from "@/services/mission-support.service";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = missionSupportPaypalCaptureSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload.", details: parsed.error.flatten() }, { status: 400 });
    }

    const result = await captureMissionSupportPaypalOrder(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PayPal mission support capture error." },
      { status: 500 },
    );
  }
}
