# Sīrah production origin and payment-return fix

Production App Platform presents an internal request URL, while NEXT_PUBLIC_APP_URL is https://www.tga-awakening.com/. Before this fix, POST requests carrying Origin: https://tga-awakening.com received HTTP 403 even though both public domains serve the app.

The new origin helper accepts the two configured HTTPS TGA domains. Unrelated hosts, lookalike domains and HTTP variants remain denied. Checkout and billing returns retain the validated starting origin so host-only authentication cookies remain available after returning from the provider.

The secure resume-link migration was applied successfully in production using the DigitalOcean PRE_DEPLOY job sirah-database-migrate, which now follows main for future migrations. Registration release e8f92dd is active and preserves the newer hero changes. The live Stripe key authenticates to the intended Sīrah account, and the email sender uses the verified tga-awakening.com domain. Actual live settlement and mail delivery are not claimed as tested.

The existing sandbox-verification and live-approval requirements are unchanged by this fix. A separate proposed no-sandbox launch setting was rejected by automatic approval review and is not included. Finance-approved terms and tax treatment remain pending.

Validation: 31 isolated MySQL workflow tests, including the production-host regression, rejected origins, and provider-isolated Checkout URL assertions. Lint and TypeScript checks pass. Post-deployment checks must confirm HTTP 410 for an invalid/expired link on both public domains, HTTP 403 for an unrelated Origin, and continued live-checkout blocking.
