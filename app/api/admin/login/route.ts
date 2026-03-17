import { NextResponse } from "next/server";
import { adminLoginSchema } from "@/lib/validations/admin";
import { attachAdminSessionCookie, authenticateAdminCredentials } from "@/lib/auth/admin-session";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = adminLoginSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid admin login payload." }, { status: 400 });
    }

    const authenticated = await authenticateAdminCredentials(parsed.data.email, parsed.data.password);
    if (!authenticated) {
      return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
    }

    const response = NextResponse.json({ message: "Admin logged in.", next: "/admin" });
    await attachAdminSessionCookie(response, parsed.data.email);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected admin login error." },
      { status: 500 },
    );
  }
}
