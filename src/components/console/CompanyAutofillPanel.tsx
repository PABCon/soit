"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { autofillCompanyProfileAction, applySuggestedLogoAction } from "@/app/[locale]/(console)/recruit/company/actions";
import type { ExtractedCompanyProfile } from "@/lib/ai/extract-company-profile";

export type AutofillApplyFields = {
  tagline?: string;
  aboutUs?: string;
  industry?: string;
  companySize?: string;
  socials?: Partial<Record<"facebook_url" | "linkedin_url" | "instagram_url" | "youtube_url" | "tiktok_url" | "x_url", string>>;
};

/** "Autofill from website" — fetches the company's own site server-side
 *  and suggests profile fields + a logo. Nothing is saved until the
 *  employer explicitly applies a suggestion and then clicks the real
 *  Save button below (same review-before-save UX as job-URL extraction),
 *  except the logo, which has its own one-click "use this" confirmation
 *  since it uploads immediately (consistent with every other image
 *  change in this form requiring an explicit user action). */
export function CompanyAutofillPanel({
  defaultUrl,
  onApply,
}: {
  defaultUrl: string;
  onApply: (fields: AutofillApplyFields) => void;
}) {
  const t = useTranslations("console");
  const [url, setUrl] = useState(defaultUrl);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ExtractedCompanyProfile | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoPending, setLogoPending] = useState(false);
  const [logoApplied, setLogoApplied] = useState(false);
  const [applied, setApplied] = useState(false);

  async function handleFetch() {
    setPending(true);
    setError(null);
    setResult(null);
    setLogoUrl(null);
    setLogoApplied(false);
    setApplied(false);
    const res = await autofillCompanyProfileAction(url);
    setPending(false);
    if (!res.ok) {
      setError(t(`autofillError.${res.reason}`));
      return;
    }
    setResult(res.data);
    setLogoUrl(res.logoUrl);
  }

  async function handleApplyLogo() {
    if (!logoUrl) return;
    setLogoPending(true);
    const res = await applySuggestedLogoAction(logoUrl);
    setLogoPending(false);
    if (res.ok) {
      setLogoApplied(true);
      window.location.reload();
    } else {
      setError(t(`imageError.${res.reason}`));
    }
  }

  function handleApplyFields() {
    if (!result) return;
    onApply({
      tagline: result.tagline ?? undefined,
      aboutUs: result.aboutUs ?? undefined,
      industry: result.industry ?? undefined,
      companySize: result.companySize ?? undefined,
      socials: {
        facebook_url: result.facebookUrl ?? undefined,
        linkedin_url: result.linkedinUrl ?? undefined,
        instagram_url: result.instagramUrl ?? undefined,
        youtube_url: result.youtubeUrl ?? undefined,
        tiktok_url: result.tiktokUrl ?? undefined,
        x_url: result.xUrl ?? undefined,
      },
    });
    setApplied(true);
  }

  const hasFieldSuggestions =
    result && [result.tagline, result.aboutUs, result.industry, result.companySize].some((v) => v);

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <h2 className="text-sm font-semibold">{t("autofillHeading")}</h2>
      <p className="mt-1 text-xs text-muted">{t("autofillHint")}</p>
      <div className="mt-3 flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="h-9 flex-1 rounded-lg border border-line bg-white px-3 text-sm"
        />
        <button
          type="button"
          onClick={handleFetch}
          disabled={pending || !url}
          className="h-9 shrink-0 rounded-lg bg-pine px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? t("autofillFetching") : t("autofillFetchButton")}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {result && !hasFieldSuggestions && !logoUrl && (
        <p className="mt-3 text-sm text-muted">{t("autofillNothingFound")}</p>
      )}

      {hasFieldSuggestions && (
        <div className="mt-4 space-y-2 rounded-lg border border-line bg-white p-3">
          <p className="text-xs font-medium text-muted">{t("autofillSuggestionsIntro")}</p>
          <ul className="space-y-1 text-sm">
            {result.tagline && <li>{result.tagline}</li>}
            {result.industry && <li>{result.industry}</li>}
            {result.companySize && <li>{result.companySize}</li>}
            {result.aboutUs && <li>{t("autofillAboutUsFound")}</li>}
          </ul>
          <button
            type="button"
            onClick={handleApplyFields}
            disabled={applied}
            className="h-9 rounded-lg border border-pine px-4 text-sm font-medium text-pine hover:bg-paper disabled:opacity-50"
          >
            {applied ? t("autofillApplied") : t("autofillApplyButton")}
          </button>
        </div>
      )}

      {logoUrl && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-line bg-white p-3">
          {/* Arbitrary external source — a plain <img> avoids next/image's domain allowlist for a one-off preview. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" className="h-12 w-12 rounded-lg border border-line object-contain" />
          <button
            type="button"
            onClick={handleApplyLogo}
            disabled={logoPending || logoApplied}
            className="h-9 rounded-lg border border-pine px-4 text-sm font-medium text-pine hover:bg-paper disabled:opacity-50"
          >
            {logoApplied ? t("autofillLogoApplied") : logoPending ? t("autofillFetching") : t("autofillUseLogo")}
          </button>
        </div>
      )}
    </div>
  );
}
