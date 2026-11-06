import { handleSirahPaypalWebhook } from "@/services/sirah-webhooks.service";
import { sirahResponseError, privateJson } from "@/lib/sirah/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    return privateJson(await handleSirahPaypalWebhook(request));
  } catch (error) {
    return sirahResponseError(error);
  }
}
