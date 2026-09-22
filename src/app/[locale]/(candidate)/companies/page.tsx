import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getVerifiedCompanies } from "@/lib/db/companies";
import { CompanyLogo } from "@/components/CompanyLogo";

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
  const tc = await getTranslations({ locale, namespace: "company" });

  const companies = await getVerifiedCompanies();

  return (
    <>
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {companies.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/companies/${c.slug}`}
                className="flex h-full flex-col gap-3 rounded-xl border border-line bg-white p-4 transition-colors hover:border-pine"
              >
                <div className="flex items-center gap-3">
                  <CompanyLogo company={c} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold text-ink">{c.name}</p>
                    <p className="truncate text-xs text-muted">
                      {[c.industry, c.companyType].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between text-xs text-muted">
                  <span>{tc("openJobs", { count: c.activeJobsCount })}</span>
                  {c.primaryLocation && <span className="truncate">{c.primaryLocation}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
