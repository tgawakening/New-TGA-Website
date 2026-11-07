import { countries } from "countries-list";
export const RESIDENCE_KEY = "tga-sirah-residence-v1";
export function validResidence(value: unknown): value is string {
  return typeof value === "string" && Object.hasOwn(countries, value);
}
export function resolveResidence(
  current?: string | null,
  saved?: string | null,
  detected?: string | null,
) {
  return [current, saved, detected].find(validResidence) || "PK";
}
