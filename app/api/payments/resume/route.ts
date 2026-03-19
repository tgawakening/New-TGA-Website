import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPendingRegistrationForResume } from "@/services/payment.service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const registrationId = searchParams.get("registrationId");
    if (!registrationId) {
      return NextResponse.json({ error: "registrationId is required." }, { status: 400 });
    }

    const registration = await getPendingRegistrationForResume({
      registrationId,
      userId: user.id,
    });

    return NextResponse.json({ registration });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load pending registration." },
      { status: 500 },
    );
  }
}
