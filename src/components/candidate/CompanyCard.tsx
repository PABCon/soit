import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export type CompanyCardData = {
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  industry: string | null;
  companySize: string | null;
  openJobsCount: number;
};

/** Renders the chat's `lookupCompany` tool result inline, real,
 *  already-public data (`getCompanyBySlug`), the same fields
 *  `/companies/[slug]` itself already shows. Links to the real page
 *  for anyone who wants the full profile. */
export function CompanyCard({ company }: { company: CompanyCardData }) {
  const t = useTranslations("assistant");

  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-white p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white">
        {company.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- same plain-img convention this project already uses for small logos/avatars
          <img src={company.logoUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs font-semibold text-muted">{company.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{company.name}</p>
        {(company.industry || company.companySize) && (
          <p className="truncate text-xs text-muted">{[company.industry, company.companySize].filter(Boolean).join(" · ")}</p>
        )}
        {company.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{company.description}</p>}
        <div className="mt-1.5 flex items-center gap-3 text-xs">
          <span className="font-medium text-pine">{t("openJobsCount", { count: company.openJobsCount })}</span>
          <Link href={`/companies/${company.slug}`} className="font-medium text-pine hover:underline">
            {t("viewCompanyProfile")}
          </Link>
        </div>
      </div>
    </div>
  );
}
