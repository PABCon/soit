"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { saveCandidateJobPreferencesAction } from "@/app/[locale]/(candidate)/profile/actions";
import type {
  CandidateJobPreferences,
  WorkModelPreference,
  EmploymentTypePreference,
  SalaryPeriodPreference,
} from "@/lib/db/candidate-profile";

type JobCategoryOption = { id: string; slug: string; label: string };
type LocationOption = { id: string; slug: string; name: string };

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
 *  already uses for the identical concepts on the job-posting side. */
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
  const [categoryIds, setCategoryIds] = useState<string[]>(preferences?.categoryIds ?? []);
  const [locationIds, setLocationIds] = useState<string[]>(preferences?.locationIds ?? []);
  const [workModel, setWorkModel] = useState<WorkModelPreference | "">(preferences?.workModel ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentTypePreference | "">(
    preferences?.employmentType ?? "",
  );
  const [salaryMin, setSalaryMin] = useState(preferences?.salaryMin?.toString() ?? "");
  const [salaryMax, setSalaryMax] = useState(preferences?.salaryMax?.toString() ?? "");
  const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriodPreference | "">(preferences?.salaryPeriod ?? "");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggleCategory(id: string) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
    setSaved(false);
  }
  function toggleLocation(id: string) {
    setLocationIds((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
    setSaved(false);
  }

  async function save() {
    setPending(true);
    await saveCandidateJobPreferencesAction({
      categoryIds,
      locationIds,
      workModel: workModel || null,
      employmentType: employmentType || null,
      salaryMin: salaryMin.trim() ? Number(salaryMin) : null,
      salaryMax: salaryMax.trim() ? Number(salaryMax) : null,
      salaryPeriod: salaryPeriod || null,
    });
    setPending(false);
    setSaved(true);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <span className="text-sm font-semibold">{t("categories")}</span>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {jobCategories.map((cat) => (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={
                  categoryIds.includes(cat.id)
                    ? "rounded-md border border-pine bg-pine px-2 py-1 text-xs text-white"
                    : "rounded-md border border-line px-2 py-1 text-xs text-muted hover:border-muted"
                }
              >
                {jf(`categoryOption.${cat.slug}`)}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <span className="text-sm font-semibold">{t("locations")}</span>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {locations.map((loc) => (
            <li key={loc.id}>
              <button
                type="button"
                onClick={() => toggleLocation(loc.id)}
                className={
                  locationIds.includes(loc.id)
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
            value={workModel}
            onChange={(e) => {
              setWorkModel(e.target.value as WorkModelPreference | "");
              setSaved(false);
            }}
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
            value={employmentType}
            onChange={(e) => {
              setEmploymentType(e.target.value as EmploymentTypePreference | "");
              setSaved(false);
            }}
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
              value={salaryMin}
              onChange={(e) => {
                setSalaryMin(e.target.value);
                setSaved(false);
              }}
              className={selectClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t("max")}</span>
            <input
              type="number"
              min={0}
              value={salaryMax}
              onChange={(e) => {
                setSalaryMax(e.target.value);
                setSaved(false);
              }}
              className={selectClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t("period")}</span>
            <select
              value={salaryPeriod}
              onChange={(e) => {
                setSalaryPeriod(e.target.value as SalaryPeriodPreference | "");
                setSaved(false);
              }}
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

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="h-10 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
        >
          {pending ? t("saving") : t("saveChanges")}
        </button>
        {saved && <span className="text-sm text-pine">{t("saved")}</span>}
      </div>
    </div>
  );
}
