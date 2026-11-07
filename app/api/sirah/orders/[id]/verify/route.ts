import {
  checkSirahOrigin,
  sirahUser,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import {
  ownedSirahOrder,
  publicSirahOrder,
  SirahError,
} from "@/services/sirah-registration.service";
import {
  verifySirahStripeSession,
  verifySirahPaypal,
} from "@/services/sirah-online.service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkSirahOrigin(request);
    const user = await sirahUser((await params).id);
    const id = (await params).id;
    const order = await ownedSirahOrder(id, user.id);
    if (order.paymentState !== "PROCESSING")
      return privateJson({ order: await publicSirahOrder(id, user.id) });
    if (order.method === "STRIPE" && order.providerOrderId)
      await verifySirahStripeSession(id, order.providerOrderId);
    else if (
      order.method === "PAYPAL" &&
      (order.providerOrderId || order.providerSubscriptionId)
    )
      await verifySirahPaypal(
        id,
        (order.providerOrderId || order.providerSubscriptionId)!,
        true,
      );
    else
      throw new SirahError(
        "The provider has not finished creating this payment. Please check again shortly.",
        409,
      );
    return privateJson({ order: await publicSirahOrder(id, user.id) });
  } catch (error) {
    return sirahResponseError(error);
  }
}
