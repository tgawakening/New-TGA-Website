/* Support Our Mission content for the Indigo Geometry redesign.
 * The data lists come from components/support/mission-support-content.ts and
 * lib/mission-support.ts (the live sources). The copy below is verbatim from
 * components/support/mission-support-experience.tsx, so the live
 * /support-our-mission stays untouched. */

import { missionContactEmail } from "@/lib/mission-support";

export { fundingAreas, learningPrinciples, contributionStages } from "@/components/support/mission-support-content";
export { companyRegisterUrl, missionContactEmail, missionPurposes, missionPurposeLabel } from "@/lib/mission-support";

/* Live: `amounts` and `storageKey`. The same session key, so a selection made
 * on either page carries over. */
export const amounts = [10, 25, 50, 100, 200] as const;
export const storageKey = "tga-mission-giving-selection";

export const hero = {
  kicker: "Support Our Mission",
  lede: "Help fund scholarships for students in need and make Islamic education accessible worldwide.",
  foundation: "Online Islamic education · Knowledge · Tarbiyah · Service",
};

export const purposeCopy = {
  kicker: "Knowledge. Tarbiyah. Responsibility.",
  lede: "Qur’an and Seerah learning that builds knowledge, character and responsibility.",
};

export const impactCopy = {
  kicker: "Your contribution in action",
  title: "What your support helps make possible.",
  lede: "From your contribution to learning opportunities for students in need.",
  caption: "Illustrative funding journey. Contact TGA for specific allocation arrangements.",
};

export const faqs: [string, string][] = [
  ["What does my contribution support?", "Scholarships, worldwide learning access and related educational costs. Your preference guides allocation; if funds are redirected, TGA will notify you by email. Specific restrictions must be agreed in writing before payment."],
  ["Is my contribution one-time or monthly?", "You choose in the form. Monthly support renews through Stripe until cancelled; use the secure management link in your acknowledgment or contact TGA for help."],
  ["Is the payment process secure?", "Online payment details are entered securely on Stripe or PayPal. TGA does not store your card details. Manual transfers are confirmed only after admin verification."],
  ["How do I contact TGA about a donation?", "Email " + missionContactEmail + " with your payment reference. The team can help with funding questions, cancellation or refund requests under the applicable contribution terms."],
  ["Is Gift Aid available?", "Gift Aid is not offered. TGA operates as GLOBAL AWAKENING CIC, a Community Interest Company; this page does not claim registered-charity status."],
];
