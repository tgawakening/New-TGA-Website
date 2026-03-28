import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { paymentInitSchema } from "@/lib/validations/payment";
import { confirmStripeCheckoutSession } from "@/services/payment.service";
import { z } from "zod";

const confirmStripeSessionSchema = paymentInitSchema.extend({
  sessionId: z.string().min(1, "Session id is required."),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await request.json();
    const parsed = confirmStripeSessionSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload.", details: parsed.error.flatten() }, { status: 400 });
    }

    const result = await confirmStripeCheckoutSession({
      registrationId: parsed.data.registrationId,
      userId: user.id,
      sessionId: parsed.data.sessionId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stripe confirmation error." },
      { status: 500 },
    );
  }
}
