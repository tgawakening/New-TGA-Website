/** The reset token rides in this short-lived, httpOnly cookie, scoped to the
 * reset page, so it never sits in a page URL that analytics or a Referer
 * header could carry off. */
export const RESET_COOKIE = "ga_reset";
export const RESET_COOKIE_PATH = "/reset-password";
export const RESET_COOKIE_SECONDS = 30 * 60;
