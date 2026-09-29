"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { saveJobAction, extractJobFromUrlAction } from "@/app/[locale]/(console)/recruit/jobs/actions";
import type { JobFormInput } from "@/lib/db/jobs";
import type { SkillLevel } from "@/lib/types";
import type { ExtractedJob } from "@/lib/ai/extract-job";

type TechTagOption = { id: string; label: string; aliases: string[] };
type LocationOption = { id: string; slug: string; name: string };
type JobCategoryOption = { id: string; slug: string; label: string };
type SpokenLanguageOption = { id: string; slug: string; label: string };

type SelectedTag = { id: string; level: SkillLevel | null; required: boolean };
type SelectedLanguage = { id: string; level: SkillLevel | null };

type Initial = {
  id: string;
  title: string;
  description: string;
  language: "pt" | "en";
  seniority: JobFormInput["seniority"];
  workModel: JobFormInput["workModel"];
  locationId: string | null;
  categoryId: string | null;
  salaryMin: number;
  salaryMax: number;
  salaryPeriod: JobFormInput["salaryPeriod"];
  salaryMonths: number | null;
  employmentType: JobFormInput["employmentType"];
  selectedTechTags: SelectedTag[];
  selectedLanguages: SelectedLanguage[];
  externalApplyUrl: string;
  expiresAt: string | null;
};

const LEVELS: SkillLevel[] = ["basic", "intermediate", "advanced", "expert"];
const inputClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm disabled:bg-paper disabled:text-muted";
const labelClass = "flex flex-col gap-1 text-sm";

function LevelSelect({
  value,
  onChange,
  t,
  className,
}: {
  value: SkillLevel | null;
  onChange: (level: SkillLevel | null) => void;
  t: ReturnType<typeof useTranslations>;
  className?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || null) as SkillLevel | null)}
      className={className ?? "h-7 rounded border border-line bg-white px-1 text-xs"}
    >
      <option value="">{t("levelUnspecified")}</option>
      {LEVELS.map((lv) => (
        <option key={lv} value={lv}>
          {t(`levelOption.${lv}`)}
        </option>
      ))}
    </select>
  );
}

