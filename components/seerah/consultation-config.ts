/** Client-approved public Sīrah enquiries. Never put paid-student invitations here. */
export const consultationDestinations = {
  pakistan: "https://chat.whatsapp.com/Hhs5PieBzen7YvYnkLF9Fo",
  overseas: "https://chat.whatsapp.com/Ghr9XgXpncIIFYuWcs45oI",
  general: null as string | null,
  orientation: null as string | null,
};
export function consultationForCountry(country?: string) {
  if (!country) return consultationDestinations.general;
  return country === "PK"
    ? consultationDestinations.pakistan
    : consultationDestinations.overseas;
}

export function consultationForRegion(region: string) {
  return region === "PK"
    ? consultationDestinations.pakistan
    : region === "OVERSEAS"
      ? consultationDestinations.overseas
      : consultationDestinations.general;
}
