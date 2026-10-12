"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Briefcase, Building2, ChevronDown, MapPin, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CompanyLogo } from "@/components/CompanyLogo";
import { buttonClassName } from "@/components/Button";
import type { CompanyListItem } from "@/lib/db/companies";
import type { LocationOption } from "@/lib/db/locations";

type Sort = "jobs" | "name";

/** Client-side filter/sort over an already-fetched list — same pattern
 *  `JobsExplorer` already established for a small, fully-loaded dataset;
 *  no new DB round trip needed for filtering/sorting a few dozen companies. */
export function CompaniesExplorer({
  companies,
  locations,
}: {
  companies: CompanyListItem[];
  locations: LocationOption[];
}) {
  const t = useTranslations("companies");
  const tc = useTranslations("company");
  const tn = useTranslations("nav");

  const [query, setQuery] = useState("");
  const [locationSlug, setLocationSlug] = useState("");
  const [sort, setSort] = useState<Sort>("jobs");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = companies.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (locationSlug && c.locationSlug !== locationSlug) return false;
      return true;
    });
    result.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : b.activeJobsCount - a.activeJobsCount || a.name.localeCompare(b.name),
    );
    return result;
  }, [companies, query, locationSlug, sort]);

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-11 w-full min-w-0 rounded-lg border border-line bg-white pr-4 pl-9 text-sm placeholder:text-muted"
          />
        </div>

        <span className="relative inline-flex h-11 shrink-0 items-center">
          <select
            value={locationSlug}
            onChange={(e) => setLocationSlug(e.target.value)}
            className="h-11 shrink-0 appearance-none rounded-lg border border-line bg-white py-0 pr-8 pl-3 text-sm text-ink"
          >
            <option value="">{tn("searchAnywhere")}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.slug}>
                {l.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        </span>

        <span className="relative inline-flex h-11 shrink-0 items-center rounded-lg border border-line bg-white px-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-11 shrink-0 appearance-none bg-transparent pr-6 text-sm font-medium text-ink focus:outline-none"
          >
            <option value="jobs">
              {t("sortByLabel")}: {t("sortMostJobs")}
            </option>
            <option value="name">
              {t("sortByLabel")}: {t("sortNameAsc")}
            </option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{query || locationSlug ? t("noResults") : t("empty")}</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/companies/${c.slug}`}
                className="flex h-full flex-col gap-3 rounded-xl border border-line bg-white p-5 transition-colors hover:border-pine"
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

                <div className="flex flex-wrap items-center gap-2">
                  {c.primaryLocation && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="truncate">{c.primaryLocation}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-pine/10 px-2.5 py-1 text-xs font-medium text-pine">
                    <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
                    {tc("openJobs", { count: c.activeJobsCount })}
                  </span>
                </div>

                <div className="mt-auto border-t border-line pt-3 text-sm font-medium text-pine">
                  {t("viewCompany")} →
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-line bg-white p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pine/10 text-pine">
          <Building2 className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="font-display font-semibold text-ink">{t("cantFindHeadline")}</p>
          <p className="mt-1 text-sm text-muted">{t("cantFindSubtext")}</p>
        </div>
        <Link href="/employer/register" className={buttonClassName({ className: "mt-2" })}>
          {t("addYourCompany")} →
        </Link>
      </div>
    </>
  );
}
