/** No personal data. A checkout click is never treated as a confirmed payment. */
export type SeerahEvent =
  | "seerah_registration_open"
  | "seerah_whatsapp_click"
  | "seerah_country_select"
  | "seerah_checkout_start"
  | "seerah_enrolment_confirmed";
export function trackSeerah(
  event: SeerahEvent,
  details: Record<string, string> = {},
) {
  if (typeof window === "undefined") return;
  if (event === "seerah_checkout_start") {
    try {
      window.localStorage.setItem(
        "seerah-checkout-started",
        String(Date.now()),
      );
    } catch {
      /* Optional attribution. */
    }
  }
  const target = window as Window & {
    dataLayer?: Record<string, unknown>[];
    fbq?: (
      command: "trackCustom",
      name: string,
      details: Record<string, string>,
    ) => void;
  };
  target.dataLayer = target.dataLayer || [];
  target.dataLayer.push({ event, course: "seerah-course", ...details });
  target.fbq?.("trackCustom", event, { course: "seerah-course", ...details });
  window.dispatchEvent(new CustomEvent(event, { detail: details }));
}

/** Call only with a server-confirmed paid registration. Dedupe within this browser. */
export function trackConfirmedSeerahEnrolment(
  registrationId: string,
  createdAt: string,
) {
  const key = `seerah-confirmed:${registrationId}`;
  try {
    const started = Number(
      window.localStorage.getItem("seerah-checkout-started"),
    );
    if (
      !started ||
      !Number.isFinite(Date.parse(createdAt)) ||
      Date.parse(createdAt) < started - 60000 ||
      Date.now() - started > 30 * 86400000
    )
      return;
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    return; /* Without attribution, avoid counting historical enrolments. */
  }
  trackSeerah("seerah_enrolment_confirmed");
}
