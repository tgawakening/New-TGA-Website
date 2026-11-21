import { redirect } from "next/navigation";
import { countries } from "countries-list";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { catalogue, formatSirahMoney, priceFor } from "@/lib/sirah/catalog";
import { SirahAdminCustomLink } from "@/components/sirah/admin-custom-link";

const text = (value: string | string[] | undefined, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export default async function SirahCustomLinkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  if (!access.canManageEnrolments) redirect("/admin/sirah");
  const countryOptions = Object.entries(countries)
    .map(([code, value]) => {
      const catalog = priceFor(code, "ANNUAL", "STRIPE");
      const monthly = priceFor(code, "MONTHLY", "STRIPE");
      return {
        code,
        name: value.name,
        currency: catalog.currency,
        catalogAnnual: formatSirahMoney(catalog.amountMinor, catalog.currency),
        catalogMonthly: formatSirahMoney(monthly.amountMinor, monthly.currency),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const currencies = [...new Set(catalogue.map((row) => row[2]))].sort();
  // Optional prefill (the scholarship queue's "Issue card payment link"). It
  // only fills the form in: staff still review and confirm before a link exists.
  const q = await searchParams;
  const country = text(q.country, 2).toUpperCase();
  const currency = text(q.currency, 3).toUpperCase();
  const amount = text(q.amount, 20);
  const prefill = {
    fullName: text(q.fullName, 120),
    email: text(q.email, 254),
    country: countryOptions.some((option) => option.code === country) ? country : "",
    currency: (currencies as string[]).includes(currency) ? currency : "",
    amount: /^\d+(\.\d{1,3})?$/.test(amount) ? amount : "",
    plan: q.plan === "MONTHLY" ? ("MONTHLY" as const) : ("ANNUAL" as const),
    sponsorLabel: text(q.sponsorLabel, 120),
    note: text(q.note, 1000),
  };
  return <SirahAdminCustomLink countries={countryOptions} currencies={currencies} prefill={prefill} />;
}
