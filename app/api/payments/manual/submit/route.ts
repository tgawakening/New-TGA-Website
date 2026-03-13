import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { manualPaymentSubmitSchema } from "@/lib/validations/payment";
import { submitManualPayment } from "@/services/payment.service";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await request.json();
    const parsed = manualPaymentSubmitSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload.", details: parsed.error.flatten() }, { status: 400 });
    }

    const result = await submitManualPayment({
      registrationId: parsed.data.registrationId,
      userId: user.id,
      method: parsed.data.method,
      senderName: parsed.data.senderName,
      senderNumber: parsed.data.senderNumber,
      referenceKey: parsed.data.referenceKey,
      notes: parsed.data.notes,
      screenshotUrl: parsed.data.screenshotUrl,
    });

    return NextResponse.json({
      ...result,
      message: "Manual payment submitted. It will remain pending until admin verification.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Manual payment submission error." },
      { status: 500 },
    );
  }
}
