"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { saveCandidateJobPreferencesAction } from "@/app/[locale]/(candidate)/profile/actions";
import { useAutosave } from "@/hooks/useAutosave";
import type {
  CandidateJobPreferences,
  WorkModelPreference,
  EmploymentTypePreference,
  SalaryPeriodPreference,
} from "@/lib/db/candidate-profile";

type JobCategoryOption = { id: string; slug: string; label: string };
type LocationOption = { id: string; slug: string; name: string };

type Draft = {
  categoryIds: string[];
  locationIds: string[];
  workModel: WorkModelPreference | "";
  employmentType: EmploymentTypePreference | "";
  salaryMin: string;
  salaryMax: string;
  salaryPeriod: SalaryPeriodPreference | "";
};

const WORK_MODELS: WorkModelPreference[] = ["remote", "hybrid", "office"];
const EMPLOYMENT_TYPES: EmploymentTypePreference[] = [
  "permanent",
  "fixed_term",
  "contractor",
  "freelance",
  "internship",
];
const SALARY_PERIODS: SalaryPeriodPreference[] = ["hour", "day", "month", "year"];
const selectClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm";

/** §AI Pieces backlog, profile-depth phase — new: lets a candidate scope
 *  what they're actually interested in, so a future recommendation engine
 *  (item 4) matches against this instead of everything. Deliberately
 *  manual-only, never AI-extracted — a CV doesn't reliably state "I want
 *  remote work in Lisbon." Reuses the existing curated `job_categories`/
 *  `locations` taxonomies and the same `categoryOption`/`workModelOption`/
 *  `employmentTypeOption`/`salaryPeriodOption` i18n keys `JobForm.tsx`
 *  already uses for the identical concepts on the job-posting side.
 *  Autosaves the whole preferences object ~800ms after any change. */
export function JobPreferencesSection({
  preferences,
  jobCategories,
  locations,
}: {
  preferences: CandidateJobPreferences | null;
  jobCategories: JobCategoryOption[];
  locations: LocationOption[];
}) {
  const t = useTranslations("jobPreferences");
  const jf = useTranslations("jobForm");
  const [draft, setDraft] = useState<Draft>({
    categoryIds: preferences?.categoryIds ?? [],
    locationIds: preferences?.locationIds ?? [],
    workModel: preferences?.workModel ?? "",
    employmentType: preferences?.employmentType ?? "",
    salaryMin: preferences?.salaryMin?.toString() ?? "",
    salaryMax: preferences?.salaryMax?.toString() ?? "",
    salaryPeriod: preferences?.salaryPeriod ?? "",
  });

  const status = useAutosave(draft, (value) =>
    saveCandidateJobPreferencesAction({
      categoryIds: value.categoryIds,
      locationIds: value.locationIds,
      workModel: value.workModel || null,
      employmentType: value.employmentType || null,
      salaryMin: value.salaryMin.trim() ? Number(value.salaryMin) : null,
      salaryMax: value.salaryMax.trim() ? Number(value.salaryMax) : null,
      salaryPeriod: value.salaryPeriod || null,
    }),
  );

  function toggleCategory(id: string) {
    setDraft((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((c) => c !== id)
        : [...prev.categoryIds, id],
    }));
  }
  function toggleLocation(id: string) {
    setDraft((prev) => ({
      ...prev,
      locationIds: prev.locationIds.includes(id)
        ? prev.locationIds.filter((l) => l !== id)
        : [...prev.locationIds, id],
    }));
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{t("categories")}</span>
        {status === "pending" || status === "saving" ? (
          <span className="text-xs text-muted">{t("saving")}</span>
        ) : status === "saved" ? (
          <span className="text-xs text-pine">{t("saved")}</span>
        ) : null}
      </div>
      <ul className="-mt-4 flex flex-wrap gap-1.5">
        {jobCategories.map((cat) => (
          <li key={cat.id}>
            <button
              type="button"
              onClick={() => toggleCategory(cat.id)}
              className={
                draft.categoryIds.includes(cat.id)
                  ? "rounded-md border border-pine bg-pine px-2 py-1 text-xs text-white"
                  : "rounded-md border border-line px-2 py-1 text-xs text-muted hover:border-muted"
              }
            >
              {jf(`categoryOption.${cat.slug}`)}
            </button>
          </li>
        ))}
      </ul>

      <div>
        <span className="text-sm font-semibold">{t("locations")}</span>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {locations.map((loc) => (
            <li key={loc.id}>
              <button
                type="button"
                onClick={() => toggleLocation(loc.id)}
                className={
                  draft.locationIds.includes(loc.id)
                    ? "rounded-md border border-pine bg-pine px-2 py-1 text-xs text-white"
                    : "rounded-md border border-line px-2 py-1 text-xs text-muted hover:border-muted"
                }
              >
                {loc.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("workModel")}</span>
          <select
            value={draft.workModel}
            onChange={(e) => setDraft((prev) => ({ ...prev, workModel: e.target.value as WorkModelPreference | "" }))}
            className={selectClass}
          >
            <option value="">{t("any")}</option>
            {WORK_MODELS.map((w) => (
              <option key={w} value={w}>
                {jf(`workModelOption.${w}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("employmentType")}</span>
          <select
            value={draft.employmentType}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, employmentType: e.target.value as EmploymentTypePreference | "" }))
            }
            className={selectClass}
          >
            <option value="">{t("any")}</option>
            {EMPLOYMENT_TYPES.map((et) => (
              <option key={et} value={et}>
                {jf(`employmentTypeOption.${et}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-medium text-ink">{t("desiredSalary")}</legend>
        <div className="grid grid-cols-3 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>{t("min")}</span>
            <input
              type="number"
              min={0}
              value={draft.salaryMin}
              onChange={(e) => setDraft((prev) => ({ ...prev, salaryMin: e.target.value }))}
              className={selectClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t("max")}</span>
            <input
              type="number"
              min={0}
              value={draft.salaryMax}
              onChange={(e) => setDraft((prev) => ({ ...prev, salaryMax: e.target.value }))}
              className={selectClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t("period")}</span>
            <select
              value={draft.salaryPeriod}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, salaryPeriod: e.target.value as SalaryPeriodPreference | "" }))
              }
              className={selectClass}
            >
              <option value="">—</option>
              {SALARY_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {jf(`salaryPeriodOption.${p}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
    </div>
  );
}
