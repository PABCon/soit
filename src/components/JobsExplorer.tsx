"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { JobRow } from "@/components/JobRow";
import { Switch } from "@/components/Switch";
import { Button } from "@/components/Button";
import { TechIcon } from "@/components/icons/tech-icons";
import { CategoryIcon } from "@/components/icons/category-icons";
import { useUrlSearchParams, writeUrlSearchParams, parseListParam } from "@/hooks/useUrlSearchParams";
import { haversineKm } from "@/lib/geo";
import type { Job, Seniority, WorkModel } from "@/lib/types";
import type { EmploymentType } from "@/components/Salary";
import type { LocationOption } from "@/lib/db/locations";
import type { SpokenLanguageOption } from "@/lib/db/spoken-languages";

/** The quick-filter row's merged, ranked data shape (round-5 feedback —
 *  replaces a curated ~20-tag subset with the full tech-tag vocabulary
 *  merged with every category, ranked purely by live job count, assembled
 *  once server-side in jobs/page.tsx from the same job list this
 *  component already receives). `label` is the raw tech-tag label for a
 *  tech entry (already display-ready, untranslated by design — tech names
 *  aren't translatable); for a category entry it's the raw DB label,
 *  unused for display since the category name is translated client-side
 *  by slug, same as before. */
export type QuickFilterOption =
  | { kind: "tech"; slug: string; label: string; count: number }
  | { kind: "category"; slug: string; label: string; count: number };

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

const CHIP_WIDTH = 72;
const CHIP_GAP = 12; // gap-x-3
// Round-7 fix: the count badge overflows ~6px past the chip's own right
// edge (`-right-1` on a 16px badge) — reserving this much slack in the
// fitted-count arithmetic keeps the last chip's badge from landing right
// at (or past) the row's own boundary.
const BADGE_SLACK = 8;

/** One circular icon chip for the tech/category filter row (round-6 —
 *  a real live job-count badge, per the reference screenshot, at the
 *  icon's corner). */
