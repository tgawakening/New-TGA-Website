import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { pendingRegistrationUpdateSchema } from "@/lib/validations/registration";
import { updatePendingRegistration } from "@/services/registration.service";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await request.json();
    const parsed = pendingRegistrationUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid pending registration update data.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = await updatePendingRegistration({
      ...parsed.data,
      userId: user.id,
    });

    return NextResponse.json({
      message: "Pending registration updated.",
      registrationId: result.registrationId,
      paymentReference: result.paymentReference,
      pricing: result.pricing,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected pending registration update error." },
      { status: 500 },
    );
  }
}