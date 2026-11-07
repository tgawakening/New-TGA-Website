import { sirahSchemaAvailable } from "@/lib/sirah/readiness";
import { currentSirahResumeGrant } from "@/lib/sirah/resume";
import { getCurrentUser } from "@/lib/auth/session";
import { privateJson, sirahResponseError } from "@/lib/sirah/http";
export async function GET() {
  try {
    const signedIn = await getCurrentUser();
    const grant = signedIn ? null : await currentSirahResumeGrant();
    const user = signedIn || grant?.order.user;
    const response = privateJson({
      resumeOrderId: grant?.orderId || null,
      available: await sirahSchemaAvailable(),
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
    response.headers.set("X-Sirah-Checkout-Version", "paid-period-routes-v1");
    return response;
  } catch (error) {
    return sirahResponseError(error);
  }
}
