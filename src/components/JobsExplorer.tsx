"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { JobRow } from "@/components/JobRow";
import { Switch } from "@/components/Switch";
import { TechIcon } from "@/components/icons/tech-icons";
import { CategoryIcon } from "@/components/icons/category-icons";
import { useUrlSearchParams, writeUrlSearchParams, parseListParam } from "@/hooks/useUrlSearchParams";
import { haversineKm } from "@/lib/geo";
import type { Job, Seniority, WorkModel } from "@/lib/types";
import type { EmploymentType } from "@/components/Salary";
import type { FeaturedTechCount } from "@/lib/db/tech-tags";
import type { JobCategoryOption } from "@/lib/db/job-categories";
import type { LocationOption } from "@/lib/db/locations";
import type { SpokenLanguageOption } from "@/lib/db/spoken-languages";

const JobMap = dynamic(() => import("@/components/JobMap").then((m) => m.JobMap), { ssr: false });

const SENIORITIES: Seniority[] = ["junior", "mid", "senior", "lead"];
const AD_LANGUAGES: ("pt" | "en")[] = ["pt", "en"];
// "remote" gets its own quick toggle (below) — kept out of this panel so
// there's exactly one control that owns that dimension, not two that could
// disagree with each other.
const PANEL_WORK_MODELS: WorkModel[] = ["hybrid", "office"];
// "Contract type" (real-usage QA, filters-redesign item) — every
// EmploymentType value, this filter has no separate "quick toggle" the
// way remote-only does.
const EMPLOYMENT_TYPES: EmploymentType[] = ["permanent", "fixed_term", "contractor", "freelance", "internship"];
type Sort = "recent" | "oldest" | "salary";

/** Monthly-equivalent floor, so a day rate and a monthly salary sort
 *  comparably — null when the employer has hidden the salary (§pricing),
 *  which a minSalary filter must never use to silently exclude the job. */
