"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/Modal";
import {
  parseCvAction,
  applyCvExtractionAction,
  type ParseCvResult,
} from "@/app/[locale]/(candidate)/profile/actions";
import type { SkillLevel } from "@/lib/types";
import type { ExtractedCv } from "@/lib/ai/extract-cv";

type TechTagOption = { id: string; label: string; aliases: string[] };
type SpokenLanguageOption = { id: string; slug: string; label: string };

type DraftSkill = { techTagId: string; label: string; level: SkillLevel | null };
type DraftLanguage = { spokenLanguageId: string; label: string; level: SkillLevel | null };
type DraftEducation = ExtractedCv["education"][number];

const LEVELS: SkillLevel[] = ["basic", "intermediate", "advanced", "expert"];
const fieldClass = "h-8 rounded border border-line bg-white px-2 text-xs";

/** Reuses `jobForm`'s `levelOption`/`levelUnspecified` i18n keys — same
 *  `skill_level` enum, same meaning, no reason to duplicate the strings. */
function LevelSelect({
  value,
  onChange,
  t,
}: {
  value: SkillLevel | null;
  onChange: (level: SkillLevel | null) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || null) as SkillLevel | null)}
      className="h-7 rounded border border-line bg-white px-1 text-xs"
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

/**
 * §AI Pieces backlog, phases 2-4 — upload a CV, review the LLM-extracted
 * draft, edit it, apply to the profile. Used both from the profile page's
 * "Analyze my CV" action and from `CvOnboardingPrompt`'s first-login nudge
 * — same component, two entry points. Deliberately always asks for a fresh
 * upload (no "reuse my already-saved CV" shortcut) — simpler, and a
 * candidate re-analyzing an updated CV is the common case anyway.
 */
