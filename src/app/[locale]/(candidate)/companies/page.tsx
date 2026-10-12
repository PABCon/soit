import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getVerifiedCompanies } from "@/lib/db/companies";
import { getLocations } from "@/lib/db/locations";
import { CompaniesExplorer } from "@/components/CompaniesExplorer";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "companies" });
  return { title: t("title") };
}

/** Public, indexable index of every verified company (§7.1) — the "Empresas"
 *  rail link's destination, modelled after justjoin.it/brands. */
export default async function CompaniesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "companies" });

  const [companies, locations] = await Promise.all([getVerifiedCompanies(), getLocations()]);

  return (
    <>
      <h1 className="text-3xl font-bold lg:text-4xl">{t("title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("subtitle")}</p>

      <CompaniesExplorer companies={companies} locations={locations} />
    </>
  );
}
