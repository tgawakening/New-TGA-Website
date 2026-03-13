import { NextResponse } from "next/server";
import { calculatePricing } from "@/lib/pricing";
import { pricingRequestSchema } from "@/lib/validations/pricing";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = pricingRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid pricing request.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const pricing = await calculatePricing({
      courseSlug: parsed.data.courseSlug,
      countryCode: parsed.data.countryCode,
      couponCode: parsed.data.couponCode || undefined,
    });

    return NextResponse.json({ pricing });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected pricing error.",
      },
      { status: 500 },
    );
  }
}
