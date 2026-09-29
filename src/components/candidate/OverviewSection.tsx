"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  updateProfileAction,
  uploadAvatarAction,
  uploadCvAction,
  saveCandidateBasicsAction,
} from "@/app/[locale]/(candidate)/profile/actions";
import type { CandidateProfile } from "@/lib/db/candidate-profile";
import { CvAutofillReview } from "@/components/candidate/CvAutofillReview";

const inputClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

type TechTagOption = { id: string; label: string; aliases: string[] };
type SpokenLanguageOption = { id: string; slug: string; label: string };

/** Basic account facts + CV file — today's original `CandidateProfileForm`
 *  content, minus the freeform `skills` text input (moved to a structured
 *  editor on the Skills & Education tab; `candidates.skills` is a derived
 *  cache column now, never hand-edited here). Also owns the short
 *  headline/years-of-experience summary (its own card, own Save) — the
 *  natural "Overview" home for it, same fields the CV-autofill draft fills
 *  in via `saveCandidateBasicsAction`. */
export function OverviewSection({
  profile,
  cvSignedUrl,
  headline,
  yearsExperience,
  techTags,
  spokenLanguages,
  onAnalyzed,
}: {
  profile: CandidateProfile;
  cvSignedUrl: string | null;
  headline: string | null;
  yearsExperience: number | null;
  techTags: TechTagOption[];
  spokenLanguages: SpokenLanguageOption[];
  onAnalyzed: () => void;
}) {
  const t = useTranslations("profile");
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [autofillOpen, setAutofillOpen] = useState(false);

  const [headlineValue, setHeadlineValue] = useState(headline ?? "");
  const [yearsValue, setYearsValue] = useState(yearsExperience?.toString() ?? "");
  const [basicsSaved, setBasicsSaved] = useState(false);
  const [basicsPending, setBasicsPending] = useState(false);

  async function saveBasics() {
    setBasicsPending(true);
    await saveCandidateBasicsAction(headlineValue.trim() || null, yearsValue.trim() ? Number(yearsValue) : null);
    setBasicsPending(false);
    setBasicsSaved(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    const formData = new FormData();
    formData.set("full_name", fullName);
    formData.set("phone", phone);
    formData.set("linkedin_url", linkedinUrl);
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

      <div className="flex flex-wrap items-center gap-4">
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
            {t("previewOrDownloadCv")}
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
          onApplied={onAnalyzed}
        />
      )}

      <div className="rounded-lg border border-line bg-white p-4">
        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            <span>{t("headline")}</span>
            <input
              value={headlineValue}
              onChange={(e) => {
                setHeadlineValue(e.target.value);
                setBasicsSaved(false);
              }}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            <span>{t("yearsExperienceLabel")}</span>
            <input
              type="number"
              min={0}
              value={yearsValue}
              onChange={(e) => {
                setYearsValue(e.target.value);
                setBasicsSaved(false);
              }}
              className={inputClass}
            />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={basicsPending}
            onClick={saveBasics}
            className="h-9 rounded-lg bg-pine px-3 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
          >
            {basicsPending ? t("saving") : t("saveChanges")}
          </button>
          {basicsSaved && <span className="text-sm text-pine">{t("saved")}</span>}
        </div>
      </div>

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
