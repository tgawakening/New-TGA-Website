import { countries } from "countries-list";

export const donationCountries = Object.entries(countries).map(([code, country]) => ({ code, name: country.name, dialCode: `+${country.phone[0]}` })).sort((a, b) => a.name.localeCompare(b.name));
export function donationCountry(code: string) { return donationCountries.find(country => country.code === code); }
export function allowsManualDonation(countryCode: string, phoneCountryCode: string) { return countryCode === "PK" && phoneCountryCode === "+92"; }
export const manualDonationAccounts = {
  bank: { name: "Meezan Bank", title: "AREEJ FATIMA", number: "98900114432111", iban: "PK96MEZN0098900114432111" },
  jazzcash: { name: "JazzCash", title: "Areej Fatima", number: "03244517741" },
};