function monthlyFloor(job: Job): number | null {
  if (job.salaryMin == null) return null;
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

/** One circular icon chip for the curated tech/category filter row (§7.1,
 *  real-usage QA — replaces the old scrollable pill-list row entirely; this
 *  one wraps onto as many rows as it needs and never scrolls). */
function CircleChip({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} title={label} className="flex w-16 flex-col items-center gap-1">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-white transition-colors ${
          active ? "border-pine bg-pine/10" : "border-line hover:border-muted"
        }`}
      >
        {children}
      </span>
      <span className={`w-full truncate text-center text-[11px] ${active ? "font-semibold text-pine" : "text-muted"}`}>
        {label}
      </span>
    </button>
  );
}

const CROSS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/**
 * The merged jobs landing page (§7.1, real-usage QA round 3 phase 4, then
 * substantially reworked per a follow-up UX round): curated circular tech/
 * category filter chips, sort + remote toggle + result count on one row
 * above the list, a "more filters" left-side panel that swaps places with
 * the map, and a split list/map view that shares this exact same filtered
 * set. Filter state lives in the URL (searchParams), not local useState, so
 * the map and list can share one source of truth and filtered views are
 * shareable/bookmarkable.
 */
export function JobsExplorer({
  jobs: allJobs,
  featuredTech,
  categories,
  locations,
  spokenLanguages,
  favoriteJobIds,
}: {
  jobs: Job[];
  featuredTech: FeaturedTechCount[];
  categories: JobCategoryOption[];
  locations: LocationOption[];
  spokenLanguages: SpokenLanguageOption[];
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
  const employmentType = parseListParam(searchParams, "empType");
  const reqLanguage = parseListParam(searchParams, "reqLang");
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

  /** Opening the panel hides the map to make room for it; closing it
   *  restores the map — the exact interaction a real-usage report asked
   *  for ("shows as a left side element and hides the map automatically,
   *  when closed the map pops up again"). */
  function toggleMoreFilters() {
    setShowMoreFilters((prev) => {
      const next = !prev;
      setMapVisible(!next);
      return next;
    });
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
        (employmentType.length === 0 || j.employmentTypes.some((et) => employmentType.includes(et))) &&
        (reqLanguage.length === 0 || reqLanguage.some((l) => j.requiredLanguageSlugs.includes(l))) &&
        (!remoteOnly || j.workModel === "remote") &&
        (monthlyFloor(j) === null || monthlyFloor(j)! >= minSalary) &&
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
        // Hidden-salary jobs sort last regardless of direction — there's
        // nothing to rank them by, and burying them silently among real
        // numbers would misrepresent what "sorted by salary" means.
        return filtered.sort((a, b) => (monthlyFloor(b) ?? -1) - (monthlyFloor(a) ?? -1));
      default:
        // No re-sort — allJobs already arrives ordered by the server's own
        // feed ranking (Top Employer first, then boost_rank_at desc);
        // re-deriving order from postedDaysAgo would flatten same-day
        // bumps and Top-Employer placement back to plain chronological
        // order.
        return filtered;
    }
    // tech/cat/seniority/adLanguage/workModel/remoteOnly/minSalary/sort are
    // all derived fresh from searchParams every render — depending on
    // searchKey (its stable string form) covers all of them at once
    // instead of an array of .join()s the exhaustive-deps rule won't
    // accept as "simple expressions".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allJobs, searchKey]);

  const pinned = useMemo(() => jobs.filter((j) => j.lat !== null && j.lng !== null), [jobs]);

  const panelActiveCount =
    workModel.length + seniority.length + adLanguage.length + employmentType.length + reqLanguage.length + (minSalary ? 1 : 0);
  const activeCount = tech.length + cat.length + panelActiveCount + (remoteOnly ? 1 : 0) + (q ? 1 : 0) + (near ? 1 : 0);

  const chip = (on: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
      on
        ? "border-pine bg-pine text-white"
        : "border-line bg-white text-muted hover:border-muted hover:text-ink"
    }`;

  return (
    <>
      {/* Item 5 — curated circular icon chips (real logos for tech, generic
       *  glyphs for categories), never the full ~159-tag vocabulary
       *  companies pick from. Wraps onto as many rows as it needs — no
       *  horizontal scroll. */}
      <div className="flex flex-wrap gap-x-3 gap-y-4">
        {featuredTech.map((tag) => (
          <CircleChip
            key={tag.slug}
            label={tag.label}
            active={tech.includes(tag.label)}
            onClick={() => toggleListParam("tech", tech, tag.label)}
          >
            <TechIcon slug={tag.slug} className="h-6 w-6" />
          </CircleChip>
        ))}
        {categories.map((c) => (
          <CircleChip
            key={c.id}
            label={tjf(`categoryOption.${c.slug}`)}
            active={cat.includes(c.slug)}
            onClick={() => toggleListParam("cat", cat, c.slug)}
          >
            <CategoryIcon slug={c.slug} className="h-5 w-5 text-ink" />
          </CircleChip>
        ))}
      </div>

      {/* Item 8 — count, sort and the remote toggle all on one row, above
       *  the list. "More filters" opens a left-side panel (below) instead
       *  of pushing content down inline. */}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <p className="text-sm font-medium text-ink">{t("results", { count: jobs.length })}</p>

        <select
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value === "recent" ? null : e.target.value })}
          className="h-9 rounded-lg border border-line bg-white px-2 text-xs text-ink"
        >
          <option value="recent">{t("sortRecent")}</option>
          <option value="oldest">{t("sortOldest")}</option>
          <option value="salary">{t("sortSalary")}</option>
        </select>

        <Switch
          checked={remoteOnly}
          onChange={(v) => updateParams({ remote: v ? "1" : null })}
          label={t("remoteOnly")}
        />

        <button type="button" onClick={toggleMoreFilters} className={chip(showMoreFilters)}>
          {t("moreFilters")}
          {panelActiveCount > 0 ? ` (${panelActiveCount})` : ""}
        </button>

        {activeCount > 0 && (
          <button type="button" onClick={clearAll} className="text-xs font-medium text-pine underline underline-offset-2">
            {t("clear")}
          </button>
        )}
      </div>

      {/* The search bar lives in TopNav, but its terms (q/near/radiusKm)
       *  are just more URL params this component already reads, so they
       *  show here alongside every other active filter. */}
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

      <div className="mt-4 flex items-start gap-6">
        {showMoreFilters && (
          <aside className="w-full shrink-0 space-y-4 rounded-xl border border-line bg-white p-4 sm:w-64">
            <div>
              <p className="text-xs font-semibold text-muted uppercase">{t("filterSectionWorkModel")}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
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
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted uppercase">{t("filterSectionSeniority")}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
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
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted uppercase">{t("filterSectionEmploymentType")}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {EMPLOYMENT_TYPES.map((et) => (
                  <button
                    key={et}
                    type="button"
                    onClick={() => toggleListParam("empType", employmentType, et)}
                    className={chip(employmentType.includes(et))}
                  >
                    {tjf(`employmentTypeOption.${et}`)}
                  </button>
                ))}
              </div>
            </div>

            {spokenLanguages.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted uppercase">{t("filterSectionRequiredLanguage")}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {spokenLanguages.map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => toggleListParam("reqLang", reqLanguage, lang.slug)}
                      className={chip(reqLanguage.includes(lang.slug))}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-muted uppercase">{t("filterSectionAdLanguage")}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
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
            </div>

            <label className="flex flex-col gap-2 text-xs text-muted">
              <span className="font-semibold text-muted uppercase">{t("minSalary")}</span>
              <span className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={6000}
                  step={250}
                  value={minSalary}
                  onChange={(e) => updateParams({ minSalary: e.target.value === "0" ? null : e.target.value })}
                  className="h-1 flex-1 accent-pine"
                />
                <span className="w-20 shrink-0 font-semibold text-ink tabular-nums">
                  {minSalary ? `€${minSalary.toLocaleString("pt-PT")}` : t("any")}
                </span>
              </span>
            </label>
          </aside>
        )}

        {/* Items 3, 12 — split view sharing this exact filtered set, so the
         *  map never goes stale/empty relative to the list. */}
        <div className={`grid min-w-0 flex-1 gap-6 ${mapVisible ? "lg:grid-cols-[1fr_1.1fr]" : ""}`}>
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
            <div className="relative order-1 hidden h-[420px] overflow-hidden rounded-xl border border-line lg:sticky lg:top-20 lg:order-2 lg:block lg:h-[calc(100dvh-8rem)]">
              <button
                type="button"
                onClick={() => setMapVisible(false)}
                title={t("hideMap")}
                // Leaflet's own zoom control sits at the same top-left
                // corner with z-index 1000 — this has to clear that or a
                // click here just hits "+" instead.
                className="absolute top-2 left-2 z-[1100] flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-sm hover:text-pine"
              >
                {CROSS_ICON}
                <span className="sr-only">{t("hideMap")}</span>
              </button>
              <JobMap jobs={pinned} />
            </div>
          )}
        </div>
      </div>

      {/* Item 3 — reopening the map is a floating right-edge tab, mirroring
       *  Rail's own left-edge collapsed tab. */}
      {!mapVisible && (
        <button
          type="button"
          onClick={() => setMapVisible(true)}
          title={t("showMap")}
          className="fixed top-1/2 right-0 z-20 hidden -translate-y-1/2 items-center gap-1.5 rounded-l-lg border border-r-0 border-line bg-white px-1.5 py-3 text-muted shadow-sm transition-colors hover:text-pine lg:flex"
        >
          <span className="text-xs font-medium tracking-wide" style={{ writingMode: "vertical-rl" }}>
            {t("showMap")}
          </span>
        </button>
      )}
    </>
  );
}
