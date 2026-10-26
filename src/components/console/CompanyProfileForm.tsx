"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Clock, AlertTriangle, Upload } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CompanyLogo } from "@/components/CompanyLogo";
import { updateProfileAction, uploadImageAction } from "@/app/[locale]/(console)/recruit/company/actions";
import type { MyCompany, CompanyRichProfileLists } from "@/lib/db/companies";
import type { LocationOption } from "@/lib/db/locations";
import { TopEmployerLockedProfile } from "@/components/console/TopEmployerLockedProfile";
import { TeamMembersSection } from "@/components/console/TeamMembersSection";
import { TestimonialsSection } from "@/components/console/TestimonialsSection";
import { PhotoGallerySection } from "@/components/console/PhotoGallerySection";
import { VideoGallerySection } from "@/components/console/VideoGallerySection";
import { CompanyAutofillPanel, type AutofillApplyFields } from "@/components/console/CompanyAutofillPanel";
import { CompanyProfilePreview } from "@/components/console/CompanyProfilePreview";
import { buttonClassName } from "@/components/Button";

const inputClass = "h-11 rounded-lg border border-line bg-white px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

function VerificationBanner({ status }: { status: MyCompany["verification_status"] }) {
  const t = useTranslations("console");
  if (status === "verified") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-subtle px-4 py-3 text-sm text-pine">
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="font-medium">{t("verifiedBanner")}</span>
      </div>
    );
  }
  if (status === "pending" || status === "unverified") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-800">
        <Clock className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="font-medium">{t("pendingBanner")}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="font-medium">{t("failedBanner")}</span>
    </div>
  );
}

const SOCIAL_FIELDS = ["facebook_url", "linkedin_url", "instagram_url", "youtube_url", "tiktok_url", "x_url"] as const;
type SocialField = (typeof SOCIAL_FIELDS)[number];

