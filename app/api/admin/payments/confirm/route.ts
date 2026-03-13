import { NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/auth/admin";
import { adminConfirmSchema } from "@/lib/validations/payment";
import { adminConfirmManualPayment } from "@/services/payment.service";

export async function POST(request: Request) {
  const unauthorized = requireAdminToken(request);
  if (unauthorized) return unauthorized;

  try {
    const json = await request.json();
    const parsed = adminConfirmSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload.", details: parsed.error.flatten() }, { status: 400 });
    }

    const result = await adminConfirmManualPayment({
      paymentId: parsed.data.paymentId,
      approve: parsed.data.approve,
      note: parsed.data.note,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Manual payment confirmation error." },
      { status: 500 },
    );
  }
}
