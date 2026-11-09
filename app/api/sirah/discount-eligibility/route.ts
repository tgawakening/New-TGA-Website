import { NextResponse } from "next/server";
import { z } from "zod";
import { manualDiscountEligible } from "@/lib/sirah/manual-discount";
export async function POST(request: Request) {
  const input = z.object({ email: z.email().max(254) }).strict().safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ eligible: false }, { headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ eligible: await manualDiscountEligible(input.data.email) }, { headers: { "Cache-Control": "private, no-store" } });
}
