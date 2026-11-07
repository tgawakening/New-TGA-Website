# Residence and fixed fees — 7 November 2026

## Hosting and detection

The live domain sends `x-do-app-origin` and `x-do-orig-status`, identifying a DigitalOcean App Platform origin. DNS is delegated to ns1/ns2/ns3.digitalocean.com. A `cf-ray` header and Cloudflare edge addresses are also present; this does not independently establish a customer-managed Cloudflare zone with IP Geolocation enabled. The available DigitalOcean connection exposes Droplets, not App Platform settings, so those runtime settings could not be inspected or changed here.

For the current App Platform deployment, configure:

- `SIRAH_GEO_PROVIDER=APP_PLATFORM`
- `SIRAH_GEOIP_DATABASE_PATH=/absolute/runtime/path/GeoLite2-Country.mmdb`
- Provision and regularly update a licensed GeoLite2 Country database at that readable runtime path. Ensure the platform strips/replaces `do-connecting-ip` and that traffic enters through that trusted platform edge. Do not point this at an arbitrary forwarded header.

The lookup is server-side and uses only the platform's single validated `do-connecting-ip`. Missing settings, missing database, malformed IP or missing country safely suggest Pakistan. No visitor IP or lookup result is persisted. Only the database reader is cached. No GPS request or external IP lookup is made. Residence choices use browser-local storage and are never shared by the server across visitors.

If a separately verified Cloudflare proxy is used instead, enable IP Geolocation, restrict origin access to that proxy and have it replace incoming country headers, then configure `SIRAH_GEO_PROVIDER=CLOUDFLARE`. This uses only `CF-IPCountry`. A trusted direct Droplet can opt into `DROPLET`, with a sanitized `x-real-ip` header and the same database path. Vercel's managed environment uses its platform country header automatically; other deployments must explicitly opt in.

Priority is current explicit choice, saved explicit residence, trusted detected country, Pakistan. The previous form defaulted to GB, and browser language/locale was interpreted as residence. Both behaviours have been removed. Phone country remains independently editable. The form asks students to confirm residence; this is a UI confirmation, not a newly persisted contractual declaration.

## Payments

The fixed catalogue remains authoritative. Annual comparisons use twelve *online* monthly rates, including PKR 36,000 and GBP 359.88. Annual orders charge the approved upfront amount once. BHD and KWD preserve three decimal places; unsupported markets retain the approved GBP charge currency.

Pakistan online monthly pricing is displayed/used initially only when the existing server-side route checks pass. Otherwise the displayed initial rate is PKR 3,500, with an automatic-card-unavailable notice. Verified manual payment remains independent of online card readiness. Each plan reports its own availability. Payment method changes continue to recalculate on the server. Manual payment requires explicit acknowledgement of the displayed amount, including after resetting an unsettled card checkout; terms must also be accepted separately.

Public pricing probes on 7 November returned `available:false` and no approved monthly terms for both PK Stripe and bank transfer. This proves approved terms are a current blocker; it does not establish whether all other merchant flags/secrets are configured. The existing gates additionally require approved plan terms, verified manual accounts for manual routes, and for PK cards: `SIRAH_PK_RECURRING_VERIFIED=true`, PKR monthly currency support, Stripe merchant identity, secret key and webhook verification. Do not set the verification flag merely to enable the discount. Approved terms remain unpublished until supplied.

No real first-charge or renewal sandbox transaction was possible without connected provider sandbox credentials. The automated workflow uses explicit synthetic provider responses; it is not evidence of merchant/PKR recurring verification. PKR 3,000 remains gated. No production credentials, approval flags, policies or account details were changed. No database migration is required for this release.

## Validation

- Five country/price tests: choice priority, trusted-header modes/failure paths, all fixed annual comparisons and decimal precision, unavailable recurring fallback, and synthetic verified-card readiness.
- Existing 25 isolated-MySQL workflow tests, including payment method repricing, receipt ownership, annual one-time settlement, monthly renewal limits and historical pricing protection.
- Existing five campaign/catalogue tests.
- Browser first-visit PK and GB trusted hints (test-only configured proxy mode), direct-entry defaults, and saved explicit choices overriding a changed hint.
- Browser checks at 360, 390, 430 and 1440 px: fresh en-GB browser falls back to Pakistan, actual-country selector, monthly/annual fee handoff, cross-surface sync and saved choice. New registration verifies residence confirmation, server manual price, payment instructions and manual amount acknowledgement.
- Screenshots in this directory: `fees-residence-*.png`, `residence-modal-*.png`.
