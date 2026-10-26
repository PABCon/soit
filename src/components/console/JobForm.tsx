"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Link2,
  FileText,
  SlidersHorizontal,
  DollarSign,
  Calendar,
  Layers,
  Globe2,
  Sparkles,
  Star,
  Eye,
  X,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  saveJobAction,
  extractJobFromUrlAction,
  polishJobDescriptionAction,
  requestTechTagAction,
  resolveUnmatchedTechLabelsAction,
} from "@/app/[locale]/(console)/recruit/jobs/actions";
import type { JobFormInput } from "@/lib/db/jobs";
import type { SkillLevel } from "@/lib/types";
import type { ExtractedJob } from "@/lib/ai/extract-job";
import { buttonClassName } from "@/components/Button";
import { JobPreviewModal } from "@/components/console/JobPreviewModal";

type TechTagOption = { id: string; label: string; aliases: string[] };
type LocationOption = { id: string; slug: string; name: string; country: string };
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
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: JobFormInput["salaryPeriod"];
  salaryMonths: number | null;
  employmentTypes: JobFormInput["employmentTypes"];
  selectedTechTags: SelectedTag[];
  selectedLanguages: SelectedLanguage[];
  externalApplyUrl: string;
  expiresAt: string | null;
  salaryPublic: boolean;
};

const LEVELS: SkillLevel[] = ["basic", "intermediate", "advanced", "expert"];
const inputClass =
  "h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-muted disabled:bg-paper disabled:text-muted";
const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-ink";

/** Round 25 restyle: every section of this form is now a bordered card with
 *  a small icon badge + title + subtitle, matching the reference's own
 *  "Basic information" / "Job details" / "Salary" / "Tech stack" etc.
 *  layout — real functionality underneath is entirely unchanged, this is
 *  presentation only. */