export function CvAutofillReview({
  techTags,
  spokenLanguages,
  onClose,
  onApplied,
}: {
  techTags: TechTagOption[];
  spokenLanguages: SpokenLanguageOption[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const t = useTranslations("cvAutofill");
  const jf = useTranslations("jobForm");
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [headline, setHeadline] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [skills, setSkills] = useState<DraftSkill[]>([]);
  const [unmatchedSkills, setUnmatchedSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<DraftLanguage[]>([]);
  const [unmatchedLanguages, setUnmatchedLanguages] = useState<string[]>([]);
  const [education, setEducation] = useState<DraftEducation[]>([]);
  const [skillFilter, setSkillFilter] = useState("");

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result: ParseCvResult = await parseCvAction(formData);
    setBusy(false);
    if (!result.ok) {
      setError(t(`error.${result.reason}`));
      return;
    }
    setHeadline(result.data.headline ?? "");
    setYearsExperience(result.data.yearsExperience?.toString() ?? "");
    setSkills(result.data.matchedSkills.map((s) => ({ techTagId: s.techTagId, label: s.label, level: null })));
    setUnmatchedSkills(result.data.unmatchedSkillLabels);
    setLanguages(
      result.data.matchedLanguages.map((l) => ({
        spokenLanguageId: l.spokenLanguageId,
        label: l.label,
        level: l.level,
      })),
    );
    setUnmatchedLanguages(result.data.unmatchedLanguageLabels);
    setEducation(result.data.education);
    setStep("review");
  }

  function addSkill(tag: TechTagOption) {
    if (skills.some((s) => s.techTagId === tag.id)) return;
    setSkills((prev) => [...prev, { techTagId: tag.id, label: tag.label, level: null }]);
    setUnmatchedSkills((prev) => prev.filter((l) => l.toLowerCase() !== tag.label.toLowerCase()));
  }

  function removeSkill(id: string) {
    setSkills((prev) => prev.filter((s) => s.techTagId !== id));
  }

  function updateSkillLevel(id: string, level: SkillLevel | null) {
    setSkills((prev) => prev.map((s) => (s.techTagId === id ? { ...s, level } : s)));
  }

  function toggleLanguage(lang: SpokenLanguageOption) {
    setLanguages((prev) =>
      prev.some((l) => l.spokenLanguageId === lang.id)
        ? prev.filter((l) => l.spokenLanguageId !== lang.id)
        : [...prev, { spokenLanguageId: lang.id, label: lang.label, level: null }],
    );
  }

  function updateLanguageLevel(id: string, level: SkillLevel | null) {
    setLanguages((prev) => prev.map((l) => (l.spokenLanguageId === id ? { ...l, level } : l)));
  }

  function updateEducation(index: number, patch: Partial<DraftEducation>) {
    setEducation((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function removeEducation(index: number) {
    setEducation((prev) => prev.filter((_, i) => i !== index));
  }

  function addEducation() {
    setEducation((prev) => [
      ...prev,
      { institution: "", degree: null, fieldOfStudy: null, startDate: null, endDate: null, note: null },
    ]);
  }

  async function handleApply() {
    setBusy(true);
    setError(null);
    try {
      await applyCvExtractionAction({
        headline: headline.trim() || null,
        yearsExperience: yearsExperience.trim() ? Number(yearsExperience) : null,
        techTags: skills.map((s) => ({ techTagId: s.techTagId, level: s.level })),
        languages: languages.map((l) => ({ spokenLanguageId: l.spokenLanguageId, level: l.level })),
        education: education
          .filter((e) => e.institution.trim())
          .map((e) => ({
            institution: e.institution.trim(),
            degree: e.degree,
            fieldOfStudy: e.fieldOfStudy,
            startDate: e.startDate,
            endDate: e.endDate,
            note: e.note,
          })),
      });
      onApplied();
      onClose();
    } catch {
      setError(t("error.saveFailed"));
      setBusy(false);
    }
  }

  const filteredTags = techTags.filter((tg) => {
    const q = skillFilter.trim().toLowerCase();
    if (!q) return false;
    return tg.label.toLowerCase().includes(q) && !skills.some((s) => s.techTagId === tg.id);
  });

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-2xl">
      <h2 className="text-lg font-bold">{t("title")}</h2>

      {step === "upload" && (
        <div className="mt-4">
          <p className="text-sm text-muted">{t("uploadHint")}</p>
          {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <label className="mt-4 inline-flex h-10 cursor-pointer items-center rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine/90">
            {busy ? t("analyzing") : t("chooseFile")}
            <input
              type="file"
              accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              disabled={busy}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        </div>
      )}

      {step === "review" && (
        <div className="mt-4 flex flex-col gap-5">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <p className="text-xs text-muted">{t("reviewHint")}</p>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span>{t("headline")}</span>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="h-9 rounded-lg border border-line bg-white px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t("yearsExperience")}</span>
              <input
                type="number"
                min={0}
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
                className="h-9 rounded-lg border border-line bg-white px-3 text-sm"
              />
            </label>
          </div>

          <div>
            <span className="text-sm font-medium">{t("skills")}</span>
            {skills.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <li
                    key={s.techTagId}
                    className="flex items-center gap-1.5 rounded-md border border-pine bg-pine/10 px-2 py-1"
                  >
                    <span className="text-xs font-medium text-pine">{s.label}</span>
                    <LevelSelect value={s.level} onChange={(level) => updateSkillLevel(s.techTagId, level)} t={jf} />
                    <button type="button" onClick={() => removeSkill(s.techTagId)} className="text-xs text-pine">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {unmatchedSkills.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                {t("unmatchedSkills")}: {unmatchedSkills.join(", ")}
              </p>
            )}
            <input
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              placeholder={t("addSkillPlaceholder")}
              className="mt-2 h-9 w-full rounded-lg border border-line bg-white px-3 text-sm"
            />
            {filteredTags.length > 0 && (
              <ul className="mt-1 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-line bg-white p-2">
                {filteredTags.slice(0, 20).map((tag) => (
                  <li key={tag.id}>
                    <button
                      type="button"
                      onClick={() => {
                        addSkill(tag);
                        setSkillFilter("");
                      }}
                      className="rounded-md border border-line px-2 py-0.5 text-xs text-muted hover:border-muted"
                    >
                      {tag.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <span className="text-sm font-medium">{t("languages")}</span>
            <ul className="mt-2 flex flex-col gap-1.5">
              {spokenLanguages.map((lang) => {
                const sel = languages.find((l) => l.spokenLanguageId === lang.id);
                return (
                  <li key={lang.id} className="flex items-center gap-3 text-sm">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={!!sel} onChange={() => toggleLanguage(lang)} />
                      {lang.label}
                    </label>
                    {sel && (
                      <LevelSelect value={sel.level} onChange={(level) => updateLanguageLevel(lang.id, level)} t={jf} />
                    )}
                  </li>
                );
              })}
            </ul>
            {unmatchedLanguages.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                {t("unmatchedLanguages")}: {unmatchedLanguages.join(", ")}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("education")}</span>
              <button type="button" onClick={addEducation} className="text-xs font-medium text-pine hover:underline">
                {t("addEducation")}
              </button>
            </div>
            <ul className="mt-2 flex flex-col gap-3">
              {education.map((entry, i) => (
                <li key={i} className="rounded-lg border border-line p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={entry.institution}
                      onChange={(e) => updateEducation(i, { institution: e.target.value })}
                      placeholder={t("institution")}
                      className={fieldClass}
                    />
                    <input
                      value={entry.degree ?? ""}
                      onChange={(e) => updateEducation(i, { degree: e.target.value || null })}
                      placeholder={t("degree")}
                      className={fieldClass}
                    />
                    <input
                      value={entry.fieldOfStudy ?? ""}
                      onChange={(e) => updateEducation(i, { fieldOfStudy: e.target.value || null })}
                      placeholder={t("fieldOfStudy")}
                      className={fieldClass}
                    />
                    <input
                      value={entry.note ?? ""}
                      onChange={(e) => updateEducation(i, { note: e.target.value || null })}
                      placeholder={t("note")}
                      className={fieldClass}
                    />
                    <input
                      type="date"
                      value={entry.startDate ?? ""}
                      onChange={(e) => updateEducation(i, { startDate: e.target.value || null })}
                      className={fieldClass}
                    />
                    <input
                      type="date"
                      value={entry.endDate ?? ""}
                      onChange={(e) => updateEducation(i, { endDate: e.target.value || null })}
                      className={fieldClass}
                    />
                  </div>
                  <button type="button" onClick={() => removeEducation(i)} className="mt-2 text-xs text-red-700">
                    {t("removeEducation")}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={handleApply}
              className="h-10 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
            >
              {busy ? t("saving") : t("apply")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="h-10 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink hover:border-muted"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
