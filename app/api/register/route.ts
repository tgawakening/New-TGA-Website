import { NextResponse } from "next/server";
import { attachSessionCookie } from "@/lib/auth/session";
import { registrationSchema } from "@/lib/validations/registration";
import { registerStudent } from "@/services/registration.service";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = registrationSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid registration data.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = await registerStudent(parsed.data);
    const response = NextResponse.json({
      message: "Registration created. Complete payment to activate LMS access.",
      registrationId: result.registrationId,
      paymentReference: result.paymentReference,
      pricing: result.pricing,
      next: {
        login: "/login",
        dashboard: "/dashboard",
      },
    });

    await attachSessionCookie(response, result.userId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected registration error.";
    const isKnownUserError = message.toLowerCase().includes("already registered");
    return NextResponse.json({ error: message }, { status: isKnownUserError ? 409 : 500 });
  }
}