export function CompanyProfileForm({
  company,
  canEdit,
  locations,
  richProfile,
}: {
  company: MyCompany;
  canEdit: boolean;
  locations: LocationOption[];
  richProfile: CompanyRichProfileLists;
}) {
  const t = useTranslations("console");
  const [name, setName] = useState(company.company_name);
  const [description, setDescription] = useState(company.company_description ?? "");
  const [website, setWebsite] = useState(company.website ?? "");
  const [industry, setIndustry] = useState(company.industry ?? "");
  const [size, setSize] = useState(company.company_size ?? "");
  const [companyType, setCompanyType] = useState(company.company_type ?? "");
  const [locationId, setLocationId] = useState(company.location_id ?? "");
  const [address, setAddress] = useState(company.address ?? "");
  const [socials, setSocials] = useState<Record<SocialField, string>>({
    facebook_url: company.facebook_url ?? "",
    linkedin_url: company.linkedin_url ?? "",
    instagram_url: company.instagram_url ?? "",
    youtube_url: company.youtube_url ?? "",
    tiktok_url: company.tiktok_url ?? "",
    x_url: company.x_url ?? "",
  });
  const [aboutUs, setAboutUs] = useState(company.about_us_text ?? "");
  const [howWeWork, setHowWeWork] = useState(company.how_we_work_text ?? "");
  const [benefits, setBenefits] = useState(company.benefits_text ?? "");
  const [customTitle, setCustomTitle] = useState(company.custom_section_title ?? "");
  const [customBody, setCustomBody] = useState(company.custom_section_body ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageSuccess, setImageSuccess] = useState<"logo" | "cover" | null>(null);
  const [logoPreview, setLogoPreview] = useState(company.company_logo_url);
  const [coverPreview, setCoverPreview] = useState(company.cover_image_url);
  const [showPreview, setShowPreview] = useState(false);
  // Not a `companies` field — these don't have a single scalar home to
  // prefill into (they're rows `TeamMembersSection` manages itself), so
  // they're just handed down as a one-time "here's what we found" list
  // instead, same as every other autofill suggestion: nothing is added to
  // the real list until the employer clicks to add it there.
  const [suggestedTeamMembers, setSuggestedTeamMembers] = useState<{ name: string; role: string | null }[]>([]);

  const isTopEmployer = company.top_employer_active;

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
    formData.set("location_id", locationId);
    formData.set("address", address);
    for (const field of SOCIAL_FIELDS) formData.set(field, socials[field]);
    formData.set("about_us_text", aboutUs);
    formData.set("how_we_work_text", howWeWork);
    formData.set("benefits_text", benefits);
    formData.set("custom_section_title", customTitle);
    formData.set("custom_section_body", customBody);
    await updateProfileAction(formData);
    setPending(false);
    setSaved(true);
  }

  function handleAutofillApply(fields: AutofillApplyFields) {
    // Only prefills fields that are currently empty — never silently
    // overwrites something the employer already entered.
    if (fields.website && !website) setWebsite(fields.website);
    if (fields.tagline && !description) setDescription(fields.tagline);
    if (fields.aboutUs && !aboutUs) setAboutUs(fields.aboutUs);
    if (fields.industry && !industry) setIndustry(fields.industry);
    if (fields.companySize && !size) setSize(fields.companySize);
    if (fields.benefitsText && !benefits) setBenefits(fields.benefitsText);
    if (fields.howWeWorkText && !howWeWork) setHowWeWork(fields.howWeWorkText);
    if (fields.address && !address) setAddress(fields.address);
    if (fields.socials) {
      setSocials((prev) => {
        const next = { ...prev };
        for (const field of SOCIAL_FIELDS) {
          const suggested = fields.socials?.[field];
          if (suggested && !prev[field]) next[field] = suggested;
        }
        return next;
      });
    }
    if (fields.teamMembers) setSuggestedTeamMembers(fields.teamMembers);
  }

  async function handleImage(field: "logo" | "cover", file: File) {
    setImageError(null);
    setImageSuccess(null);
    const setPreview = field === "logo" ? setLogoPreview : setCoverPreview;
    const previousPreview = field === "logo" ? logoPreview : coverPreview;
    // Show the picked file immediately — no need to wait on the upload
    // round trip to see it, and (unlike the full-page reload this used to
    // do) nothing else on the form gets reset in the meantime.
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadImageAction(field, formData);
    if (!result.ok) {
      setPreview(previousPreview);
      setImageError(t(`imageError.${result.reason}`));
      return;
    }
    setImageSuccess(field);
  }

  if (!canEdit) {
    return (
      <div className="max-w-xl space-y-4">
        <VerificationBanner status={company.verification_status} />
        <p className="text-sm text-muted">{t("ownerOnly")}</p>
      </div>
    );
  }

  const saveControls = (
    <div className="flex items-center gap-4">
      <button type="submit" disabled={pending} className={buttonClassName({ size: "md" })}>
        {t("save")}
      </button>
      {saved && <span className="text-sm text-pine">{t("saved")}</span>}
      <Link href={`/companies/${company.slug}/preview`} target="_blank" className="text-sm font-medium text-pine hover:underline">
        {t("viewPublicProfile")}
      </Link>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <VerificationBanner status={company.verification_status} />
      {imageError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{imageError}</p>}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-ink">{t("companyLogo")}</p>
          <div className="mt-2 flex items-center gap-4">
            <CompanyLogo company={{ slug: "", name: company.company_name, logoUrl: logoPreview }} size="lg" />
            <div>
              <label className={`${buttonClassName({ variant: "secondary", size: "md" })} cursor-pointer`}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                {t("uploadLogo")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImage("logo", e.target.files[0])}
                />
              </label>
              <p className="mt-2 text-xs text-muted">{t("logoRecommendedSize")}</p>
              <p className="text-xs text-muted">{t("logoFileHint")}</p>
              {imageSuccess === "logo" && <p className="mt-1 text-xs text-pine">{t("imageUploaded")}</p>}
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-ink">{t("coverImage")}</p>
          <div className="mt-2 flex items-center gap-4">
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL or a transient local object URL
              <img src={coverPreview} alt="" className="h-16 w-28 shrink-0 rounded-lg border border-line object-cover" />
            ) : (
              <div className="h-16 w-28 shrink-0 rounded-lg bg-gradient-to-br from-pine to-mint" aria-hidden="true" />
            )}
            <div>
              <label className={`${buttonClassName({ variant: "secondary", size: "md" })} cursor-pointer`}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                {t("uploadCover")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImage("cover", e.target.files[0])}
                />
              </label>
              <p className="mt-2 text-xs text-muted">{t("coverRecommendedSize")}</p>
              <p className="text-xs text-muted">{t("coverFileHint")}</p>
              {imageSuccess === "cover" && <p className="mt-1 text-xs text-pine">{t("imageUploaded")}</p>}
            </div>
          </div>
        </div>
      </div>

      <CompanyAutofillPanel
        defaultUrl={website}
        onApply={handleAutofillApply}
        onLogoApplied={(sourceUrl) => {
          setLogoPreview(sourceUrl);
          setImageSuccess("logo");
        }}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            <span className="font-medium text-ink">{t("companyName")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            <span className="font-medium text-ink">{t("website")}</span>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} />
          </label>
        </div>
        <label className={labelClass}>
          <span className="font-medium text-ink">{t("description")}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={`${inputClass} h-auto py-2`}
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            <span className="font-medium text-ink">{t("industry")}</span>
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            <span className="font-medium text-ink">{t("companySize")}</span>
            <input value={size} onChange={(e) => setSize(e.target.value)} className={inputClass} />
          </label>
        </div>
        <label className={labelClass}>
          <span className="font-medium text-ink">{t("companyType")}</span>
          <input value={companyType} onChange={(e) => setCompanyType(e.target.value)} className={inputClass} />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            <span className="font-medium text-ink">{t("location")}</span>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputClass}>
              <option value="">{t("locationPlaceholder")}</option>
              <optgroup label={t("locationGroupPortugal")}>
                {locations
                  .filter((l) => l.country === "Portugal")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </optgroup>
              {locations.some((l) => l.country !== "Portugal") && (
                <optgroup label={t("locationGroupOtherEurope")}>
                  {locations
                    .filter((l) => l.country !== "Portugal")
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.country})
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </label>
          <label className={labelClass}>
            <span className="font-medium text-ink">{t("address")}</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
          </label>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-ink">{t("socialLinks")}</legend>
          <div className="grid grid-cols-2 gap-4">
            {SOCIAL_FIELDS.map((field) => (
              <label key={field} className={labelClass}>
                <span className="font-medium text-ink">{t(field.replace("_url", ""))}</span>
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

        <div>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="text-sm font-medium text-pine hover:underline"
          >
            {showPreview ? t("previewHide") : t("previewShow")}
          </button>
          {showPreview && (
            <div className="mt-3 max-w-md">
              <CompanyProfilePreview
                name={name}
                description={description}
                logoUrl={logoPreview}
                coverUrl={coverPreview}
                aboutUs={aboutUs}
                howWeWork={howWeWork}
                benefits={benefits}
                customTitle={customTitle}
                customBody={customBody}
              />
            </div>
          )}
        </div>

        {/* Non-Top-Employer companies only ever see the rich-profile section
         *  as a locked upsell below — placing Save after that section made
         *  it look like saving itself was gated too. Save now sits right
         *  after the fields a non-Top-Employer company can actually use;
         *  Top Employer companies keep it at the end, after their own
         *  (now unlocked) rich-profile fields. */}
        {!isTopEmployer && saveControls}

        {isTopEmployer && (
          <fieldset className="flex flex-col gap-4">
            <legend className="text-sm font-medium text-ink">{t("richProfileHeading")}</legend>
            <label className={labelClass}>
              <span className="font-medium text-ink">{t("richProfileAboutUs")}</span>
              <textarea
                value={aboutUs}
                onChange={(e) => setAboutUs(e.target.value)}
                placeholder={t("richProfileAboutUsPlaceholder")}
                rows={3}
                className={`${inputClass} h-auto py-2`}
              />
            </label>
            <label className={labelClass}>
              <span className="font-medium text-ink">{t("richProfileHowWeWork")}</span>
              <textarea
                value={howWeWork}
                onChange={(e) => setHowWeWork(e.target.value)}
                placeholder={t("richProfileHowWeWorkPlaceholder")}
                rows={3}
                className={`${inputClass} h-auto py-2`}
              />
            </label>
            <label className={labelClass}>
              <span className="font-medium text-ink">{t("richProfileBenefits")}</span>
              <textarea
                value={benefits}
                onChange={(e) => setBenefits(e.target.value)}
                placeholder={t("richProfileBenefitsPlaceholder")}
                rows={3}
                className={`${inputClass} h-auto py-2`}
              />
            </label>
            <label className={labelClass}>
              <span className="font-medium text-ink">{t("richProfileCustomSectionTitle")}</span>
              <input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={t("richProfileCustomSectionTitlePlaceholder")}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className="font-medium text-ink">{t("richProfileCustomSectionBody")}</span>
              <textarea
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                placeholder={t("richProfileCustomSectionBodyPlaceholder")}
                rows={3}
                className={`${inputClass} h-auto py-2`}
              />
            </label>
          </fieldset>
        )}

        {isTopEmployer && saveControls}
      </form>

      {isTopEmployer ? (
        <div className="space-y-6">
          <TeamMembersSection members={richProfile.teamMembers} suggested={suggestedTeamMembers} />
          <TestimonialsSection testimonials={richProfile.testimonials} />
          <PhotoGallerySection photos={richProfile.galleryPhotos} />
          <VideoGallerySection videos={richProfile.galleryVideos} />
        </div>
      ) : (
        <TopEmployerLockedProfile />
      )}
    </div>
  );
}
