import { z } from "zod";
import {
  checkSirahOrigin,
  sirahUser,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import {
  ownedSirahOrder,
  SirahError,
} from "@/services/sirah-registration.service";
import { actOnSirahOrder } from "@/services/sirah-admin.service";
import { stripeClient } from "@/services/sirah-online.service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkSirahOrigin(request);
    const user = await sirahUser();
    const order = await ownedSirahOrder((await params).id, user.id);
    const input = z
      .object({
        action: z.enum(["PORTAL", "CANCEL"]),
        revision: z.number().int().nonnegative(),
        reason: z.string().trim().min(3).max(1500).optional(),
      })
      .strict()
      .parse(await request.json());
    if (input.action === "CANCEL") {
      if (!input.reason)
        throw new SirahError("Provide your cancellation reason.");
      return privateJson(
        await actOnSirahOrder(
          {
            orderId: order.id,
            revision: input.revision,
            action: "CANCEL",
            note: input.reason,
          },
          `student:${user.id}`,
        ),
      );
    }
    if (order.method === "STRIPE" && order.providerCustomerId) {
      const stripe = stripeClient();
      const account = await stripe.accounts.retrieve();
      if (account.id !== process.env.SIRAH_STRIPE_ACCOUNT_ID)
        throw new SirahError("Merchant identity mismatch.");
      const session = await stripe.billingPortal.sessions.create({
        customer: order.providerCustomerId,
        flow_data: {
          type: "payment_method_update",
          after_completion: {
            type: "redirect",
            redirect: {
              return_url: `${process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin}/seerah/register?order=${order.id}`,
            },
          },
        },
        return_url: `${process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin}/seerah/register?order=${order.id}`,
      });
      return privateJson({ url: session.url });
    }
    if (order.method === "PAYPAL" && order.providerSubscriptionId)
      return privateJson({ url: "https://www.paypal.com/myaccount/autopay/" });
    throw new SirahError(
      "This registration has no provider billing profile to manage.",
    );
  } catch (error) {
    return sirahResponseError(error);
  }
}
