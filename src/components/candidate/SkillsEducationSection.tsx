"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LevelSelect } from "@/components/LevelSelect";
import {
  saveCandidateSkillsAction,
  saveCandidateLanguagesAction,
  saveCandidateEducationAction,
  saveCandidateCertificationsAction,
} from "@/app/[locale]/(candidate)/profile/actions";
import { useAutosave, type AutosaveStatus } from "@/hooks/useAutosave";
import type { CandidateSkillsAndEducation, CandidateCertificationEntry } from "@/lib/db/candidate-profile";
import type { SkillLevel } from "@/lib/types";

type TechTagOption = { id: string; label: string; aliases: string[] };
type SpokenLanguageOption = { id: string; slug: string; label: string };

type DraftSkill = { techTagId: string; label: string; level: SkillLevel | null };
type DraftLanguage = { spokenLanguageId: string; label: string; level: SkillLevel | null };
type DraftEducation = {
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
  note: string | null;
};
type DraftCertification = { name: string; issuer: string | null; issuedDate: string | null };

const fieldClass = "h-8 rounded border border-line bg-white px-2 text-xs";
const cardClass = "rounded-lg border border-line bg-white p-4";

function StatusIndicator({ status, t }: { status: AutosaveStatus; t: ReturnType<typeof useTranslations> }) {
  if (status === "pending" || status === "saving") return <span className="text-xs text-muted">{t("saving")}</span>;
  if (status === "saved") return <span className="text-xs text-pine">{t("saved")}</span>;
  return null;
}

/**
 * §AI Pieces backlog, profile-depth phase — four independent cards
 * (Skills, Languages, Education, Certifications), each with its own
 * always-editable state, autosaving ~800ms after any change (real-usage
 * feedback: an explicit "Save changes" button per card was too much
 * friction). This is the persistent editing surface `CvAutofillReview`'s
 * AI draft prefills into instead of writing straight to the database on
 * its own — editing an AI-derived result and editing by hand are the
 * exact same UI.
 */
