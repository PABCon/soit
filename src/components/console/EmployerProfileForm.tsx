"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { updateMyProfileAction, uploadMyAvatarAction } from "@/app/[locale]/(console)/recruit/settings/actions";
import { buttonClassName } from "@/components/Button";

const inputClass = "h-11 rounded-lg border border-line bg-white px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

export function EmployerProfileForm({
  initialFullName,
  initialPhone,
  email,
  avatarUrl,
}: {
  initialFullName: string;
  initialPhone: string;
  email: string;
  avatarUrl: string | null;
}) {
  const t = useTranslations("console");
  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);
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
    await updateMyProfileAction(formData);
    setPending(false);
    setSaved(true);
  }

  async function handleAvatar(file: File) {
    setFileError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadMyAvatarAction(formData);
    if (!result.ok) {
      setFileError(t(`avatarError.${result.reason}`));
      return;
    }
    window.location.reload();
  }

  return (
    <div className="rounded-xl border border-line bg-white p-6">
      <h2 className="text-lg font-semibold text-ink">{t("myProfile")}</h2>
      <p className="mt-1 text-sm text-muted">{t("myProfileSubtitle")}</p>

      {fileError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fileError}</p>}

      <div className="mt-5 flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
          <img src={avatarUrl} alt="" className="h-20 w-20 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-pine font-display text-xl font-bold text-white">
            {fullName.slice(0, 1).toUpperCase() || "?"}
          </div>
        )}
        <div>
          <label className={`${buttonClassName({ variant: "secondary", size: "md" })} cursor-pointer`}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            {t("changePhoto")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleAvatar(e.target.files[0])}
            />
          </label>
          <p className="mt-2 text-xs text-muted">{t("avatarRecommendedSize")}</p>
          <p className="text-xs text-muted">{t("avatarFileHint")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          <span className="font-medium text-ink">{t("fullName")}</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          <span className="font-medium text-ink">{t("email")}</span>
          <input value={email} disabled className={`${inputClass} bg-paper text-muted`} />
        </label>
        <label className={labelClass}>
          <span className="font-medium text-ink">{t("phone")}</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </label>

        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className={buttonClassName({ size: "md" })}>
            {t("saveProfile")}
          </button>
          {saved && <span className="text-sm text-pine">{t("saved")}</span>}
        </div>
      </form>
    </div>
  );
}
