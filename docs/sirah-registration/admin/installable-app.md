# Installable Sīrah admin workspace

The Sīrah workspace can be added to a phone's home screen and launched in a standalone window. Its manifest uses `/admin/sirah` as the start URL, `/admin/` as its scope, and TGA Sīrah PNG icons (192/512px, plus a 180px Apple touch icon). Admin app metadata is attached only to the Sīrah layout. Public course and registration pages do not receive the manifest or a controlling worker.

## Installation and login

An **Install app** button is available in the Sīrah navigation and its new in-scope sign-in page at `/admin/sirah/login`. When Chrome/Edge offers `beforeinstallprompt`, the button opens the native prompt. Otherwise it shows concise browser-menu instructions. iPhone/iPad users are guided through Safari → Share → Add to Home Screen → Add, retaining Open as Web App if offered. Links opened inside messaging apps should first be opened in the normal browser. Installation availability remains controlled by the browser; private browsing does not permit installation.

The install prompt is retained across client-side sign-in. The button hides in standalone mode and after an accepted install during the current visit. No claim is made that every visitor will receive an automatic native popup. The existing login/password, session expiry and server permissions remain unchanged, including scholarship approval and the newer Discount codes tab. Both scoped team and full-administrator sign-in stay inside the installed app's route scope. Logout and unauthenticated Sīrah-page redirects also use the in-scope sign-in page; the general `/admin` login remains available.

Standalone styling accounts for notches and home indicators, including usable page and dialog heights. This is a browser-installed web app; App Store/Play Store publication and push notifications are outside this change.

## Privacy and offline behaviour

`/admin/sw.js` registers with the `/admin/` scope and is served with `Cache-Control: no-store`. It handles same-origin GET navigations under that path using live network requests with `cache: no-store`. It uses **no Cache Storage**, cached private pages/API responses, background sync or queued approvals. API requests, mutations, public-page navigation and other origins are not intercepted. An offline navigation failure returns a generic 503 reconnect page with no reflected URL/query data and a restrictive CSP. An already-open page shows a connection banner when the browser reports offline. Reconnecting loads the live workspace again.

This does not claim to erase ordinary browser memory, existing site storage, cookies or OS app snapshots. It adds no offline store for student records or credentials. Authentication and every existing server permission still apply.

## Validation

- Lint, TypeScript and production build passed.
- Five new worker/manifest/icon tests passed, covering network-only navigation, generic offline guidance, absence of Cache Storage and bypass of API/mutation/public/cross-origin requests.
- Chromium's DevTools installability check in a normal persistent profile reports **zero manifest/installability errors**. The expected private/incognito install restriction was excluded by using that regular profile.
- Browser checks cover 390/768/1350px layouts, iPhone/iPad instruction layouts, login, native-prompt callback behaviour across sign-in, prompt acceptance hiding the CTA, empty Cache Storage, failed offline API reads, generic offline reload, reconnection, in-scope logout and logged-out API denial. The prompt callback and standalone display checks are simulations; physical Android/iPhone home-screen installation is not claimed as performed.
- The existing Discount codes tab remains visible to its authorised role. Full-administrator sign-in is checked without a detour through the out-of-scope general admin URL.

### Existing main-branch regression failures

A broader run returned **106 passing / 5 failing out of 111 cases**. The same five failures were reproduced in an untouched detached checkout of `origin/main` at `da9b633` (91 passing / 5 failing in its corresponding 96-case subset). They predate this app change:

1. Two access tests deep-compare capability objects that lack the newly added `canCreateDiscountCodes` property.
2. A discount quote test expects HTTP 400 after repeated invalid-code attempts, but the new rate limiter returns 429.
3. A reprice test expects a previous conflict message, but the new redemption limit rejects the already-used code first.
4. An email-bound code test expects the old generic error, while current code gives the newer specific email-mismatch error.

The app work does not change discount, rate-limit, payment or permission policy code to make those older expectations pass. Relevant source and logs were compared with main; these are recorded as existing baseline failures, not successful tests.

## Release

Commit/push this change to a review branch and obtain the owner's explicit production merge/deployment approval. No database migration, credentials, provider setup or environment-variable changes are required. After deployment, confirm the actual DigitalOcean/public source commit, manifest and worker headers, icons, in-scope sign-in/logout, empty private Cache Storage and browser installability. Then perform a real Add to Home Screen check on an authorised phone; do not create a real scholarship award, payment or test student to verify installation.