export function SkillsEducationSection({
  skillsAndEducation,
  certifications,
  techTags,
  spokenLanguages,
  unmatchedSkillLabels = [],
  unmatchedLanguageLabels = [],
  seededFromDraft = false,
}: {
  skillsAndEducation: CandidateSkillsAndEducation | null;
  certifications: CandidateCertificationEntry[];
  techTags: TechTagOption[];
  spokenLanguages: SpokenLanguageOption[];
  /** From a just-applied AI draft (§ profile-depth phase 3) — labels the
   *  CV mentioned that don't match the real vocab, surfaced once so
   *  they're not silently lost; search-to-add above covers adding them. */
  unmatchedSkillLabels?: string[];
  unmatchedLanguageLabels?: string[];
  /** True when this mount's initial data came from a freshly-parsed AI
   *  draft, not the persisted baseline — see `useAutosave`'s own
   *  `skipFirstRun` doc. */
  seededFromDraft?: boolean;
}) {
  const t = useTranslations("skillsEducation");
  const autosaveOpts = { skipFirstRun: !seededFromDraft };

  const [skills, setSkills] = useState<DraftSkill[]>(
    (skillsAndEducation?.techTags ?? []).map((s) => ({ techTagId: s.techTagId, label: s.label, level: s.level })),
  );
  const [skillFilter, setSkillFilter] = useState("");
  const skillsStatus = useAutosave(
    skills,
    (value) => saveCandidateSkillsAction(value.map((s) => ({ techTagId: s.techTagId, level: s.level }))),
    800,
    autosaveOpts,
  );

  const [languages, setLanguages] = useState<DraftLanguage[]>(
    (skillsAndEducation?.languages ?? []).map((l) => ({
      spokenLanguageId: l.spokenLanguageId,
      label: l.label,
      level: l.level,
    })),
  );
  const languagesStatus = useAutosave(
    languages,
    (value) => saveCandidateLanguagesAction(value.map((l) => ({ spokenLanguageId: l.spokenLanguageId, level: l.level }))),
    800,
    autosaveOpts,
  );

  const [education, setEducation] = useState<DraftEducation[]>(
    (skillsAndEducation?.education ?? []).map((e) => ({
      institution: e.institution,
      degree: e.degree,
      fieldOfStudy: e.fieldOfStudy,
      startDate: e.startDate,
      endDate: e.endDate,
      note: e.note,
    })),
  );
  const educationStatus = useAutosave(
    education,
    (value) => saveCandidateEducationAction(value.filter((e) => e.institution.trim())),
    800,
    autosaveOpts,
  );

  const [certs, setCerts] = useState<DraftCertification[]>(
    certifications.map((c) => ({ name: c.name, issuer: c.issuer, issuedDate: c.issuedDate })),
  );
  const certsStatus = useAutosave(
    certs,
    (value) => saveCandidateCertificationsAction(value.filter((c) => c.name.trim())),
    800,
    autosaveOpts,
  );

  function addSkill(tag: TechTagOption) {
    if (skills.some((s) => s.techTagId === tag.id)) return;
    setSkills((prev) => [...prev, { techTagId: tag.id, label: tag.label, level: null }]);
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

  function updateEducation(i: number, patch: Partial<DraftEducation>) {
    setEducation((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function addEducation() {
    setEducation((prev) => [
      ...prev,
      { institution: "", degree: null, fieldOfStudy: null, startDate: null, endDate: null, note: null },
    ]);
  }
  function removeEducation(i: number) {
    setEducation((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateCert(i: number, patch: Partial<DraftCertification>) {
    setCerts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addCert() {
    setCerts((prev) => [...prev, { name: "", issuer: null, issuedDate: null }]);
  }
  function removeCert(i: number) {
    setCerts((prev) => prev.filter((_, idx) => idx !== i));
  }

  const filteredTags = techTags.filter((tg) => {
    const q = skillFilter.trim().toLowerCase();
    if (!q) return false;
    return tg.label.toLowerCase().includes(q) && !skills.some((s) => s.techTagId === tg.id);
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t("skills")}</span>
          <StatusIndicator status={skillsStatus} t={t} />
        </div>
        {skills.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <li
                key={s.techTagId}
                className="flex items-center gap-1.5 rounded-md border border-pine bg-pine/10 px-2 py-1"
              >
                <span className="text-xs font-medium text-pine">{s.label}</span>
                <LevelSelect value={s.level} onChange={(level) => updateSkillLevel(s.techTagId, level)} />
                <button type="button" onClick={() => removeSkill(s.techTagId)} className="text-xs text-pine">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {unmatchedSkillLabels.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            {t("unmatchedSkills")}: {unmatchedSkillLabels.join(", ")}
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

      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t("languages")}</span>
          <StatusIndicator status={languagesStatus} t={t} />
        </div>
        <ul className="mt-2 flex flex-col gap-1.5">
          {spokenLanguages.map((lang) => {
            const sel = languages.find((l) => l.spokenLanguageId === lang.id);
            return (
              <li key={lang.id} className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={!!sel} onChange={() => toggleLanguage(lang)} />
                  {lang.label}
                </label>
                {sel && <LevelSelect value={sel.level} onChange={(level) => updateLanguageLevel(lang.id, level)} />}
              </li>
            );
          })}
        </ul>
        {unmatchedLanguageLabels.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            {t("unmatchedLanguages")}: {unmatchedLanguageLabels.join(", ")}
          </p>
        )}
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t("education")}</span>
          <div className="flex items-center gap-3">
            <StatusIndicator status={educationStatus} t={t} />
            <button type="button" onClick={addEducation} className="text-xs font-medium text-pine hover:underline">
              {t("addEducation")}
            </button>
          </div>
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
                {t("remove")}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t("certifications")}</span>
          <div className="flex items-center gap-3">
            <StatusIndicator status={certsStatus} t={t} />
            <button type="button" onClick={addCert} className="text-xs font-medium text-pine hover:underline">
              {t("addCertification")}
            </button>
          </div>
        </div>
        <ul className="mt-2 flex flex-col gap-3">
          {certs.map((c, i) => (
            <li key={i} className="rounded-lg border border-line p-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={c.name}
                  onChange={(e) => updateCert(i, { name: e.target.value })}
                  placeholder={t("certificationName")}
                  className={fieldClass}
                />
                <input
                  value={c.issuer ?? ""}
                  onChange={(e) => updateCert(i, { issuer: e.target.value || null })}
                  placeholder={t("issuer")}
                  className={fieldClass}
                />
                <input
                  type="date"
                  value={c.issuedDate ?? ""}
                  onChange={(e) => updateCert(i, { issuedDate: e.target.value || null })}
                  className={fieldClass}
                />
              </div>
              <button type="button" onClick={() => removeCert(i)} className="mt-2 text-xs text-red-700">
                {t("remove")}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
