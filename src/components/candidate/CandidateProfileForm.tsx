"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  updateProfileAction,
  uploadAvatarAction,
  uploadCvAction,
} from "@/app/[locale]/(candidate)/profile/actions";
import type { CandidateProfile, CandidateSkillsAndEducation } from "@/lib/db/candidate-profile";
import { CvAutofillReview } from "@/components/candidate/CvAutofillReview";

const inputClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

type TechTagOption = { id: string; label: string; aliases: string[] };
type SpokenLanguageOption = { id: string; slug: string; label: string };

function formatDateRange(start: string | null, end: string | null, t: ReturnType<typeof useTranslations>): string {
  const from = start ? start.slice(0, 7) : null;
  const to = end ? end.slice(0, 7) : from ? t("present") : null;
  if (!from) return "";
  return `${from} – ${to}`;
}

export function CandidateProfileForm({
  profile,
  cvSignedUrl,
  skillsAndEducation,
  techTags,
  spokenLanguages,
}: {
  profile: CandidateProfile;
  cvSignedUrl: string | null;
  skillsAndEducation: CandidateSkillsAndEducation | null;
  techTags: TechTagOption[];
  spokenLanguages: SpokenLanguageOption[];
}) {
  const t = useTranslations("profile");
  const jf = useTranslations("jobForm");
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl ?? "");
  const [skills, setSkills] = useState(profile.skills.join(", "));
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [autofillOpen, setAutofillOpen] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    const formData = new FormData();
    formData.set("full_name", fullName);
    formData.set("phone", phone);
    formData.set("linkedin_url", linkedinUrl);
    formData.set("skills", skills);
    await updateProfileAction(formData);
    setPending(false);
    setSaved(true);
  }

  async function handleAvatar(file: File) {
    setFileError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadAvatarAction(formData);
    if (!result.ok) {
      setFileError(t(`fileError.${result.reason}`));
      return;
    }
    window.location.reload();
  }

  async function handleCv(file: File) {
    setFileError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadCvAction(formData);
    if (!result.ok) {
      setFileError(t(`fileError.${result.reason}`));
      return;
    }
    window.location.reload();
  }

  return (
    <div className="max-w-xl space-y-6">
      {fileError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fileError}</p>}

      <div className="flex items-center gap-4">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
          <img src={profile.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-pine font-display text-lg font-bold text-white">
            {fullName.slice(0, 1).toUpperCase() || "?"}
          </div>
        )}
        <label className="cursor-pointer text-sm font-medium text-pine hover:underline">
          {t("uploadAvatar")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleAvatar(e.target.files[0])}
          />
        </label>
      </div>

      <div className="flex items-center gap-4">
        <label className="cursor-pointer text-sm font-medium text-pine hover:underline">
          {profile.hasCv ? t("replaceCv") : t("uploadCv")}
          <input
            type="file"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleCv(e.target.files[0])}
          />
        </label>
        {cvSignedUrl && (
          <a href={cvSignedUrl} target="_blank" rel="noreferrer" className="text-sm text-muted hover:text-ink">
            {t("downloadCv")}
          </a>
        )}
        <button
          type="button"
          onClick={() => setAutofillOpen(true)}
          className="text-sm font-medium text-pine hover:underline"
        >
          {t("analyzeCv")}
        </button>
      </div>

      {autofillOpen && (
        <CvAutofillReview
          techTags={techTags}
          spokenLanguages={spokenLanguages}
          onClose={() => setAutofillOpen(false)}
          onApplied={() => window.location.reload()}
        />
      )}

      {skillsAndEducation &&
        (skillsAndEducation.headline ||
          skillsAndEducation.yearsExperience !== null ||
          skillsAndEducation.techTags.length > 0 ||
          skillsAndEducation.languages.length > 0 ||
          skillsAndEducation.education.length > 0) && (
          <div className="flex flex-col gap-4 rounded-lg border border-line bg-paper p-4">
            {skillsAndEducation.headline && (
              <p className="text-sm font-medium text-ink">{skillsAndEducation.headline}</p>
            )}
            {skillsAndEducation.yearsExperience !== null && (
              <p className="text-xs text-muted">
                {t("yearsExperience", { years: skillsAndEducation.yearsExperience })}
              </p>
            )}
            {skillsAndEducation.techTags.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-muted">{t("skillsWithLevel")}</span>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {skillsAndEducation.techTags.map((tag) => (
                    <li
                      key={tag.techTagId}
                      className="rounded-md border border-line bg-white px-2 py-0.5 text-xs text-ink"
                    >
                      {tag.label}
                      {tag.level && <span className="text-muted"> · {jf(`levelOption.${tag.level}`)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {skillsAndEducation.languages.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-muted">{t("languagesWithLevel")}</span>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {skillsAndEducation.languages.map((lang) => (
                    <li
                      key={lang.spokenLanguageId}
                      className="rounded-md border border-line bg-white px-2 py-0.5 text-xs text-ink"
                    >
                      {lang.label}
                      {lang.level && <span className="text-muted"> · {jf(`levelOption.${lang.level}`)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {skillsAndEducation.education.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-muted">{t("educationTitle")}</span>
                <ul className="mt-1 flex flex-col gap-1">
                  {skillsAndEducation.education.map((entry) => (
                    <li key={entry.id} className="text-xs text-ink">
                      <span className="font-medium">{entry.institution}</span>
                      {entry.degree && ` · ${entry.degree}`}
                      {entry.fieldOfStudy && ` · ${entry.fieldOfStudy}`}
                      {(entry.startDate || entry.endDate) && (
                        <span className="text-muted"> ({formatDateRange(entry.startDate, entry.endDate, t)})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className={labelClass}>
          <span>{t("fullName")}</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          <span>{t("email")}</span>
          <input value={profile.email} disabled className={`${inputClass} bg-paper text-muted`} />
        </label>
        <label className={labelClass}>
          <span>{t("phone")}</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          <span>{t("linkedinUrl")}</span>
          <input
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          <span>{t("skills")}</span>
          <input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder={t("skillsHint")}
            className={inputClass}
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
          >
            {t("save")}
          </button>
          {saved && <span className="text-sm text-pine">{t("saved")}</span>}
        </div>
      </form>
    </div>
  );
}
