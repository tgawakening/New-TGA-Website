import { NextResponse } from "next/server";
import { z } from "zod";
import { manualDiscountEligible } from "@/lib/sirah/manual-discount";
import {
  sirahClientIp,
  sirahRateLimit,
  normalizeEmail,
  MINUTE,
  HOUR,
} from "@/lib/sirah/rate-limit";
export async function POST(request: Request) {
  const input = z.object({ email: z.email().max(254) }).strict().safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ eligible: false }, { headers: { "Cache-Control": "private, no-store" } });
  const email = normalizeEmail(input.data.email);
  const ip = sirahClientIp(request);
  // STRICT: this endpoint confirms which emails hold a discount code, so it is
  // the enumeration/guessing surface. The per-email cap is the real brute-force
  // bound (one address can't be hammered). It fires on email entry for every
  // visitor, so the per-IP cap is deliberately loose — a shared school/madrasah
  // lab registering many students from one IP is never throttled.
  const limited = sirahRateLimit(
    [
      { key: `discount-eligibility:email:${email}:m`, limit: 5, windowMs: MINUTE },
      { key: `discount-eligibility:email:${email}:h`, limit: 20, windowMs: HOUR },
      { key: `discount-eligibility:ip:${ip}:m`, limit: 30, windowMs: MINUTE },
      { key: `discount-eligibility:ip:${ip}:h`, limit: 300, windowMs: HOUR },
    ],
    { eligible: false },
  );
  if (limited) return limited;
  return NextResponse.json({ eligible: await manualDiscountEligible(email) }, { headers: { "Cache-Control": "private, no-store" } });
}
