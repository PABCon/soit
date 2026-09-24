"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CompanyLogo } from "@/components/CompanyLogo";
import { updateProfileAction, uploadImageAction } from "@/app/[locale]/(console)/recruit/company/actions";
import type { MyCompany } from "@/lib/db/companies";

const inputClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

function VerificationBanner({ status }: { status: MyCompany["verification_status"] }) {
  const t = useTranslations("console");
  if (status === "verified") {
    return <p className="rounded-lg bg-mint/20 px-3 py-2 text-sm text-pine">{t("verifiedBanner")}</p>;
  }
  if (status === "pending" || status === "unverified") {
    return <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("pendingBanner")}</p>;
  }
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{t("failedBanner")}</p>;
}

const SOCIAL_FIELDS = ["facebook_url", "linkedin_url", "instagram_url", "youtube_url", "tiktok_url", "x_url"] as const;
type SocialField = (typeof SOCIAL_FIELDS)[number];

export function CompanyProfileForm({ company, canEdit }: { company: MyCompany; canEdit: boolean }) {
  const t = useTranslations("console");
  const [name, setName] = useState(company.company_name);
  const [description, setDescription] = useState(company.company_description ?? "");
  const [website, setWebsite] = useState(company.website ?? "");
  const [industry, setIndustry] = useState(company.industry ?? "");
  const [size, setSize] = useState(company.company_size ?? "");
  const [companyType, setCompanyType] = useState(company.company_type ?? "");
  const [socials, setSocials] = useState<Record<SocialField, string>>({
    facebook_url: company.facebook_url ?? "",
    linkedin_url: company.linkedin_url ?? "",
    instagram_url: company.instagram_url ?? "",
    youtube_url: company.youtube_url ?? "",
    tiktok_url: company.tiktok_url ?? "",
    x_url: company.x_url ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    const formData = new FormData();
    formData.set("company_name", name);
    formData.set("company_description", description);
    formData.set("website", website);
    formData.set("industry", industry);
    formData.set("company_size", size);
    formData.set("company_type", companyType);
    for (const field of SOCIAL_FIELDS) formData.set(field, socials[field]);
    await updateProfileAction(formData);
    setPending(false);
    setSaved(true);
  }

  async function handleImage(field: "logo" | "cover", file: File) {
    setImageError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadImageAction(field, formData);
    if (!result.ok) {
      setImageError(t(`imageError.${result.reason}`));
      return;
    }
    window.location.reload();
  }

  if (!canEdit) {
    return (
      <div className="max-w-xl space-y-4">
        <VerificationBanner status={company.verification_status} />
        <p className="text-sm text-muted">{t("ownerOnly")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <VerificationBanner status={company.verification_status} />
      {imageError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{imageError}</p>}

      <div className="flex items-center gap-4">
        <CompanyLogo company={{ slug: "", name: company.company_name, logoUrl: company.company_logo_url }} size="lg" />
        <label className="cursor-pointer text-sm font-medium text-pine hover:underline">
          {t("uploadLogo")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImage("logo", e.target.files[0])}
          />
        </label>
      </div>

      <label className="cursor-pointer text-sm font-medium text-pine hover:underline">
        {t("uploadCover")}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleImage("cover", e.target.files[0])}
        />
      </label>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className={labelClass}>
          <span>{t("companyName")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          <span>{t("description")}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={`${inputClass} h-auto py-2`}
          />
        </label>
        <label className={labelClass}>
          <span>{t("website")}</span>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            <span>{t("industry")}</span>
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            <span>{t("companySize")}</span>
            <input value={size} onChange={(e) => setSize(e.target.value)} className={inputClass} />
          </label>
        </div>
        <label className={labelClass}>
          <span>{t("companyType")}</span>
          <input value={companyType} onChange={(e) => setCompanyType(e.target.value)} className={inputClass} />
        </label>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">{t("socialLinks")}</legend>
          <div className="grid grid-cols-2 gap-4">
            {SOCIAL_FIELDS.map((field) => (
              <label key={field} className={labelClass}>
                <span>{t(field.replace("_url", ""))}</span>
                <input
                  type="url"
                  value={socials[field]}
                  onChange={(e) => setSocials((s) => ({ ...s, [field]: e.target.value }))}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
          >
            {t("save")}
          </button>
          {saved && <span className="text-sm text-pine">{t("saved")}</span>}
          <Link
            href={`/companies/${company.slug}/preview`}
            target="_blank"
            className="text-sm text-pine hover:underline"
          >
            {t("viewPublicProfile")}
          </Link>
        </div>
      </form>
    </div>
  );
}
