"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, ChevronDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ConsoleJobRow } from "@/components/console/ConsoleJobRow";
import type { ConsoleJob, ConsoleTab, JobTabCounts } from "@/lib/db/jobs";

type Sort = "newest" | "oldest" | "applicants";

const TABS: { key: ConsoleTab; labelKey: string }[] = [
  { key: "active", labelKey: "tabActive" },
  { key: "inactive", labelKey: "tabInactive" },
  { key: "drafts", labelKey: "tabDrafts" },
];

/** Round 22 restyle: the search/location/sort toolbar is genuinely new
 *  (the page never had one) — client-side filter/sort over the
 *  already-server-fetched `jobs` prop, same pattern `JobsExplorer`/
 *  `CompaniesExplorer` already established, no new DB query. Tabs
 *  themselves stay real server-side navigations (each tab is a
 *  different DB filter), unchanged from before this round. */
export function ConsoleJobsExplorer({
  jobs,
  tab,
  tabCounts,
}: {
  jobs: ConsoleJob[];
  tab: ConsoleTab;
  tabCounts: JobTabCounts;
}) {
  const t = useTranslations("console");

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  const locations = useMemo(
    () => [...new Set(jobs.map((j) => j.location).filter((l): l is string => Boolean(l)))].sort(),
    [jobs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = jobs.filter((j) => {
      if (q && !j.title.toLowerCase().includes(q)) return false;
      if (location && j.location !== location) return false;
      return true;
    });
    result.sort((a, b) => {
      if (sort === "applicants") return b.applicantCount - a.applicantCount;
      if (sort === "oldest") return a.postedDaysAgo - b.postedDaysAgo;
      return b.postedDaysAgo - a.postedDaysAgo;
    });
    return result;
  }, [jobs, query, location, sort]);

  return (
    <>
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(({ key, labelKey }) => (
          <Link
            key={key}
            href={{ pathname: "/recruit", query: key === "active" ? {} : { tab: key } }}
            className={
              tab === key
                ? "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-pine px-3 py-2 text-sm font-medium whitespace-nowrap text-ink"
                : "flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap text-muted"
            }
          >
            {t(labelKey)}
            <span className={tab === key ? "text-xs text-pine" : "text-xs text-muted"}>{tabCounts[key]}</span>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchJobAdsPlaceholder")}
            className="h-11 w-full min-w-0 rounded-lg border border-line bg-white pr-4 pl-9 text-sm placeholder:text-muted"
          />
        </div>

        <span className="relative inline-flex h-11 shrink-0 items-center">
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="h-11 shrink-0 appearance-none rounded-lg border border-line bg-white py-0 pr-8 pl-3 text-sm text-ink"
          >
            <option value="">{t("allLocations")}</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        </span>

        <span className="relative inline-flex h-11 shrink-0 items-center">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-11 shrink-0 appearance-none rounded-lg border border-line bg-white py-0 pr-8 pl-3 text-sm font-medium text-ink"
          >
            <option value="newest">
              {t("sortByLabel")}: {t("sortNewest")}
            </option>
            <option value="oldest">
              {t("sortByLabel")}: {t("sortOldest")}
            </option>
            <option value="applicants">
              {t("sortByLabel")}: {t("sortMostApplicants")}
            </option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        </span>
      </div>

      {jobs.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("empty")}</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("noSearchResults")}</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">{t("showingJobCount", { count: filtered.length })}</p>
          <ul className="mt-3 flex flex-col gap-3">
            {filtered.map((job) => (
              <ConsoleJobRow key={job.id} job={job} tab={tab} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
