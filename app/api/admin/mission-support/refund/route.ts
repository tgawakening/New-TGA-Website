import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAccess } from "@/lib/auth/admin";
import { refundMissionPayment } from "@/services/mission-support-stripe.service";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const unauthorized = requireAdminAccess(request);
  if (unauthorized) return unauthorized;
  try {
    const parsed = z.object({ paymentId: z.string().min(1), requestId: z.uuid(), amountPence: z.number().int().positive().optional() }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid refund request." }, { status: 400 });
    return NextResponse.json(await refundMissionPayment(parsed.data.paymentId, parsed.data.requestId, parsed.data.amountPence));
  } catch {
    return NextResponse.json({ error: "The refund could not be requested. Check the payment in Stripe before retrying." }, { status: 400 });
  }
}
