import Stripe from "stripe";
async function main() {
  const key = process.env.SIRAH_STRIPE_SECRET_KEY;
  if (!key) throw Error("SIRAH_STRIPE_SECRET_KEY is missing.");
  const stripe = new Stripe(key);
  const account = await stripe.accounts.retrieve();
  const balance = await stripe.balance.retrieve();
  console.log(
    JSON.stringify(
      {
        accountId: account.id,
        accountMatches: account.id === process.env.SIRAH_STRIPE_ACCOUNT_ID,
        mode: balance.livemode ? "live" : "sandbox",
        chargesEnabled: account.charges_enabled,
        signingSecretConfigured: Boolean(
          process.env.SIRAH_STRIPE_WEBHOOK_SECRET,
        ),
        sandboxApproved: process.env.SIRAH_STRIPE_SANDBOX_VERIFIED === "true",
        liveApproved: process.env.SIRAH_LIVE_PAYMENTS_APPROVED === "true",
      },
      null,
      2,
    ),
  );
}
main().catch(() => {
  console.error(
    "Could not verify the dedicated Sīrah Stripe account. Check its server-side key and outbound connectivity. No credentials were printed.",
  );
  process.exitCode = 1;
});
