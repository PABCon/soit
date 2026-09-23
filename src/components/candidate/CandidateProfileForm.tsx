"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  updateProfileAction,
  uploadAvatarAction,
  uploadCvAction,
} from "@/app/[locale]/(candidate)/profile/actions";
import type { CandidateProfile } from "@/lib/db/candidate-profile";

const inputClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

export function CandidateProfileForm({
  profile,
  cvSignedUrl,
}: {
  profile: CandidateProfile;
  cvSignedUrl: string | null;
}) {
  const t = useTranslations("profile");
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl ?? "");
  const [skills, setSkills] = useState(profile.skills.join(", "));
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

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
