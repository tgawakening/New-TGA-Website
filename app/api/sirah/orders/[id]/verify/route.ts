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
      return privateJson({
        order: await publicSirahOrder(id, user.id),
        settlementPending: false,
      });
    let settlementPending = false;
    if (order.method === "STRIPE" && order.providerOrderId) {
      const result = await verifySirahStripeSession(id, order.providerOrderId);
      settlementPending = result?.settlementPending ?? false;
    } else if (
      order.method === "PAYPAL" &&
      (order.providerOrderId || order.providerSubscriptionId)
    ) {
      const result = await verifySirahPaypal(
        id,
        (order.providerOrderId || order.providerSubscriptionId)!,
        true,
      );
      settlementPending = result?.settlementPending ?? false;
    } else
      throw new SirahError(
        "The provider has not finished creating this payment. Please check again shortly.",
        409,
      );
    return privateJson({
      order: await publicSirahOrder(id, user.id),
      settlementPending,
    });
  } catch (error) {
    return sirahResponseError(error);
  }
}
