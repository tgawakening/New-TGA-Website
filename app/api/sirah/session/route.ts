import { getCurrentUser } from "@/lib/auth/session";
import { privateJson, sirahResponseError } from "@/lib/sirah/http";
export async function GET() {
  try {
    const user = await getCurrentUser();
    return privateJson({
      user:
        user && user.status === "ACTIVE"
          ? {
              fullName: user.fullName,
              email: user.email,
              phoneCountryCode: user.phoneCountryCode,
              phoneNumber: user.phoneNumber,
            }
          : null,
    });
  } catch (error) {
    return sirahResponseError(error);
  }
}
