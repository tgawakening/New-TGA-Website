import {
  checkSirahOrigin,
  sirahUser,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import {
  repriceSirah,
  SirahError,
} from "@/services/sirah-registration.service";
import { sirahRepriceSchema } from "@/lib/sirah/validation";
import {
  sirahClientIp,
  sirahRateLimit,
  MINUTE,
  HOUR,
} from "@/lib/sirah/rate-limit";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkSirahOrigin(request);
    const user = await sirahUser((await params).id);
    const input = sirahRepriceSchema.safeParse(await request.json());
    if (!input.success)
      throw new SirahError(
        "Select a valid country, plan and available payment method. Prices are resolved by the server.",
      );
    const v = input.data;
    if (v.couponCode) {
      // STRICT: the saved-order view can also validate a discount code here.
      // It is authenticated and bound to the owner's own order/email, so the
      // enumeration risk is low, but limit the code-validation path anyway —
      // per owner and per IP. Non-coupon repricing (country/plan/method) is
      // untouched, so legitimate saved-order changes are never blocked.
      const limited = sirahRateLimit([
        { key: `quote-coupon:user:${user.id}:m`, limit: 5, windowMs: MINUTE },
        { key: `quote-coupon:user:${user.id}:h`, limit: 20, windowMs: HOUR },
        { key: `quote-coupon:ip:${sirahClientIp(request)}:m`, limit: 15, windowMs: MINUTE },
        { key: `quote-coupon:ip:${sirahClientIp(request)}:h`, limit: 100, windowMs: HOUR },
      ]);
      if (limited) return limited;
    }
    return privateJson({
      order: await repriceSirah(
        (await params).id,
        user.id,
        v.revision,
        v.countryCode,
        v.plan,
        v.method,
        v.couponCode,
      ),
    });
  } catch (error) {
    return sirahResponseError(error);
  }
}
