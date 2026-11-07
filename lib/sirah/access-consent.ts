import type { SirahTerms } from "./config";

export type SirahAccessConsents = {
  earlyServiceRequested?: boolean;
  digitalContentConsented?: boolean;
};

// Required only by an approved version that explicitly includes these texts.
// General terms acceptance alone never supplies either express consent.
export function sirahAccessConsentsComplete(
  terms: Pick<
    SirahTerms,
    "earlyServiceRequestText" | "digitalContentConsentText"
  > | null,
  consents: SirahAccessConsents = {},
) {
  return (
    Boolean(terms) &&
    (!terms?.earlyServiceRequestText ||
      consents.earlyServiceRequested === true) &&
    (!terms?.digitalContentConsentText ||
      consents.digitalContentConsented === true)
  );
}
