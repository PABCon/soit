"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { JobRow } from "@/components/JobRow";
import type { Job, Seniority, WorkModel } from "@/lib/types";
import type { FeaturedTechCount } from "@/lib/db/tech-tags";
import type { JobCategoryOption } from "@/lib/db/job-categories";

const JobMap = dynamic(() => import("@/components/JobMap").then((m) => m.JobMap), { ssr: false });

const PARAMS_EVENT = "soit:jobs-search-params-change";

// Deliberately NOT next/navigation's useSearchParams()/router.replace(): on
// a fully dynamic page (this one fetches fresh on every request, no static
// generation), Next's client router treats ANY searchParams-only
// navigation as needing a real RSC round trip to the server — confirmed via
// a network capture showing a ~650ms `GET /jobs?tech=...&_rsc=...` on
// every single chip click in production (never showed up locally, where
// that round trip is ~0ms to a same-machine dev server) — even though this
// component already has the full job list as a prop and does all its own
// filtering client-side. That round trip defeats the entire point of
// filtering client-side. Reading/writing the URL directly via the History
// API keeps it truly instant and still gives shareable/bookmarkable URLs;
// `replaceState` never fires `popstate` in the tab that called it, hence
// the custom event alongside it, same pattern Rail.tsx's collapse state
// already uses for the same reason.
let cachedSearch: string | undefined;
let cachedParams: URLSearchParams | undefined;
function getSnapshot(): URLSearchParams {
  const search = window.location.search;
  if (search !== cachedSearch) {
    cachedSearch = search;
    cachedParams = new URLSearchParams(search);
  }
  return cachedParams!;
}
// A stable, shared instance — returning a fresh `new URLSearchParams()`
// every call is exactly the anti-pattern useSyncExternalStore warns about
// ("The result of getServerSnapshot should be cached").
const EMPTY_PARAMS = new URLSearchParams();
function getServerSnapshot(): URLSearchParams {
  return EMPTY_PARAMS;
}
function subscribe(callback: () => void) {
  window.addEventListener(PARAMS_EVENT, callback);
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener(PARAMS_EVENT, callback);
    window.removeEventListener("popstate", callback);
  };
}
function useUrlSearchParams(): URLSearchParams {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
function writeUrlSearchParams(next: URLSearchParams) {
  const qs = next.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(PARAMS_EVENT));
}

const SENIORITIES: Seniority[] = ["junior", "mid", "senior", "lead"];
const AD_LANGUAGES: ("pt" | "en")[] = ["pt", "en"];
// "remote" gets its own quick toggle (below) — kept out of this panel so
// there's exactly one control that owns that dimension, not two that could
// disagree with each other.
const PANEL_WORK_MODELS: WorkModel[] = ["hybrid", "office"];
type Sort = "recent" | "oldest" | "salary";

/** Monthly-equivalent floor, so a day rate and a monthly salary sort comparably. */
function monthlyFloor(job: Job): number {
  switch (job.salaryPeriod) {
    case "hour":
      return job.salaryMin * 8 * 21;
    case "day":
      return job.salaryMin * 21;
    case "year":
      return Math.round(job.salaryMin / 12);
    default:
      return job.salaryMin;
  }
}

function parseList(sp: URLSearchParams, key: string): string[] {
  const v = sp.get(key);
  return v ? v.split(",").filter(Boolean) : [];
}

/**
 * The merged jobs landing page (§7.1, real-usage QA round 3 phase 4):
 * curated tech/category quick-filter row, a "more filters" panel for the
 * rest, sort + remote toggle + result count, and a split list/map view
 * that shares this exact same filtered set — replaces the old separate
 * /jobs (list + client-only chip filters) and /map (unfiltered list+map)
 * pages. Filter state lives in the URL (searchParams), not local useState,
 * so the map and list can share one source of truth and filtered views
 * are shareable/bookmarkable — the one thing the old client-state design
 * couldn't do. The full unfiltered list is still what's in the initial
 * server-rendered HTML (crawlable); this is a client-side refinement atop it,
 * same philosophy the old JobFeed already had, just URL-synced now.
 */
