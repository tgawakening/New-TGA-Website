import {
  parsePhoneNumberWithError,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js/max";
export function normalizeSirahPhone(
  country: string,
  callingCode: string,
  input: string,
) {
  try {
    const code = country.toUpperCase() as CountryCode;
    if (`+${getCountryCallingCode(code)}` !== callingCode)
      throw new Error(
        "Calling code does not match the selected phone country.",
      );
    const phone = parsePhoneNumberWithError(input.trim(), {
      defaultCountry: code,
      extract: false,
    });
    if (!phone.isValid() || phone.country !== code)
      throw new Error(
        "Enter a valid number for the selected phone country, or change the phone country.",
      );
    return {
      phoneCountry: code,
      phoneCountryCode: `+${phone.countryCallingCode}`,
      phoneNumber: String(phone.nationalNumber),
      phoneE164: String(phone.number),
    };
  } catch (cause) {
    if (cause instanceof Error && /match|selected/.test(cause.message))
      throw cause;
    throw new Error(
      "Enter a valid phone number for the selected phone country.",
    );
  }
}
