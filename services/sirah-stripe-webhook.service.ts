import "server-only";
import Stripe from "stripe";
import { stripeClient } from "./sirah-online.service";
import { handleSirahStripeEvent } from "./sirah-webhooks.service";
import { SirahError } from "./sirah-registration.service";
export async function handleSirahStripeWebhook(
  input: { signature: string | null; payloadText: string },
  override?: Stripe,
) {
  const signingSecret = process.env.SIRAH_STRIPE_WEBHOOK_SECRET;
  if (!signingSecret)
    throw new SirahError("Sīrah card webhooks are not configured.", 503);
  if (!input.signature) throw new SirahError("Missing Stripe signature.", 400);
  const stripe = override || stripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      input.payloadText,
      input.signature,
      signingSecret,
    );
  } catch {
    throw new SirahError("Invalid Stripe signature.", 400);
  }
  const live =
    process.env.SIRAH_STRIPE_SECRET_KEY?.startsWith("sk_live_") ||
    process.env.SIRAH_STRIPE_SECRET_KEY?.startsWith("rk_live_");
  if (Boolean(event.livemode) !== Boolean(live))
    throw new SirahError(
      "Stripe event mode does not match the Sīrah account configuration.",
      400,
    );
  if (event.account && event.account !== process.env.SIRAH_STRIPE_ACCOUNT_ID)
    throw new SirahError("Stripe account mismatch.", 400);
  await handleSirahStripeEvent(event, stripe);
  return { received: true };
}
