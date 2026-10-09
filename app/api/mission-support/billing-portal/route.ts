import { NextResponse } from "next/server";
import { z } from "zod";
import { createMissionBillingPortal } from "@/services/mission-support-stripe.service";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const parsed = z.object({ token: z.string().min(20).max(1000) }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please use the management link in your payment acknowledgment." }, { status: 400 });
    return NextResponse.json(await createMissionBillingPortal(parsed.data.token), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The management link is unavailable or expired. Please contact TGA for help." }, { status: 400 });
  }
}
