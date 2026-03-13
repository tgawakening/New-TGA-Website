import { NextResponse } from "next/server";
import { attachSessionCookie } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations/registration";
import { loginWithEmailPassword } from "@/services/auth.service";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = loginSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid login payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const user = await loginWithEmailPassword(parsed.data);
    const response = NextResponse.json({
      message: "Logged in successfully.",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
      next: "/dashboard",
    });
    await attachSessionCookie(response, user.id);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected login error.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
