import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/services/payment.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    const payloadText = await request.text();
    const result = await handleStripeWebhook({ signature, payloadText });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stripe webhook error." },
      { status: 400 },
    );
  }
}