function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
  headerExtra,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerExtra?: ReactNode;
}) {
  return (
    <fieldset className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine">
            <Icon className="h-5 w-5" aria-hidden={true} />
          </span>
          <div>
            <legend className="font-display text-base font-semibold text-ink">{title}</legend>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
        </div>
        {headerExtra}
      </div>
      <div className="mt-4">{children}</div>
    </fieldset>
  );
}

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
      className={className ?? "h-8 rounded-lg border border-line bg-white px-2 text-xs text-ink"}
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
  techTags: techTagsProp,
  locations,
  jobCategories,
  spokenLanguages,
  initial,
  isPayingCustomer,
  companyName,
  companyLogoUrl,
}: {
  techTags: TechTagOption[];
  locations: LocationOption[];
  jobCategories: JobCategoryOption[];
  spokenLanguages: SpokenLanguageOption[];
  initial?: Initial;
  /** §pricing — hiding the salary publicly is a paid-tier perk (a spent ad
   *  credit or an active Top Employer subscription), never available on
   *  the free slot. The server re-enforces this regardless of what's
   *  submitted here; this only controls whether the toggle is shown. */
  isPayingCustomer: boolean;
  /** For the "preview" panel only — how the job will look under the
   *  employer's own company header, candidate-side. */
  companyName: string;
  companyLogoUrl: string | null;
}) {
  const t = useTranslations("jobForm");
  const router = useRouter();

  // Local copy, not just the prop directly — a newly auto-resolved tech
  // tag (requestMissingTechTag, applyExtractedData's unmatched-label pass)
  // needs to show up and be selectable immediately, without a page reload.
  const [techTags, setTechTags] = useState<TechTagOption[]>(techTagsProp);

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
  const [employmentTypes, setEmploymentTypes] = useState<JobFormInput["employmentTypes"]>(
    initial?.employmentTypes ?? ["permanent"],
  );
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>(initial?.selectedTechTags ?? []);
  const [selectedLanguages, setSelectedLanguages] = useState<SelectedLanguage[]>(initial?.selectedLanguages ?? []);
  const [externalApplyUrl, setExternalApplyUrl] = useState(initial?.externalApplyUrl ?? "");
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ?? "");
  const [salaryPublic, setSalaryPublic] = useState(initial?.salaryPublic ?? true);
  const [tagFilter, setTagFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<"draft" | "publish" | null>(null);
  const [extractUrl, setExtractUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractNotice, setExtractNotice] = useState<string | null>(null);
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [techRequestState, setTechRequestState] = useState<"idle" | "pending" | "added" | "rejected">("idle");
  const [previewOpen, setPreviewOpen] = useState(false);

  const filteredTags = useMemo(() => {
    const q = tagFilter.trim().toLowerCase();
    if (!q) return techTags;
    return techTags.filter(
      (tag) => tag.label.toLowerCase().includes(q) || tag.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  }, [techTags, tagFilter]);

  const previewLocationName = useMemo(() => {
    if (workModel === "remote") return null;
    return locations.find((loc) => loc.id === locationId)?.name ?? null;
  }, [locations, locationId, workModel]);

  const previewTechStack = useMemo(
    () =>
      selectedTags.map((st) => ({
        id: st.id,
        label: techTags.find((tag) => tag.id === st.id)?.label ?? "?",
        level: st.level,
        required: st.required,
      })),
    [selectedTags, techTags],
  );

  const previewLanguages = useMemo(
    () =>
      selectedLanguages.map((sl) => ({
        id: sl.id,
        label: spokenLanguages.find((lang) => lang.id === sl.id)?.label ?? "?",
        level: sl.level,
      })),
    [selectedLanguages, spokenLanguages],
  );

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

  /** §job-import — resolves immediately now (no more "sent, wait for
   *  review"): a genuinely new or equivalent-to-existing label is created/
   *  aliased on the spot, and this adds it to the local tag list and
   *  selects it right away so the employer never has to come back later. */
  async function requestMissingTechTag() {
    setTechRequestState("pending");
    const result = await requestTechTagAction(tagFilter);
    if (!result.ok) {
      setTechRequestState("rejected");
      return;
    }
    const tag = { id: result.tag.id, label: result.tag.label, aliases: result.tag.aliases };
    setTechTags((prev) => (prev.some((t) => t.id === tag.id) ? prev.map((t) => (t.id === tag.id ? tag : t)) : [...prev, tag]));
    setSelectedTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, { id: tag.id, level: null, required: true }]));
    // Deliberately NOT clearing tagFilter — the newly added tag now
    // matches it and reappears in the real filtered list right above,
    // already selected/highlighted, which is the actual success feedback.
    // Resetting to "idle" rather than a transient "added" state since
    // there's no stable place left to show one once that happens.
    setTechRequestState("idle");
  }

  function toggleLanguage(id: string) {
    setSelectedLanguages((prev) =>
      prev.some((l) => l.id === id) ? prev.filter((l) => l.id !== id) : [...prev, { id, level: null }],
    );
  }

  function updateLanguageLevel(id: string, level: SkillLevel | null) {
    setSelectedLanguages((prev) => prev.map((l) => (l.id === id ? { ...l, level } : l)));
  }

  /** Real-usage QA item: "multiple contract types on one job ad" —
   *  never lets the set empty out entirely, same reasoning a radio-style
   *  single select always guaranteed one selection by construction. */
  function toggleEmploymentType(et: JobFormInput["employmentTypes"][number]) {
    setEmploymentTypes((prev) => {
      if (prev.includes(et)) return prev.length > 1 ? prev.filter((x) => x !== et) : prev;
      return [...prev, et];
    });
  }

  /** Applies whatever the model actually returned, field by field — a field
   *  the model left null/empty is left completely untouched, never blanked
   *  out. Tech/language/category/location labels are matched against the
   *  real vocab here (not on the server) since this component already has
   *  all four lists as props. categoryLabel/locationLabel are exact-
   *  matched against the same `label`/`name` text the server action gave
   *  the model as its allowed vocabulary (extractJobFromUrlAction),
   *  independent of whatever this UI's own translated option text shows.
   *  §job-import: a tech-stack label with no match used to be silently
   *  dropped — it now goes through the same auto-approve-or-reject
   *  pipeline the bulk importer uses (resolveUnmatchedTechLabelsAction),
   *  so a real, common skill like "VBA" gets added to the real
   *  vocabulary on the spot instead of just disappearing. */
  async function applyExtractedData(data: ExtractedJob) {
    if (data.title) setTitle(data.title);
    if (data.description) setDescription(data.description);
    if (data.seniority) setSeniority(data.seniority);
    if (data.workModel) setWorkModel(data.workModel);
    if (data.employmentType) setEmploymentTypes([data.employmentType]);
    if (data.salaryMin !== null) setSalaryMin(String(data.salaryMin));
    if (data.salaryMax !== null) setSalaryMax(String(data.salaryMax));
    if (data.salaryPeriod) setSalaryPeriod(data.salaryPeriod);
    if (data.adLanguage) setLanguage(data.adLanguage);

    if (data.techStack.length > 0) {
      const matched: SelectedTag[] = [];
      const unmatched: typeof data.techStack = [];
      for (const entry of data.techStack) {
        const norm = entry.label.trim().toLowerCase();
        const tag = techTags.find(
          (tg) => tg.label.toLowerCase() === norm || tg.aliases.some((a) => a.toLowerCase() === norm),
        );
        if (tag) {
          if (!matched.some((m) => m.id === tag.id)) matched.push({ id: tag.id, level: entry.level, required: entry.required });
        } else {
          unmatched.push(entry);
        }
      }
      if (matched.length > 0) setSelectedTags(matched);

      if (unmatched.length > 0) {
        const resolved = await resolveUnmatchedTechLabelsAction(unmatched.map((u) => u.label));
        const newlyUsable = resolved.filter((r) => r.tag !== null) as { label: string; tag: { id: string; label: string; aliases: string[] } }[];
        if (newlyUsable.length > 0) {
          setTechTags((prev) => {
            const additions = newlyUsable.map((r) => r.tag).filter((nt) => !prev.some((p) => p.id === nt.id));
            return [...prev, ...additions];
          });
          setSelectedTags((prev) => {
            const additions = newlyUsable
              .map((r) => {
                const source = unmatched.find((u) => u.label === r.label);
                return source ? { id: r.tag.id, level: source.level, required: source.required } : null;
              })
              .filter((x): x is SelectedTag => x !== null && !prev.some((p) => p.id === x.id));
            return [...prev, ...additions];
          });
        }
      }
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

    if (data.categoryLabel) {
      const norm = data.categoryLabel.trim().toLowerCase();
      const category = jobCategories.find((c) => c.label.toLowerCase() === norm);
      if (category) setCategoryId(category.id);
    }

    if (data.locationLabel) {
      const norm = data.locationLabel.trim().toLowerCase();
      const location = locations.find((l) => l.name.toLowerCase() === norm);
      if (location) setLocationId(location.id);
    }
  }

  async function handleExtract() {
    if (!extractUrl.trim()) return;
    setExtracting(true);
    setExtractError(null);
    setExtractNotice(null);
    const result = await extractJobFromUrlAction(extractUrl.trim());
    if (!result.ok) {
      setExtracting(false);
      setExtractError(t(`extractError.${result.reason}`));
      return;
    }
    // Stays "extracting" through the tech-tag resolution pass too (it can
    // involve its own LLM calls for any unmatched label) — a spinner that
    // turns off before the form has actually finished updating would read
    // as done when it isn't.
    await applyExtractedData(result.data);
    setExtracting(false);
    setExtractNotice(t("extractSuccess"));
  }

  /** Formatting pass only — reformats whatever the employer already typed
   *  or pasted, never rewrites its meaning (see polish-text.ts's own
   *  prompt). Available in both create and edit mode, unlike the link-
   *  paste autofill above (which only makes sense before any content
   *  exists) — this transforms the employer's *current* draft, so it's
   *  useful any time. */
  async function handlePolish() {
    if (!description.trim()) return;
    setPolishing(true);
    setPolishError(null);
    const result = await polishJobDescriptionAction(description);
    setPolishing(false);
    if (!result.ok) {
      setPolishError(t(`polishError.${result.reason}`));
      return;
    }
    setDescription(result.text);
  }

  // §job-import: a bulk-imported draft can land with no category/salary
  // yet — fine to just save as a draft, same as a human leaving the form
  // half-filled; only actually publishing requires them, enforced here to
  // match the server-side gate (saveJob's hasRequiredFields) exactly.
  function validate(publish: boolean): string | null {
    if (!title.trim()) return t("errorTitle");
    if (!description.trim()) return t("errorDescription");
    if (workModel !== "remote" && !locationId) return t("errorLocation");
    if (publish) {
      if (!categoryId) return t("errorCategory");
      const min = Number(salaryMin);
      const max = Number(salaryMax);
      if (!min || min <= 0) return t("errorSalaryMin");
      if (!max || max < min) return t("errorSalaryMax");
    }
    if (expiresAt && expiresAt <= new Date().toISOString().slice(0, 10)) return t("errorExpiresAt");
    return null;
  }

  async function handleSubmit(e: FormEvent, publish: boolean) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const validationError = validate(publish);
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
        categoryId: categoryId || null,
        salaryMin: salaryMin.trim() ? Number(salaryMin) : null,
        salaryMax: salaryMax.trim() ? Number(salaryMax) : null,
        salaryPeriod,
        salaryMonths: salaryPeriod === "month" ? Number(salaryMonths) : null,
        employmentTypes,
        techTags: selectedTags.map((t) => ({ techTagId: t.id, level: t.level, required: t.required })),
        languages: selectedLanguages.map((l) => ({ spokenLanguageId: l.id, level: l.level })),
        externalApplyUrl,
        expiresAt: expiresAt || null,
        publish,
        salaryPublic,
      });

      if (result.message === "notVerified") {
        setNotice(t("notVerified"));
      } else if (result.message === "noAdCredits") {
        setNotice(t("noAdCredits"));
      } else if (result.message === "missingRequiredFields") {
        setNotice(t("missingRequiredFields"));
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
    <form className="flex flex-col gap-6">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          {!initial && (
            <SectionCard icon={Link2} title={t("pasteJobLink")} subtitle={t("pasteJobLinkSubtitle")}>
              <div className="flex gap-2">
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
                  className={`shrink-0 ${buttonClassName({ size: "md" })}`}
                >
                  {extracting ? t("extracting") : t("fetchAndFill")}
                </button>
              </div>
              {extractError && <p className="mt-2 text-xs text-red-700">{extractError}</p>}
              {extractNotice && <p className="mt-2 text-xs text-pine">{extractNotice}</p>}
            </SectionCard>
          )}

          <SectionCard icon={FileText} title={t("basicInfoTitle")} subtitle={t("basicInfoSubtitle")}>
            <div className="flex flex-col gap-5">
              <label className={labelClass}>
                <span>{t("title")}</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
              </label>

              <label className={labelClass}>
                <div className="flex items-center justify-between">
                  <span>{t("description")}</span>
                  <button
                    type="button"
                    disabled={polishing || !description.trim()}
                    onClick={handlePolish}
                    className="inline-flex items-center gap-1 text-xs font-medium text-pine hover:text-pine-hover disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    {polishing ? t("polishing") : t("polishWithAi")}
                  </button>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={8}
                  className={`${inputClass} h-auto py-2`}
                />
                <span className="text-xs text-muted">{t("descriptionHint")}</span>
                {polishError && <span className="text-xs text-red-700">{polishError}</span>}
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
            </div>
          </SectionCard>

          <SectionCard icon={SlidersHorizontal} title={t("jobDetailsTitle")} subtitle={t("jobDetailsSubtitle")}>
            <div className="flex flex-col gap-5">
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
                    {/* Job-location expansion: a company hiring for a
                     *  Portugal-based role may also have European offices —
                     *  optgroups keep the original 14+ Portuguese cities
                     *  visually separate from the newer European hub set,
                     *  rather than one long undifferentiated list. */}
                    <optgroup label={t("locationGroupPortugal")}>
                      {locations
                        .filter((loc) => loc.country === "Portugal")
                        .map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                    </optgroup>
                    {locations.some((loc) => loc.country !== "Portugal") && (
                      <optgroup label={t("locationGroupOtherEurope")}>
                        {locations
                          .filter((loc) => loc.country !== "Portugal")
                          .map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name} ({loc.country})
                            </option>
                          ))}
                      </optgroup>
                    )}
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
            </div>
          </SectionCard>
        </div>

        <div className="flex flex-col gap-6">
          <SectionCard icon={DollarSign} title={t("salaryLegend")}>
            <div className="flex flex-col gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
              {isPayingCustomer ? (
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={!salaryPublic}
                    onChange={(e) => setSalaryPublic(!e.target.checked)}
                  />
                  <span>{t("hideSalaryPublicly")}</span>
                </label>
              ) : (
                <p className="text-xs text-muted">{t("hideSalaryUpsell")}</p>
              )}
              <div>
                <span className="text-sm font-medium text-ink">{t("employmentType")}</span>
                <p className="mt-0.5 text-xs text-muted">{t("employmentTypeHint")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(["permanent", "fixed_term", "contractor", "freelance", "internship"] as const).map((et) => (
                    <button
                      key={et}
                      type="button"
                      onClick={() => toggleEmploymentType(et)}
                      className={
                        employmentTypes.includes(et)
                          ? "rounded-full border border-pine bg-pine px-3 py-1.5 text-xs font-medium text-white"
                          : "rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink hover:border-muted"
                      }
                    >
                      {t(`employmentTypeOption.${et}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={Calendar} title={t("expiresAt")} subtitle={t("expiresAtHint")}>
            <input
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </SectionCard>

          <SectionCard icon={Layers} title={t("techTags")} subtitle={t("techTagsSubtitle")}>
            <div>
              <input
                value={tagFilter}
                onChange={(e) => {
                  setTagFilter(e.target.value);
                  setTechRequestState("idle");
                }}
                placeholder={t("techTagsFilter")}
                className={`${inputClass} w-full`}
              />
              {selectedTags.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {selectedTags.map((sel) => {
                    const tag = techTags.find((tg) => tg.id === sel.id);
                    if (!tag) return null;
                    return (
                      <li key={sel.id} className="flex items-center gap-1.5">
                        <span className="flex items-center gap-1 rounded-full bg-pine/10 py-1 pr-1 pl-3 text-xs font-medium text-pine">
                          {tag.label}
                          <button
                            type="button"
                            onClick={() => updateTagRequired(sel.id, !sel.required)}
                            title={sel.required ? t("mustHave") : t("niceToHave")}
                            aria-label={sel.required ? t("mustHave") : t("niceToHave")}
                            aria-pressed={sel.required}
                            className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-pine/10"
                          >
                            <Star
                              className={sel.required ? "h-3 w-3 fill-pine text-pine" : "h-3 w-3 text-pine/40"}
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleTag(sel.id)}
                            aria-label={t("removeTag", { tag: tag.label })}
                            className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-pine/10"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </span>
                        <LevelSelect value={sel.level} onChange={(level) => updateTagLevel(sel.id, level)} t={t} />
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-line bg-paper p-2">
                <ul className="flex flex-wrap gap-1.5">
                  {filteredTags.slice(0, 60).map((tag) => (
                    <li key={tag.id}>
                      <button
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={
                          selectedTags.some((t) => t.id === tag.id)
                            ? "rounded-md border border-pine bg-pine px-2 py-1 text-xs font-medium text-white"
                            : "rounded-md border border-line bg-white px-2 py-1 text-xs text-ink hover:border-muted"
                        }
                      >
                        {tag.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {tagFilter.trim().length >= 2 && filteredTags.length === 0 && (
                <div className="mt-2 text-xs text-muted">
                  {techRequestState === "rejected" ? (
                    <p>{t("techTagRequestRejected")}</p>
                  ) : (
                    <button
                      type="button"
                      disabled={techRequestState === "pending"}
                      onClick={requestMissingTechTag}
                      className="text-pine hover:underline disabled:opacity-50"
                    >
                      {techRequestState === "pending"
                        ? t("techTagRequestPending")
                        : t("techTagRequestCta", { query: tagFilter.trim() })}
                    </button>
                  )}
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard icon={Globe2} title={t("requiredLanguages")} subtitle={t("requiredLanguagesSubtitle")}>
            <ul className="flex flex-col gap-2.5">
              {spokenLanguages.map((lang) => {
                const sel = selectedLanguages.find((l) => l.id === lang.id);
                return (
                  <li key={lang.id} className="flex items-center justify-between gap-3 text-sm">
                    <label className="flex items-center gap-2 text-ink">
                      <input type="checkbox" checked={!!sel} onChange={() => toggleLanguage(lang.id)} />
                      {lang.label}
                    </label>
                    {sel && <LevelSelect value={sel.level} onChange={(level) => updateLanguageLevel(lang.id, level)} t={t} />}
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-pine hover:text-pine-hover"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          {t("preview")}
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={pending !== null}
            onClick={(e) => handleSubmit(e, false)}
            className={buttonClassName({ variant: "secondary", size: "md" })}
          >
            {t("saveDraft")}
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={(e) => handleSubmit(e, true)}
            className={buttonClassName({ size: "md" })}
          >
            {t("publish")}
          </button>
        </div>
      </div>

      {previewOpen && (
        <JobPreviewModal
          onClose={() => setPreviewOpen(false)}
          title={title}
          description={description}
          companyName={companyName}
          companyLogoUrl={companyLogoUrl}
          workModel={workModel}
          seniority={seniority}
          language={language}
          employmentTypes={employmentTypes}
          locationName={previewLocationName}
          salaryMin={salaryMin.trim() ? Number(salaryMin) : null}
          salaryMax={salaryMax.trim() ? Number(salaryMax) : null}
          salaryPeriod={salaryPeriod}
          salaryMonths={salaryPeriod === "month" ? Number(salaryMonths) || null : null}
          salaryPublic={salaryPublic}
          techStack={previewTechStack}
          requiredLanguages={previewLanguages}
        />
      )}
    </form>
  );
}
