"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { JobRow } from "@/components/JobRow";
import { useUrlSearchParams, writeUrlSearchParams, parseListParam } from "@/hooks/useUrlSearchParams";
import type { Job, Seniority, WorkModel } from "@/lib/types";
import type { FeaturedTechCount } from "@/lib/db/tech-tags";
import type { JobCategoryOption } from "@/lib/db/job-categories";
import type { LocationOption } from "@/lib/db/locations";

const JobMap = dynamic(() => import("@/components/JobMap").then((m) => m.JobMap), { ssr: false });

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance — the "near X within Y km" search (item 8) reuses
 *  the same 14 curated locations already seeded with fixed coordinates
 *  (`getLocations()`), computed here over the already-fetched job list.
 *  No geocoding provider, no new Postgres RPC: the dataset is small and
 *  every job's own lat/lng is already a prop, so this is just another pure
 *  client-side filter, same as monthlyFloor() below. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  locations,
  favoriteJobIds,
}: {
  jobs: Job[];
  featuredTech: FeaturedTechCount[];
  categories: JobCategoryOption[];
  locations: LocationOption[];
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

  const tech = parseListParam(searchParams, "tech");
  const cat = parseListParam(searchParams, "cat");
  const seniority = parseListParam(searchParams, "seniority");
  const adLanguage = parseListParam(searchParams, "lang");
  const workModel = parseListParam(searchParams, "workModel");
  const remoteOnly = searchParams.get("remote") === "1";
  const minSalary = Number(searchParams.get("minSalary") ?? 0);
  const sort = (searchParams.get("sort") as Sort | null) ?? "recent";
  const q = searchParams.get("q") ?? "";
  const near = searchParams.get("near") ?? "";
  const radiusKm = Number(searchParams.get("radiusKm") ?? 0);
  const nearLocation = near ? (locations.find((l) => l.slug === near) ?? null) : null;

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
    const query = q.trim().toLowerCase();
    const filtered = allJobs.filter(
      (j) =>
        (tech.length === 0 || tech.some((x) => j.tech.includes(x))) &&
        (cat.length === 0 || (j.categorySlug !== null && cat.includes(j.categorySlug))) &&
        (seniority.length === 0 || seniority.includes(j.seniority)) &&
        (adLanguage.length === 0 || adLanguage.includes(j.language)) &&
        (workModel.length === 0 || workModel.includes(j.workModel)) &&
        (!remoteOnly || j.workModel === "remote") &&
        monthlyFloor(j) >= minSalary &&
        (!query || j.title.toLowerCase().includes(query)) &&
        (!nearLocation ||
          radiusKm <= 0 ||
          (j.lat !== null &&
            j.lng !== null &&
            haversineKm(nearLocation.latitude, nearLocation.longitude, j.lat, j.lng) <= radiusKm)),
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
    (minSalary ? 1 : 0) +
    (q ? 1 : 0) +
    (near ? 1 : 0);

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

      {/* Item 8 — the search bar lives in TopNav, but its terms (q/near/
       *  radiusKm) are just more URL params this component already reads,
       *  so they show here alongside every other active filter. */}
      {(q || nearLocation) && (
        <p className="mt-3 text-sm text-muted">
          {q && (
            <>
              {t("searchingFor")} <span className="font-medium text-ink">&ldquo;{q}&rdquo;</span>
            </>
          )}
          {q && nearLocation && " · "}
          {nearLocation && (
            <>
              {t("searchNear", { place: nearLocation.name })}
              {radiusKm > 0 && ` (${radiusKm} km)`}
            </>
          )}
        </p>
      )}

      {/* Item 6 — count, on top of the list. */}
      <div className="mt-1 flex items-center gap-3">
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
