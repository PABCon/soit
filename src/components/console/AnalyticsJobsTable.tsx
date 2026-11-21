"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { JobAnalyticsRow } from "@/lib/db/job-analytics";

type Row = JobAnalyticsRow & { conversion: number | null };

type SortKey = "jobTitle" | "views" | "applyClicks" | "applications" | "conversion";
type SortDirection = "asc" | "desc";

const COLUMNS: { key: SortKey; labelKey: string; defaultDirection: SortDirection }[] = [
  { key: "jobTitle", labelKey: "columnJob", defaultDirection: "asc" },
  { key: "views", labelKey: "columnViews", defaultDirection: "desc" },
  { key: "applyClicks", labelKey: "columnApplyClicks", defaultDirection: "desc" },
  { key: "applications", labelKey: "columnApplications", defaultDirection: "desc" },
  { key: "conversion", labelKey: "columnConversion", defaultDirection: "desc" },
];

/** Click-to-sort column headers: the first click on a column sorts by
 *  that column in its own natural "most interesting first" direction
 *  (descending for every number column, ascending for the job title),
 *  a second click on the same column flips it, and clicking a different
 *  column starts over at that column's own default direction, rather
 *  than always defaulting to ascending, which would mean clicking
 *  "Views" once shows the lowest-performing jobs first. `null`
 *  conversion (jobs with zero views) always sorts to the bottom,
 *  regardless of direction, since there's no real rate to compare. */
export function AnalyticsJobsTable({ jobs }: { jobs: JobAnalyticsRow[] }) {
  const t = useTranslations("analytics");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const rows: Row[] = useMemo(
    () =>
      jobs.map((job) => ({
        ...job,
        conversion: job.views > 0 ? Math.round((job.applications / job.views) * 1000) / 10 : null,
      })),
    [jobs],
  );

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const withIndex = rows.map((row, index) => ({ row, index }));
    withIndex.sort((a, b) => {
      const av = a.row[sortKey];
      const bv = b.row[sortKey];
      if (av == null && bv == null) return a.index - b.index;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (typeof av === "string" && typeof bv === "string") {
        cmp = av.localeCompare(bv);
      } else {
        cmp = (av as number) - (bv as number);
      }
      if (cmp === 0) return a.index - b.index;
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return withIndex.map((w) => w.row);
  }, [rows, sortKey, sortDirection]);

  function handleSort(column: (typeof COLUMNS)[number]) {
    if (sortKey === column.key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column.key);
      setSortDirection(column.defaultDirection);
    }
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-muted uppercase">
          {COLUMNS.map((column) => {
            const active = sortKey === column.key;
            return (
              <th key={column.key} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort(column)}
                  className={`flex items-center gap-1 ${active ? "text-ink" : "hover:text-ink"}`}
                >
                  {t(column.labelKey)}
                  {active ? (
                    sortDirection === "asc" ? (
                      <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    )
                  ) : (
                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                  )}
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((job) => (
          <tr key={job.jobId} className="border-b border-line last:border-0">
            <td className="max-w-xs truncate px-4 py-3 font-medium text-ink">{job.jobTitle}</td>
            <td className="px-4 py-3 text-ink">{job.views}</td>
            <td className="px-4 py-3 text-ink">{job.applyClicks}</td>
            <td className="px-4 py-3 text-ink">{job.applications}</td>
            <td className="px-4 py-3 text-ink">{job.conversion != null ? `${job.conversion}%` : t("noData")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
