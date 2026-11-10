import { NextResponse } from "next/server";
import { adminLoginSchema } from "@/lib/validations/admin";
import { attachAdminSessionCookie, authenticateAdminCredentials, clearAdminSessionCookie } from "@/lib/auth/admin-session";
import { attachSessionCookie } from "@/lib/auth/session";
import { authenticateSirahViewer } from "@/services/sirah-team.service";
import { checkSirahOrigin, sirahResponseError } from "@/lib/sirah/http";

export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const json = await request.json();
    const parsed = adminLoginSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid admin login payload." }, { status: 400 });
    }

    const authenticated = await authenticateAdminCredentials(parsed.data.email, parsed.data.password);
    if (!authenticated) {
      const viewer = await authenticateSirahViewer(parsed.data.email, parsed.data.password);
      if (!viewer) return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
      const response = NextResponse.json({ message: "Sīrah team logged in.", next: "/admin/sirah" });
      clearAdminSessionCookie(response);
      await attachSessionCookie(response, viewer.id, 12);
      return response;
    }

    const response = NextResponse.json({ message: "Admin logged in.", next: "/admin" });
    await attachAdminSessionCookie(response, parsed.data.email);
    return response;
  } catch (error) {
    return sirahResponseError(error);
  }
}
