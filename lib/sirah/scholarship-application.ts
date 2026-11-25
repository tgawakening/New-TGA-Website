import { z } from "zod";
import { countries } from "countries-list";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { catalogue, decimalToMinor } from "./catalog";

export const SCHOLARSHIP_ORDER_VERSION = "scholarship-application-v1";
export const scholarshipCurrencies = [...new Set(catalogue.map((row) => row[2]))].sort();
export const scholarshipApplicationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(32).refine((s) => s.startsWith("+") && !!parsePhoneNumberFromString(s)?.isValid(), "Enter a valid international phone number starting with +."),
  countryCode: z.string().length(2).refine((code) => code in countries),
  arrangementType: z.enum(["FULL", "PARTIAL", "PLAN"]),
  currency: z.string().refine((v) => (scholarshipCurrencies as string[]).includes(v)),
  requestedAmount: z.string().trim().max(20).optional(),
  reason: z.string().trim().min(10).max(3000),
}).strict().superRefine((data, ctx) => {
  if (data.arrangementType === "PARTIAL" || (data.requestedAmount && data.arrangementType === "PLAN")) {
    try { const amount = decimalToMinor(data.requestedAmount || "", data.currency); if (amount <= 0 || amount > 2147483647) throw Error(); }
    catch { ctx.addIssue({ code: "custom", path: ["requestedAmount"], message: "Enter a valid amount in the selected currency." }); }
  }
});
export function approvedMoney(value: string, currency: string, allowZero: boolean) {
  const amount = decimalToMinor(value, currency);
  if ((!allowZero && amount <= 0) || amount > 2147483647) throw Error("Enter a valid agreed amount.");
  return amount;
}