export function JobForm({
  techTags,
  locations,
  jobCategories,
  spokenLanguages,
  initial,
}: {
  techTags: TechTagOption[];
  locations: LocationOption[];
  jobCategories: JobCategoryOption[];
  spokenLanguages: SpokenLanguageOption[];
  initial?: Initial;
}) {
  const t = useTranslations("jobForm");
  const router = useRouter();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [language, setLanguage] = useState<"pt" | "en">(initial?.language ?? "pt");
  const [seniority, setSeniority] = useState<JobFormInput["seniority"]>(initial?.seniority ?? "mid");
  const [workModel, setWorkModel] = useState<JobFormInput["workModel"]>(initial?.workModel ?? "hybrid");
  const [locationId, setLocationId] = useState(initial?.locationId ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [salaryMin, setSalaryMin] = useState(initial?.salaryMin?.toString() ?? "");
  const [salaryMax, setSalaryMax] = useState(initial?.salaryMax?.toString() ?? "");
  const [salaryPeriod, setSalaryPeriod] = useState<JobFormInput["salaryPeriod"]>(
    initial?.salaryPeriod ?? "month",
  );
  const [salaryMonths, setSalaryMonths] = useState(initial?.salaryMonths?.toString() ?? "14");
  const [employmentType, setEmploymentType] = useState<JobFormInput["employmentType"]>(
    initial?.employmentType ?? "permanent",
  );
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>(initial?.selectedTechTags ?? []);
  const [selectedLanguages, setSelectedLanguages] = useState<SelectedLanguage[]>(initial?.selectedLanguages ?? []);
  const [externalApplyUrl, setExternalApplyUrl] = useState(initial?.externalApplyUrl ?? "");
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ?? "");
  const [tagFilter, setTagFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<"draft" | "publish" | null>(null);
  const [extractUrl, setExtractUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractNotice, setExtractNotice] = useState<string | null>(null);

  const filteredTags = useMemo(() => {
    const q = tagFilter.trim().toLowerCase();
    if (!q) return techTags;
    return techTags.filter(
      (tag) => tag.label.toLowerCase().includes(q) || tag.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  }, [techTags, tagFilter]);

  function toggleTag(id: string) {
    setSelectedTags((prev) =>
      prev.some((t) => t.id === id) ? prev.filter((t) => t.id !== id) : [...prev, { id, level: null, required: true }],
    );
  }

  function updateTagLevel(id: string, level: SkillLevel | null) {
    setSelectedTags((prev) => prev.map((t) => (t.id === id ? { ...t, level } : t)));
  }

  function updateTagRequired(id: string, required: boolean) {
    setSelectedTags((prev) => prev.map((t) => (t.id === id ? { ...t, required } : t)));
  }

  function toggleLanguage(id: string) {
    setSelectedLanguages((prev) =>
      prev.some((l) => l.id === id) ? prev.filter((l) => l.id !== id) : [...prev, { id, level: null }],
    );
  }

  function updateLanguageLevel(id: string, level: SkillLevel | null) {
    setSelectedLanguages((prev) => prev.map((l) => (l.id === id ? { ...l, level } : l)));
  }

  /** Applies whatever the model actually returned, field by field — a field
   *  the model left null/empty is left completely untouched, never blanked
   *  out. Tech/language labels are fuzzy-matched against the real vocab
   *  here (not on the server) since this component already has both lists
   *  as props; a label with no real match is silently dropped rather than
   *  invented as a new tag. locationId/categoryId are never touched (§ plan
   *  — an external posting's location text won't map onto our 14 curated
   *  cities, and category is a judgment call for the employer). */
  function applyExtractedData(data: ExtractedJob) {
    if (data.title) setTitle(data.title);
    if (data.description) setDescription(data.description);
    if (data.seniority) setSeniority(data.seniority);
    if (data.workModel) setWorkModel(data.workModel);
    if (data.employmentType) setEmploymentType(data.employmentType);
    if (data.salaryMin !== null) setSalaryMin(String(data.salaryMin));
    if (data.salaryMax !== null) setSalaryMax(String(data.salaryMax));
    if (data.salaryPeriod) setSalaryPeriod(data.salaryPeriod);
    if (data.adLanguage) setLanguage(data.adLanguage);

    if (data.techTagLabels.length > 0) {
      const matched: SelectedTag[] = [];
      for (const label of data.techTagLabels) {
        const norm = label.trim().toLowerCase();
        const tag = techTags.find(
          (tg) => tg.label.toLowerCase() === norm || tg.aliases.some((a) => a.toLowerCase() === norm),
        );
        if (tag && !matched.some((m) => m.id === tag.id)) {
          matched.push({ id: tag.id, level: null, required: true });
        }
      }
      if (matched.length > 0) setSelectedTags(matched);
    }

    if (data.requiredLanguages.length > 0) {
      const matched: SelectedLanguage[] = [];
      for (const rl of data.requiredLanguages) {
        const norm = rl.label.trim().toLowerCase();
        const lang = spokenLanguages.find((l) => l.label.toLowerCase() === norm);
        if (lang && !matched.some((m) => m.id === lang.id)) {
          matched.push({ id: lang.id, level: rl.level });
        }
      }
      if (matched.length > 0) setSelectedLanguages(matched);
    }
  }

  async function handleExtract() {
    if (!extractUrl.trim()) return;
    setExtracting(true);
    setExtractError(null);
    setExtractNotice(null);
    const result = await extractJobFromUrlAction(extractUrl.trim());
    setExtracting(false);
    if (!result.ok) {
      setExtractError(t(`extractError.${result.reason}`));
      return;
    }
    applyExtractedData(result.data);
    setExtractNotice(t("extractSuccess"));
  }

  function validate(): string | null {
    if (!title.trim()) return t("errorTitle");
    if (!description.trim()) return t("errorDescription");
    if (workModel !== "remote" && !locationId) return t("errorLocation");
    if (!categoryId) return t("errorCategory");
    const min = Number(salaryMin);
    const max = Number(salaryMax);
    if (!min || min <= 0) return t("errorSalaryMin");
    if (!max || max < min) return t("errorSalaryMax");
    if (expiresAt && expiresAt <= new Date().toISOString().slice(0, 10)) return t("errorExpiresAt");
    return null;
  }

  async function handleSubmit(e: FormEvent, publish: boolean) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setPending(publish ? "publish" : "draft");
    try {
      const result = await saveJobAction(initial?.id ?? null, {
        title: title.trim(),
        description: description.trim(),
        language,
        seniority,
        workModel,
        locationId: workModel === "remote" ? null : locationId,
        categoryId,
        salaryMin: Number(salaryMin),
        salaryMax: Number(salaryMax),
        salaryPeriod,
        salaryMonths: salaryPeriod === "month" ? Number(salaryMonths) : null,
        employmentType,
        techTags: selectedTags.map((t) => ({ techTagId: t.id, level: t.level, required: t.required })),
        languages: selectedLanguages.map((l) => ({ spokenLanguageId: l.id, level: l.level })),
        externalApplyUrl,
        expiresAt: expiresAt || null,
        publish,
      });

      if (result.message === "notVerified") {
        setNotice(t("notVerified"));
      } else {
        router.push("/recruit");
        router.refresh();
        return;
      }
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(null);
    }
  }

  return (
    <form className="flex max-w-2xl flex-col gap-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>}

      {!initial && (
        <div className="rounded-lg border border-line bg-paper p-4">
          <span className="text-sm font-medium">{t("pasteJobLink")}</span>
          <div className="mt-2 flex gap-2">
            <input
              type="url"
              value={extractUrl}
              onChange={(e) => setExtractUrl(e.target.value)}
              placeholder="https://…"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              disabled={extracting || !extractUrl.trim()}
              onClick={handleExtract}
              className="h-9 shrink-0 rounded-lg bg-pine px-3 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
            >
              {extracting ? t("extracting") : t("fetchAndFill")}
            </button>
          </div>
          {extractError && <p className="mt-2 text-xs text-red-700">{extractError}</p>}
          {extractNotice && <p className="mt-2 text-xs text-pine">{extractNotice}</p>}
        </div>
      )}

      <label className={labelClass}>
        <span>{t("title")}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </label>

      <label className={labelClass}>
        <span>{t("description")}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={8}
          className={`${inputClass} h-auto py-2`}
        />
        <span className="text-xs text-muted">{t("descriptionHint")}</span>
      </label>

      <label className={labelClass}>
        <span>{t("externalApplyUrl")}</span>
        <input
          type="url"
          value={externalApplyUrl}
          onChange={(e) => setExternalApplyUrl(e.target.value)}
          placeholder="https://…"
          className={inputClass}
        />
        <span className="text-xs text-muted">{t("externalApplyUrlHint")}</span>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className={labelClass}>
          <span>{t("language")}</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as "pt" | "en")}
            className={inputClass}
          >
            <option value="pt">PT</option>
            <option value="en">EN</option>
          </select>
        </label>

        <label className={labelClass}>
          <span>{t("seniority")}</span>
          <select
            value={seniority}
            onChange={(e) => setSeniority(e.target.value as JobFormInput["seniority"])}
            className={inputClass}
          >
            {(["junior", "mid", "senior", "lead"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`seniorityOption.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className={labelClass}>
          <span>{t("workModel")}</span>
          <select
            value={workModel}
            onChange={(e) => setWorkModel(e.target.value as JobFormInput["workModel"])}
            className={inputClass}
          >
            {(["remote", "hybrid", "office"] as const).map((w) => (
              <option key={w} value={w}>
                {t(`workModelOption.${w}`)}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          <span>{t("location")}</span>
          <select
            value={locationId}
            disabled={workModel === "remote"}
            onChange={(e) => setLocationId(e.target.value)}
            className={inputClass}
          >
            <option value="">
              {workModel === "remote" ? t("locationRemote") : t("locationPlaceholder")}
            </option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={labelClass}>
        <span>{t("category")}</span>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
          <option value="">{t("categoryPlaceholder")}</option>
          {jobCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {t(`categoryOption.${cat.slug}`)}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-medium text-ink">{t("salaryLegend")}</legend>
        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            <span>{t("salaryMin")}</span>
            <input
              type="number"
              min={1}
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            <span>{t("salaryMax")}</span>
            <input
              type="number"
              min={1}
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <label className={labelClass}>
            <span>{t("salaryPeriod")}</span>
            <select
              value={salaryPeriod}
              onChange={(e) => setSalaryPeriod(e.target.value as JobFormInput["salaryPeriod"])}
              className={inputClass}
            >
              {(["hour", "day", "month", "year"] as const).map((p) => (
                <option key={p} value={p}>
                  {t(`salaryPeriodOption.${p}`)}
                </option>
              ))}
            </select>
          </label>
          {salaryPeriod === "month" && (
            <label className={labelClass}>
              <span>{t("salaryMonths")}</span>
              <select
                value={salaryMonths}
                onChange={(e) => setSalaryMonths(e.target.value)}
                className={inputClass}
              >
                {[12, 13, 14].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className={`${labelClass} mt-4`}>
          <span>{t("employmentType")}</span>
          <select
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value as JobFormInput["employmentType"])}
            className={inputClass}
          >
            {(["permanent", "fixed_term", "contractor", "freelance", "internship"] as const).map((et) => (
              <option key={et} value={et}>
                {t(`employmentTypeOption.${et}`)}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <label className={labelClass}>
        <span>{t("expiresAt")}</span>
        <input
          type="date"
          min={new Date().toISOString().slice(0, 10)}
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className={inputClass}
        />
        <span className="text-xs text-muted">{t("expiresAtHint")}</span>
      </label>

      <div>
        <span className="text-sm">{t("techTags")}</span>
        <input
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          placeholder={t("techTagsFilter")}
          className={`${inputClass} mt-1 w-full`}
        />
        {selectedTags.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {selectedTags.map((sel) => {
              const tag = techTags.find((tg) => tg.id === sel.id);
              if (!tag) return null;
              return (
                <li
                  key={sel.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-pine bg-pine/10 px-2 py-1"
                >
                  <span className="text-xs font-medium text-pine">{tag.label}</span>
                  <LevelSelect value={sel.level} onChange={(level) => updateTagLevel(sel.id, level)} t={t} />
                  <label className="flex items-center gap-1 text-[11px] text-ink">
                    <input
                      type="checkbox"
                      checked={sel.required}
                      onChange={(e) => updateTagRequired(sel.id, e.target.checked)}
                    />
                    {t("mustHave")}
                  </label>
                  <button type="button" onClick={() => toggleTag(sel.id)} className="ml-auto text-xs text-pine">
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-line bg-white p-2">
          <ul className="flex flex-wrap gap-1.5">
            {filteredTags.slice(0, 60).map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={
                    selectedTags.some((t) => t.id === tag.id)
                      ? "rounded-md border border-pine bg-pine px-2 py-0.5 text-xs text-white"
                      : "rounded-md border border-line px-2 py-0.5 text-xs text-muted hover:border-muted"
                  }
                >
                  {tag.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <span className="text-sm">{t("requiredLanguages")}</span>
        <ul className="mt-2 flex flex-col gap-1.5">
          {spokenLanguages.map((lang) => {
            const sel = selectedLanguages.find((l) => l.id === lang.id);
            return (
              <li key={lang.id} className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={!!sel} onChange={() => toggleLanguage(lang.id)} />
                  {lang.label}
                </label>
                {sel && <LevelSelect value={sel.level} onChange={(level) => updateLanguageLevel(lang.id, level)} t={t} />}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={pending !== null}
          onClick={(e) => handleSubmit(e, false)}
          className="h-10 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink hover:border-muted disabled:opacity-50"
        >
          {t("saveDraft")}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={(e) => handleSubmit(e, true)}
          className="h-10 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
        >
          {t("publish")}
        </button>
      </div>
    </form>
  );
}
