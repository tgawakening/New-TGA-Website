/** The reset token rides in this short-lived, httpOnly cookie, scoped to the
 * reset page, so it never sits in a page URL that analytics or a Referer
 * header could carry off. It lives as long as a reset token can (60 minutes,
 * RESET_TOKEN_MINUTES), so a student who opens the link late in its life is
 * not turned away by the cookie before the token itself expires; the token's
 * own expiry and single use are still checked on the server. */
export const RESET_COOKIE = "ga_reset";
export const RESET_COOKIE_PATH = "/reset-password";
export const RESET_COOKIE_SECONDS = 60 * 60;
