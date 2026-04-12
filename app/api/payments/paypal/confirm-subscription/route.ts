import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { confirmPaypalSubscription } from "@/services/payment.service";

const confirmSchema = z.object({
  registrationId: z.string().min(1),
  subscriptionId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await request.json();
    const parsed = confirmSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload.", details: parsed.error.flatten() }, { status: 400 });
    }

    const result = await confirmPaypalSubscription({
      registrationId: parsed.data.registrationId,
      userId: user.id,
      subscriptionId: parsed.data.subscriptionId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PayPal subscription confirmation error." },
      { status: 500 },
    );
  }
}