import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { paymentInitSchema } from "@/lib/validations/payment";
import { createPaypalOrder } from "@/services/payment.service";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await request.json();
    const parsed = paymentInitSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload.", details: parsed.error.flatten() }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const result = await createPaypalOrder({
      registrationId: parsed.data.registrationId,
      userId: user.id,
      returnUrl: `${appUrl}/dashboard?payment=success&provider=paypal`,
      cancelUrl: `${appUrl}/seerah/register?payment=cancelled&resume=${encodeURIComponent(parsed.data.registrationId)}`,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PayPal order error." },
      { status: 500 },
    );
  }
}
