import { NextResponse } from "next/server";
import { missionSupportStripeCheckoutSchema } from "@/lib/validations/mission-support";
import { getMissionSupportConfig } from "@/lib/mission-support-config";
import { startMissionStripeCheckout } from "@/services/mission-support-stripe.service";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!getMissionSupportConfig().checkoutAvailable) return NextResponse.json({ error: "Online contributions are not available yet. Please contact TGA to discuss supporting the mission." }, { status: 503 });
  try {
    const parsed = missionSupportStripeCheckoutSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please check your name, email, amount, and funding purpose.", details: parsed.error.flatten() }, { status: 400 });
    return NextResponse.json(await startMissionStripeCheckout(parsed.data));
  } catch (error) {
    console.error("Mission support checkout failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "We couldn't open secure checkout. No payment has been confirmed. Please retry or contact TGA." }, { status: 502 });
  }
}
