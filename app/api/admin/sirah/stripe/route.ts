import { sirahAdmin, privateJson, sirahResponseError } from "@/lib/sirah/http";
import { stripeClient } from "@/services/sirah-online.service";
export async function GET(request: Request) {
  try {
    await sirahAdmin(request);
    const stripe = stripeClient();
    const account = await stripe.accounts.retrieve();
    const balance = await stripe.balance.retrieve();
    return privateJson({
      accountId: account.id,
      accountMatches: account.id === process.env.SIRAH_STRIPE_ACCOUNT_ID,
      mode: balance.livemode ? "live" : "sandbox",
      chargesEnabled: account.charges_enabled,
      signingSecretConfigured: Boolean(process.env.SIRAH_STRIPE_WEBHOOK_SECRET),
      sandboxApproved: process.env.SIRAH_STRIPE_SANDBOX_VERIFIED === "true",
      liveApproved: process.env.SIRAH_LIVE_PAYMENTS_APPROVED === "true",
    });
  } catch (error) {
    return sirahResponseError(error);
  }
}