function CircleChip({
  active,
  onClick,
  label,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    // 40px icon container, 1px neutral border, subtle blue-tinted hover.
    // `shrink-0` — a fixed-width item (round-6: now in a true single-row,
    // no-wrap, no-scroll layout — see the measured-count row below).
    <button type="button" onClick={onClick} title={label} className="flex w-[72px] shrink-0 flex-col items-center gap-1">
      <span className="relative h-10 w-10">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full border bg-white transition-colors ${
            active ? "border-pine bg-pine/10" : "border-line hover:border-pine/40 hover:bg-subtle"
          }`}
        >
          {children}
        </span>
        {count !== undefined && (
          // Round-7 fix: this badge was getting clipped — the row's own
          // `overflow-hidden` (needed for the no-wrap safety net) was
          // also clipping vertical overflow, since Tailwind's
          // `overflow-hidden` clips both axes. The row now uses
          // `overflow-x-hidden` instead (horizontal-only) plus a bit of
          // top padding, so this badge's `-top-1`/`-right-1` overflow has
          // real room.
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-pine px-1 text-[9px] font-semibold text-white">
            {count > 999 ? "999+" : count}
          </span>
        )}
      </span>
      <span className={`line-clamp-2 w-full text-center text-xs leading-[14px] ${active ? "font-semibold text-pine" : "text-muted"}`}>
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
  quickFilters,
  locations,
  spokenLanguages,
  favoriteJobIds,
}: {
  jobs: Job[];
  quickFilters: QuickFilterOption[];
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

  // Round-6 feedback: the row must be a genuine single row, never wrap —
  // `flex-wrap` was exactly the mistake. `flex-nowrap` on the container
  // makes wrapping structurally impossible regardless of timing; this
  // measures the container's actual width (ResizeObserver, re-fires on
  // resize) and renders only as many ranked chips as fit. Every chip has
  // an identical 72px width, so arithmetic against that known width is
  // equivalent to measuring each one individually.
  const quickFilterRowRef = useRef<HTMLDivElement>(null);
  const [visibleQuickFilterCount, setVisibleQuickFilterCount] = useState(quickFilters.length);

  useEffect(() => {
    const el = quickFilterRowRef.current;
    if (!el) return;
    function recompute() {
      const perChip = CHIP_WIDTH + CHIP_GAP;
      const count = Math.max(0, Math.floor((el!.clientWidth - BADGE_SLACK + CHIP_GAP) / perChip));
      setVisibleQuickFilterCount(count);
    }
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // Design-system reference image's "Filter Chip (active)" swatch — a
  // pale-blue-fill/blue-border chip with its own "×" to remove just that
  // one filter — shown explicitly in the full mockup's toolbar row
  // ("Lisboa ×  Senior ×  Permanent ×"). Backed entirely by filter
  // dimensions and removal logic that already exist (toggleListParam/
  // updateParams); remote stays excluded since the Switch above it is
  // already that dimension's one control.
  const activeFilterChips: { key: string; label: string; onRemove: () => void }[] = [
    ...tech.map((v) => ({ key: `tech-${v}`, label: v, onRemove: () => toggleListParam("tech", tech, v) })),
    ...cat.map((v) => ({
      key: `cat-${v}`,
      label: tjf(`categoryOption.${v}`),
      onRemove: () => toggleListParam("cat", cat, v),
    })),
    ...seniority.map((v) => ({
      key: `seniority-${v}`,
      label: t(`seniority.${v}`),
      onRemove: () => toggleListParam("seniority", seniority, v),
    })),
    ...workModel.map((v) => ({
      key: `workModel-${v}`,
      label: t(`workModel.${v}`),
      onRemove: () => toggleListParam("workModel", workModel, v),
    })),
    ...employmentType.map((v) => ({
      key: `empType-${v}`,
      label: tjf(`employmentTypeOption.${v}`),
      onRemove: () => toggleListParam("empType", employmentType, v),
    })),
    ...reqLanguage.map((v) => ({
      key: `reqLang-${v}`,
      label: spokenLanguages.find((l) => l.slug === v)?.label ?? v,
      onRemove: () => toggleListParam("reqLang", reqLanguage, v),
    })),
    ...adLanguage.map((v) => ({ key: `lang-${v}`, label: ta(v), onRemove: () => toggleListParam("lang", adLanguage, v) })),
    ...(minSalary > 0
      ? [{ key: "minSalary", label: `€${minSalary.toLocaleString("pt-PT")}+`, onRemove: () => updateParams({ minSalary: null }) }]
      : []),
    ...(nearLocation
      ? [{ key: "near", label: nearLocation.name, onRemove: () => updateParams({ near: null, radiusKm: null }) }]
      : []),
    ...(q ? [{ key: "q", label: `"${q}"`, onRemove: () => updateParams({ q: null }) }] : []),
  ];

  // Filter-label typography: 13px/18px, medium-to-semibold weight. 8px
  // radius (rectangular, not a pill) — the corrective brief explicitly
  // calls out "too many pills" as part of the generic feel; these toggle
  // chips are the one pill-shaped element that had no real reason to stay
  // round (unlike the circular icon selector or a true status badge).
  //
  // Round-7 consistency audit: the active-state recipe was solid-pine-
  // fill/white-text — but the reference's own "Filter Chip (active)"
  // swatch (confirmed via a zoomed crop) is a *pale* blue tint with a
  // pine border and pine text — the exact same recipe the toolbar's
  // removable active-filter chips already use correctly. Fixed to match;
  // the default/inactive state's text also moved from `text-muted` to
  // `text-ink`, matching the swatch's own "Lisboa +" example, which
  // reads as normal dark text, not muted gray.
  const chip = (on: boolean) =>
    `shrink-0 rounded-lg border px-3 py-1.5 text-[13px] leading-[18px] font-medium transition-colors ${
      on
        ? "border-pine bg-subtle text-pine"
        : "border-line bg-white text-ink hover:border-muted"
    }`;

  return (
    <>
      {/* Round-6 feedback: a genuine single row, never wrapping — see the
       *  measurement effect above. `overflow-x-hidden` (not full
       *  `overflow-hidden`, which clips vertical overflow too — the real
       *  cause of round-7's clipped badges) is a safety net for the brief
       *  pre-measurement render only; at steady state exactly
       *  `visibleQuickFilterCount` chips are rendered, never more than
       *  fit. `pt-1` gives the badges' own `-top-1` overflow real room
       *  above the row. Round-7: the "All" chip is removed — it had no
       *  wired behavior worth keeping as its own element; a real
       *  "clear quick filters" action is a separate feature to propose,
       *  not something to invent here. */}
      <div ref={quickFilterRowRef} className="flex flex-nowrap gap-x-3 overflow-x-hidden pt-1">
        {quickFilters.slice(0, visibleQuickFilterCount).map((item) =>
          item.kind === "tech" ? (
            <CircleChip
              key={`tech-${item.slug}`}
              label={item.label}
              count={item.count}
              active={tech.includes(item.label)}
              onClick={() => toggleListParam("tech", tech, item.label)}
            >
              <TechIcon slug={item.slug} label={item.label} className="h-[18px] w-[18px]" />
            </CircleChip>
          ) : (
            <CircleChip
              key={`cat-${item.slug}`}
              label={tjf(`categoryOption.${item.slug}`)}
              count={item.count}
              active={cat.includes(item.slug)}
              onClick={() => toggleListParam("cat", cat, item.slug)}
            >
              <CategoryIcon slug={item.slug} className="h-[18px] w-[18px] text-ink" />
            </CircleChip>
          ),
        )}
      </div>

      {/* Item 8 — count, sort and the remote toggle all on one row, above
       *  the list. "More filters" opens a left-side panel (below) instead
       *  of pushing content down inline. */}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <p className="text-sm font-medium text-ink">{t("results", { count: jobs.length })}</p>

        {/* `appearance-none` + a custom chevron — item 5, pixel fidelity:
         *  the native select arrow didn't match the reference's toolbar
         *  controls. Same 36px/13px/8px-radius tokens as every other
         *  control in this row. */}
        <span className="relative inline-flex h-9 items-center">
          <select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value === "recent" ? null : e.target.value })}
            className="h-9 appearance-none rounded-lg border border-line bg-white py-0 pr-7 pl-3 text-[13px] leading-[18px] font-medium text-ink transition-colors hover:border-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-pine"
          >
            <option value="recent">{t("sortRecent")}</option>
            <option value="oldest">{t("sortOldest")}</option>
            <option value="salary">{t("sortSalary")}</option>
          </select>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>

        <Switch
          checked={remoteOnly}
          onChange={(v) => updateParams({ remote: v ? "1" : null })}
          label={t("remoteOnly")}
        />

        {/* Round-7 consistency audit: this was reusing the toggleable
         *  filter-chip recipe (solid-pine when open) — but the reference
         *  explicitly labels "More filters" as the Secondary Button
         *  example (white bg, pine border/text, no state-dependent fill).
         *  Now a real `Button variant="secondary"` instance, same as any
         *  other secondary action — its open/closed state is conveyed by
         *  the panel itself, not by recoloring the trigger. */}
        <Button
          variant="secondary"
          onClick={toggleMoreFilters}
          className="h-9 gap-1.5 px-3 text-[13px] leading-[18px] font-medium"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          {t("moreFilters")}
          {panelActiveCount > 0 ? ` (${panelActiveCount})` : ""}
        </Button>

        {activeFilterChips.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={f.onRemove}
            className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-pine bg-subtle px-3 text-[13px] font-medium text-pine"
          >
            {f.label}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ))}

        {activeCount > 0 && (
          <Button variant="danger" onClick={clearAll} className="h-9 px-3 text-[13px] leading-[18px] font-medium">
            {t("clear")}
          </Button>
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
          // relative z-[25] — landing-page redesign spec §6.8: Rail (the
          // floating left nav, fixed, z-20) and this panel occupy the same
          // left-side screen region, and Rail's `top-1/2` anchor means it
          // tracks the viewport's vertical center regardless of scroll
          // position, so there's no scroll position that reliably avoids a
          // collision. A static (non-positioned) element always paints
          // below a positioned one in the same stacking context regardless
          // of z-index, which is why this panel was getting obscured even
          // though it had no z-index conflict on paper. Explicit stacking
          // above Rail (z-20) but below the sticky header (z-30) guarantees
          // the open filters panel is never obscured, independent of scroll
          // position or Rail's own open/closed state.
          <aside className="relative z-[25] w-full shrink-0 space-y-4 rounded-[10px] border border-line bg-white p-4 sm:w-64">
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
        {/* Round-8 item 2: list:map is 2:1, not the near-even 1:1.1 split —
         *  the list is the primary surface, the map a secondary aid. */}
        <div className={`grid min-w-0 flex-1 gap-6 ${mapVisible ? "lg:grid-cols-[2fr_1fr]" : ""}`}>
          {/* Round-7: independent scroll for the list, desktop/side-by-side
           *  only — same `sticky top-20 h-[calc(100dvh-8rem)]` box the map
           *  column already uses (so both columns align), but with
           *  `overflow-y-auto` instead of `overflow-hidden` so the list's
           *  own content scrolls once the sticky box reaches its pinned
           *  position. No `overscroll-behavior` is set anywhere, so once
           *  this inner scroll is exhausted, scrolling naturally chains to
           *  the outer page — standard browser behavior, not something to
           *  wire up by hand. Scoped to `lg:` (and to `mapVisible`, the
           *  actual "list+map side by side" condition) — the stacked
           *  mobile layout keeps plain single-page scroll, unchanged.
           *  Round-8 item 3: `scrollbar-hide` keeps this column's own
           *  scroll (confirmed still scrollable — the utility only hides
           *  the browser's painted scrollbar, never disables scrolling
           *  itself) from sitting right next to the map's edge. */}
          <div
            className={
              mapVisible
                ? "order-2 scrollbar-hide lg:sticky lg:top-20 lg:order-1 lg:h-[calc(100dvh-8rem)] lg:overflow-y-auto"
                : ""
            }
          >
            {jobs.length > 0 ? (
              // gap-2 (8px) — §6.6's "vertical gap between cards," replacing
              // the old single-border-t table-row treatment now that each
              // JobRow is its own bordered card.
              <ul className="flex flex-col gap-2">
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
            <div className="relative order-1 hidden h-[420px] overflow-hidden rounded-[10px] border border-line lg:sticky lg:top-20 lg:order-2 lg:block lg:h-[calc(100dvh-8rem)]">
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
