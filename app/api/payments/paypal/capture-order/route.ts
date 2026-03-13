import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { capturePaypalOrder } from "@/services/payment.service";

const captureSchema = z.object({
  registrationId: z.string().min(1),
  orderId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await request.json();
    const parsed = captureSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload.", details: parsed.error.flatten() }, { status: 400 });
    }

    const result = await capturePaypalOrder({
      registrationId: parsed.data.registrationId,
      userId: user.id,
      orderId: parsed.data.orderId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PayPal capture error." },
      { status: 500 },
    );
  }
}
