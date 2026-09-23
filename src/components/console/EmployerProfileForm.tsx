"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { updateMyProfileAction, uploadMyAvatarAction } from "@/app/[locale]/(console)/recruit/settings/actions";

const inputClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

export function EmployerProfileForm({
  initialFullName,
  avatarUrl,
}: {
  initialFullName: string;
  avatarUrl: string | null;
}) {
  const t = useTranslations("console");
  const [fullName, setFullName] = useState(initialFullName);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    const formData = new FormData();
    formData.set("full_name", fullName);
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
    <div className="max-w-xl space-y-4">
      {fileError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fileError}</p>}

      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
          <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
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

      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
        <label className={labelClass}>
          <span>{t("fullName")}</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
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
