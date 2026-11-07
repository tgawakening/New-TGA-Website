import { handleSirahStripeWebhook } from "@/services/sirah-stripe-webhook.service";
import { privateJson, sirahResponseError } from "@/lib/sirah/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    return privateJson(
      await handleSirahStripeWebhook({
        signature: request.headers.get("stripe-signature"),
        payloadText: await request.text(),
      }),
    );
  } catch (error) {
    return sirahResponseError(error);
  }
}
