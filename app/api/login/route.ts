import { NextResponse } from "next/server";
import { attachSessionCookie } from "@/lib/auth/session";
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseUnavailable } from "@/lib/db-errors";
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
    // Database down or unreachable: a friendly 503, never the Prisma message.
    if (isDatabaseUnavailable(error)) {
      console.error("[login] database unavailable", error);
      return NextResponse.json({ error: DATABASE_UNAVAILABLE_MESSAGE }, { status: 503 });
    }
    // Only our own thrown messages (wrong password, inactive account) reach the user.
    if (error instanceof Error && !(error.constructor.name.startsWith("PrismaClient"))) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("[login] unexpected error", error);
    return NextResponse.json({ error: "Something went wrong while signing you in. Please try again." }, { status: 500 });
  }
}
