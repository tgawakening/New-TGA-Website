import { redirect } from "next/navigation";
import { countries } from "countries-list";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { catalogue, formatSirahMoney, priceFor } from "@/lib/sirah/catalog";
import { SirahAdminCustomLink } from "@/components/sirah/admin-custom-link";

export default async function SirahCustomLinkPage() {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin");
  if (!access.canManageEnrolments) redirect("/admin/sirah");
  const countryOptions = Object.entries(countries)
    .map(([code, value]) => {
      const catalog = priceFor(code, "ANNUAL", "STRIPE");
      return {
        code,
        name: value.name,
        currency: catalog.currency,
        catalogAnnual: formatSirahMoney(catalog.amountMinor, catalog.currency),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const currencies = [...new Set(catalogue.map((row) => row[2]))].sort();
  return (
    <main className="ga-admin-page">
      <section className="ga-admin-page-section">
        <div className="ga-admin-container">
          <SirahAdminCustomLink
            readOnly={access.readOnly}
            canApproveScholarships={access.canApproveScholarships}
            canCreateDiscountCodes={access.canCreateDiscountCodes}
            countries={countryOptions}
            currencies={currencies}
          />
        </div>
      </section>
    </main>
  );
}
