import { NextResponse } from "next/server";
import { getMissionPaymentConfirmation } from "@/services/mission-support-stripe.service";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId || !/^cs_(test_|live_)?[A-Za-z0-9_]+$/.test(sessionId) || sessionId.length > 255) return NextResponse.json({ error: "Invalid checkout reference." }, { status: 400 });
  try {
    return NextResponse.json(await getMissionPaymentConfirmation(sessionId), { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch {
    return NextResponse.json({ error: "We couldn't verify this payment yet. Please keep your provider receipt and contact TGA if you need help." }, { status: 404 });
  }
}
