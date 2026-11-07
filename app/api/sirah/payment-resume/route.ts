import { z } from "zod";
import {
  checkSirahOrigin,
  privateJson,
  sirahResponseError,
} from "@/lib/sirah/http";
import {
  resolveSirahResumeToken,
  SIRAH_RESUME_COOKIE,
} from "@/lib/sirah/resume";
import {
  SirahError,
  publicSirahOrder,
} from "@/services/sirah-registration.service";
import { getCurrentUser } from "@/lib/auth/session";
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const input = z
      .object({ token: z.string().max(100) })
      .strict()
      .parse(await request.json());
    const grant = await resolveSirahResumeToken(input.token);
    if (!grant)
      throw new SirahError(
        "This payment link has expired or is invalid. Request a fresh link below.",
        410,
      );
    const signedIn = await getCurrentUser();
    if (signedIn && signedIn.id !== grant.order.userId)
      throw new SirahError(
        "This link belongs to another account. Sign out before using it.",
        403,
      );
    const response = privateJson({
      order: await publicSirahOrder(grant.orderId, grant.order.userId),
      user: {
        fullName: grant.order.user.fullName,
        email: grant.order.user.email,
        phoneCountryCode: grant.order.user.phoneCountryCode,
        phoneNumber: grant.order.user.phoneNumber,
      },
    });
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(SIRAH_RESUME_COOKIE, input.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: grant.expiresAt,
    });
    return response;
  } catch (error) {
    return sirahResponseError(error);
  }
}
