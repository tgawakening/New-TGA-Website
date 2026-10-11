import { NextResponse } from "next/server";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { getMissionSupportConfig } from "@/lib/mission-support-config";
import { missionSupportPaymentSchema } from "@/lib/validations/mission-support";
import { startMissionStripeCheckout } from "@/services/mission-support-stripe.service";
import { startAlternativeMissionPayment } from "@/services/mission-support-payments.service";

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const parsed = missionSupportPaymentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please check your contact, country and payment details.", details: parsed.error.flatten() }, { status: 400 });
    const config = getMissionSupportConfig();
    const available = parsed.data.paymentMethod === "STRIPE" ? config.checkoutAvailable : parsed.data.paymentMethod === "PAYPAL" ? config.paypalAvailable : config.manualAvailable;
    if (!available) return NextResponse.json({ error: "This payment method is temporarily unavailable. Please choose another method or contact TGA." }, { status: 503 });
    const result = parsed.data.paymentMethod === "STRIPE" ? { mode: "STRIPE", ...await startMissionStripeCheckout({ ...parsed.data, amountGbp: parsed.data.amountGbp! }) } : await startAlternativeMissionPayment(parsed.data);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Mission payment failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "We could not process this contribution. No payment has been confirmed. Retry with the same details or contact TGA." }, { status: 502 });
  }
}
