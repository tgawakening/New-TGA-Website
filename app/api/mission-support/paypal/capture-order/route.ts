import { NextResponse } from "next/server";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { missionSupportPaypalCaptureSchema } from "@/lib/validations/mission-support";
import { confirmMissionPaypalPayment } from "@/services/mission-support-payments.service";
export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const parsed = missionSupportPaypalCaptureSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid PayPal confirmation." }, { status: 400 });
    return NextResponse.json(await confirmMissionPaypalPayment(parsed.data.donationId, parsed.data.orderId), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "PayPal has not confirmed this contribution. Keep your provider receipt and contact TGA if needed." }, { status: 400 });
  }
}