export function JobsExplorer({
  jobs: allJobs,
  featuredTech,
  categories,
  favoriteJobIds,
}: {
  jobs: Job[];
  featuredTech: FeaturedTechCount[];
  categories: JobCategoryOption[];
  /** null when the viewer isn't a candidate — hides the heart entirely
   *  rather than showing one that would fail on click. */
  favoriteJobIds?: string[] | null;
}) {
  const t = useTranslations("feed");
  const ta = useTranslations("adLanguage");
  const tjf = useTranslations("jobForm");
  const searchParams = useUrlSearchParams();

  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [mapVisible, setMapVisible] = useState(true);

  const tech = parseList(searchParams, "tech");
  const cat = parseList(searchParams, "cat");
  const seniority = parseList(searchParams, "seniority");
  const adLanguage = parseList(searchParams, "lang");
  const workModel = parseList(searchParams, "workModel");
  const remoteOnly = searchParams.get("remote") === "1";
  const minSalary = Number(searchParams.get("minSalary") ?? 0);
  const sort = (searchParams.get("sort") as Sort | null) ?? "recent";

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    writeUrlSearchParams(next);
  }

  function toggleListParam(key: string, list: string[], value: string) {
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    updateParams({ [key]: next.length ? next.join(",") : null });
  }

  function clearAll() {
    writeUrlSearchParams(new URLSearchParams());
  }

  const searchKey = searchParams.toString();

  const jobs = useMemo(() => {
    const filtered = allJobs.filter(
      (j) =>
        (tech.length === 0 || tech.some((x) => j.tech.includes(x))) &&
        (cat.length === 0 || (j.categorySlug !== null && cat.includes(j.categorySlug))) &&
        (seniority.length === 0 || seniority.includes(j.seniority)) &&
        (adLanguage.length === 0 || adLanguage.includes(j.language)) &&
        (workModel.length === 0 || workModel.includes(j.workModel)) &&
        (!remoteOnly || j.workModel === "remote") &&
        monthlyFloor(j) >= minSalary,
    );
    switch (sort) {
      case "oldest":
        return filtered.sort((a, b) => b.postedDaysAgo - a.postedDaysAgo);
      case "salary":
        return filtered.sort((a, b) => monthlyFloor(b) - monthlyFloor(a));
      default:
        return filtered.sort((a, b) => a.postedDaysAgo - b.postedDaysAgo);
    }
    // tech/cat/seniority/adLanguage/workModel/remoteOnly/minSalary/sort are
    // all derived fresh from searchParams every render — depending on
    // searchKey (its stable string form) covers all of them at once
    // instead of an array of .join()s the exhaustive-deps rule won't
    // accept as "simple expressions".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allJobs, searchKey]);

  const pinned = useMemo(() => jobs.filter((j) => j.lat !== null && j.lng !== null), [jobs]);

  const activeCount =
    tech.length +
    cat.length +
    seniority.length +
    adLanguage.length +
    workModel.length +
    (remoteOnly ? 1 : 0) +
    (minSalary ? 1 : 0);

  const chip = (on: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
      on
        ? "border-pine bg-pine text-white"
        : "border-line bg-white text-muted hover:border-muted hover:text-ink"
    }`;

  return (
    <>
      {/* Item 4 — one row, curated only: featured tech (20) + categories
       *  (14), never the full ~159-tag vocabulary companies pick from. */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {featuredTech.map((tag) => (
          <button
            key={tag.slug}
            type="button"
            onClick={() => toggleListParam("tech", tech, tag.label)}
            className={chip(tech.includes(tag.label))}
          >
            {tag.label}
          </button>
        ))}
        {featuredTech.length > 0 && categories.length > 0 && (
          <span className="mx-1 w-px shrink-0 bg-line" />
        )}
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => toggleListParam("cat", cat, c.slug)}
            className={chip(cat.includes(c.slug))}
          >
            {tjf(`categoryOption.${c.slug}`)}
          </button>
        ))}
      </div>

      {/* Item 5 — sort + remote toggle, plus the "more filters" panel
       *  toggle and the map show/hide toggle. */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value === "recent" ? null : e.target.value })}
          className="h-9 rounded-lg border border-line bg-white px-2 text-xs text-ink"
        >
          <option value="recent">{t("sortRecent")}</option>
          <option value="oldest">{t("sortOldest")}</option>
          <option value="salary">{t("sortSalary")}</option>
        </select>

        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={remoteOnly}
            onChange={(e) => updateParams({ remote: e.target.checked ? "1" : null })}
            className="h-4 w-4 accent-pine"
          />
          {t("remoteOnly")}
        </label>

        <button
          type="button"
          onClick={() => setShowMoreFilters((v) => !v)}
          className={chip(showMoreFilters)}
        >
          {t("moreFilters")}
        </button>

        <button
          type="button"
          onClick={() => setMapVisible((v) => !v)}
          className="ml-auto hidden h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-medium text-ink hover:border-muted lg:flex"
        >
          {mapVisible ? t("hideMap") : t("showMap")}
        </button>
      </div>

      {showMoreFilters && (
        <div className="mt-2 flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
          <div className="flex flex-wrap gap-1.5">
            {PANEL_WORK_MODELS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => toggleListParam("workModel", workModel, w)}
                className={chip(workModel.includes(w))}
              >
                {t(`workModel.${w}`)}
              </button>
            ))}
            <span className="mx-1 w-px shrink-0 bg-line" />
            {SENIORITIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleListParam("seniority", seniority, s)}
                className={chip(seniority.includes(s))}
              >
                {t(`seniority.${s}`)}
              </button>
            ))}
            <span className="mx-1 w-px shrink-0 bg-line" />
            {AD_LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => toggleListParam("lang", adLanguage, lang)}
                className={chip(adLanguage.includes(lang))}
              >
                {ta(lang)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            {t("minSalary")}
            <input
              type="range"
              min={0}
              max={6000}
              step={250}
              value={minSalary}
              onChange={(e) => updateParams({ minSalary: e.target.value === "0" ? null : e.target.value })}
              className="h-1 w-40 accent-pine"
            />
            <span className="w-20 font-semibold text-ink tabular-nums">
              {minSalary ? `€${minSalary.toLocaleString("pt-PT")}` : t("any")}
            </span>
          </label>
        </div>
      )}

      {/* Item 6 — count, on top of the list. */}
      <div className="mt-3 flex items-center gap-3">
        <p className="text-sm font-medium text-ink">{t("results", { count: jobs.length })}</p>
        {activeCount > 0 && (
          <button type="button" onClick={clearAll} className="text-xs font-medium text-pine underline underline-offset-2">
            {t("clear")}
          </button>
        )}
      </div>

      {/* Items 3, 12 — split view sharing this exact filtered set, so the
       *  map never goes stale/empty relative to the list. */}
      <div className={`mt-4 grid gap-6 ${mapVisible ? "lg:grid-cols-[1fr_1.1fr]" : ""}`}>
        <div className={mapVisible ? "order-2 lg:order-1" : ""}>
          {jobs.length > 0 ? (
            <ul className="border-t border-line">
              {jobs.map((job) => (
                <JobRow
                  key={job.slug}
                  job={job}
                  isFavorited={favoriteJobIds ? favoriteJobIds.includes(job.id) : undefined}
                />
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-line py-16 text-center">
              <p className="text-sm text-muted">{t("noMatches")}</p>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="mt-3 text-sm font-medium text-pine underline underline-offset-2"
                >
                  {t("clear")}
                </button>
              )}
            </div>
          )}
        </div>

        {mapVisible && (
          <div className="order-1 hidden h-[420px] overflow-hidden rounded-xl border border-line lg:sticky lg:top-20 lg:order-2 lg:block lg:h-[calc(100dvh-8rem)]">
            <JobMap jobs={pinned} />
          </div>
        )}
      </div>
    </>
  );
}
