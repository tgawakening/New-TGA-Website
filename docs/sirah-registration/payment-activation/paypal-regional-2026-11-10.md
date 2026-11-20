# PayPal regional checkout rollout — 10 November 2026

Status: prepared and validated; **not deployed**. DigitalOcean rejected the app configuration update with HTTP 403: `dbaas list request failed: rpc error: code = PermissionDenied desc = you are missing the required permission database:read`. Readback confirmed the requested settings were not applied. The active release remains `880026463874300ae064bb97d0f902286e6e9062`, deployment `542c1085-fac2-4785-ad34-859ef8a8ec01`.

## Authorised scope

The owner requested upfront and monthly PayPal for all registration/pricing-guide countries PayPal permits. The proposed configuration authorises 193 country/currency pairs for both plans (386 plan routes), using the current catalogue prices. This is permission to offer checkout, not evidence of a completed payment, subscription, settlement or signed webhook delivery.

The PayPal REST country list is intersected with registration countries and supported catalogue currencies. `C2` in the provider reference maps to registration country `CN`. Unlisted countries are excluded. Russia is excluded because PayPal suspended transactional services; Belarus is held pending confirmation of current service availability. Pakistan remains excluded. Provider account, funding-source and location restrictions still apply at checkout; an allowlisted country does not guarantee an individual buyer's payment will be accepted.

Explicitly priced India (INR), Saudi Arabia (SAR), Qatar (QAR), Bahrain (BHD), Kuwait (KWD) and Romania (RON) stay on their existing non-PayPal routes. PayPal does not support those catalogue currencies. No alternate currency or conversion rate is invented. Countries already assigned the guide's GBP fallback retain GBP 29.99 monthly / GBP 323.89 upfront. Eurozone and other explicit supported prices are preserved.

## Existing configuration reused

Live OAuth authentication, the dedicated Sīrah product, the configured webhook endpoint and all eleven ACTIVE monthly plans were checked against PayPal. Plans match their currency, amount, monthly interval, twelve-cycle limit, cancellation/recovery settings, absence of setup charges and no added provider tax. GBP, USD, CAD, EUR, CHF, SEK, NOK, DKK, PLN, CZK and HUF are covered; HUF uses whole-unit provider amounts through the existing formatter. The current generic GBP alias already matches the approved plan. **No new product or subscription plans are needed or created.** Older-batch plans and all credentials are untouched.

An idempotent merchant preflight created an **uncaptured** GBP 323.89 provider order without a payee override. A subsequent provider GET independently matched its default receiving merchant to the configured merchant. The order remained `CREATED`: no approval, capture, charge, subscription, student registration, enrolment or notification occurred. This proves merchant routing only. Two previous cancelled Sīrah attempts returned provider HTTP 404; they are not success evidence. No completed Sīrah PayPal payment event is recorded.

## Exact configuration

`paypal-regional-2026-11-10.settings.json` contains the four public configuration values and exact route list. It contains no credentials. Apply only its `settings` object to the existing service's runtime environment:

- `SIRAH_ANNUAL_TERMS_JSON`
- `SIRAH_MONTHLY_TERMS_JSON`
- `SIRAH_PAYPAL_ANNUAL_CHECKOUT_ROUTES`
- `SIRAH_PAYPAL_MONTHLY_CHECKOUT_ROUTES`

Only PayPal route permissions and default terms version identifiers change. All contractual wording, tax wording, country prices, UK/Pakistan regional overrides, manual payment configuration, Stripe settings and verification flags remain unchanged. No independent legal/tax approval or sandbox verification is claimed. Do not set any `VERIFIED_ROUTES` or verification flags based on this rollout.

The running registration/order records are not rewritten. Existing terms acceptance and secure resume protections remain in force. Online enrolment still requires completed server-verified provider payment; staff receipt verification is only for manual payments.

## Validation and completion

- Eight existing checkout-activation tests passed.
- A read-only preview in the deployed runtime checked all 504 registration country/plan combinations: the expected 386 PayPal plan routes matched exactly, with no mismatches; Stripe, bank transfer and JazzCash availability were unchanged. Preview environment changes existed only in the short-lived Node process.
- The database workflow suite stopped at its localhost-only safety guard because this resumed workspace has no isolated `sirah_test` MySQL running. It did not run against production. No application code changed, so no new application build was required for preparing the configuration.
- DigitalOcean readback confirmed the failed PUT did not activate these routes.

**Administrator action:** add `database:read` to the current app-management API token, retaining existing App Platform access. Supply any replacement through secure environment settings, not chat. This specific missing scope comes from DigitalOcean's error, not a guess or a request to repeat provider setup.

After access is repaired: re-read the app spec, compare the four prepared settings with current configuration, preserve unrelated changes, apply the prepared patch, wait for ACTIVE, and verify the actual runtime plus public desktop/mobile registration choices. Then observe genuine buyer-approved upfront and monthly payments through completion, signed webhook handling, automatic enrolment and essential emails. Never label the full payment workflow verified on the strength of an uncaptured order or visible button.

Sources: [PayPal country codes](https://developer.paypal.com/api/codes/country-region/), [PayPal currency codes and receiving preferences](https://developer.paypal.com/api/codes/currency/), [PayPal Russia suspension](https://newsroom.paypal-corp.com/2022-03-05-paypal-ceo-dan-schulman-message-ukraine).
