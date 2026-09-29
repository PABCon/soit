"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  updateCandidateProfileAction,
  uploadAvatarAction,
  uploadCvAction,
  saveCandidateBasicsAction,
  getCvSignedUrlAction,
  analyzeStoredCvAction,
  type ParseCvResult,
} from "@/app/[locale]/(candidate)/profile/actions";
import { useAutosave, type AutosaveStatus } from "@/hooks/useAutosave";
import type { CandidateProfile } from "@/lib/db/candidate-profile";
import { CvAutofillReview } from "@/components/candidate/CvAutofillReview";

const inputClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

type AiDraft = Extract<ParseCvResult, { ok: true }>["data"];

function StatusIndicator({ status, t }: { status: AutosaveStatus; t: ReturnType<typeof useTranslations> }) {
  if (status === "pending" || status === "saving") return <span className="text-sm text-muted">{t("saving")}</span>;
  if (status === "saved") return <span className="text-sm text-pine">{t("saved")}</span>;
  return null;
}

/** Basic account facts + CV file — today's original `CandidateProfileForm`
 *  content, minus the freeform `skills` text input (moved to a structured
 *  editor on the Skills & Education tab; `candidates.skills` is a derived
 *  cache column now, never hand-edited here). Also owns the short
 *  headline/years-of-experience summary (its own card), same fields the
 *  CV-autofill draft fills in via `saveCandidateBasicsAction`. Both cards
 *  autosave ~800ms after a change (real-usage feedback: too many explicit
 *  Save clicks). */
export function OverviewSection({
  profile,
  cvSignedUrl,
  headline,
  yearsExperience,
  seededFromDraft = false,
  onDraftReady,
}: {
  profile: CandidateProfile;
  cvSignedUrl: string | null;
  headline: string | null;
  yearsExperience: number | null;
  /** True when this mount's `profile`/`headline`/`yearsExperience` came
   *  from a freshly-parsed AI draft, not the persisted baseline — see
   *  `useAutosave`'s own `skipFirstRun` doc. */
  seededFromDraft?: boolean;
  /** `signedUrl` is passed back up too — this component gets remounted
   *  (tab switches key it) whenever a new draft arrives, so any local
   *  state it set itself would be lost; the parent has to hold the fresh
   *  URL instead and feed it back in via the `cvSignedUrl` prop. A real
   *  bug caught by this phase's own live verification: the preview link
   *  silently reverted to absent after switching tabs, until this was
   *  lifted. */
  onDraftReady: (data: AiDraft, signedUrl: string | null) => void;
}) {
  const t = useTranslations("profile");
  const [basics, setBasics] = useState({ fullName: profile.fullName, phone: profile.phone ?? "", linkedinUrl: profile.linkedinUrl ?? "" });
  const [fileError, setFileError] = useState<string | null>(null);
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [analyzingStored, setAnalyzingStored] = useState(false);

  const basicsStatus = useAutosave(
    basics,
    (value) =>
      updateCandidateProfileAction({
        full_name: value.fullName.trim(),
        phone: value.phone.trim() || null,
        linkedin_url: value.linkedinUrl.trim() || null,
      }),
    800,
    { skipFirstRun: !seededFromDraft },
  );

  const [headlineDraft, setHeadlineDraft] = useState({
    headline: headline ?? "",
    yearsExperience: yearsExperience?.toString() ?? "",
  });
  const headlineStatus = useAutosave(
    headlineDraft,
    (value) =>
      saveCandidateBasicsAction(
        value.headline.trim() || null,
        value.yearsExperience.trim() ? Number(value.yearsExperience) : null,
      ),
    800,
    { skipFirstRun: !seededFromDraft },
  );

  // A full page reload would discard the AI draft this hands up to
  // CandidateProfileForm's in-memory state — refresh just the signed URL
  // instead, client-side, now that "Analyze my CV" always stores the file.
  async function handleDraftReady(data: AiDraft) {
    setAutofillOpen(false);
    const url = await getCvSignedUrlAction();
    onDraftReady(data, url);
  }

  /** Real-usage feedback: "why do I get asked to upload every time I
   *  already have a CV on file?" — when one's already stored, re-analyze
   *  it directly, no upload picker. The plain upload modal (`CvAutofillReview`)
   *  stays available as a secondary "analyze a different file" action. */
  async function handleAnalyzeClick() {
    if (!profile.hasCv) {
      setAutofillOpen(true);
      return;
    }
    setFileError(null);
    setAnalyzingStored(true);
    const result = await analyzeStoredCvAction();
    setAnalyzingStored(false);
    if (!result.ok) {
      setFileError(t(`fileError.${result.reason === "not_a_candidate" ? "not_a_candidate" : "upload_failed"}`));
      return;
    }
    // The file is already stored — cvSignedUrl doesn't change.
    onDraftReady(result.data, cvSignedUrl);
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
            {basics.fullName.slice(0, 1).toUpperCase() || "?"}
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
          disabled={analyzingStored}
          onClick={handleAnalyzeClick}
          className="text-sm font-medium text-pine hover:underline disabled:opacity-50"
        >
          {analyzingStored ? t("analyzing") : t("analyzeCv")}
        </button>
        {profile.hasCv && (
          <button
            type="button"
            onClick={() => setAutofillOpen(true)}
            className="text-xs text-muted hover:text-ink hover:underline"
          >
            {t("analyzeDifferentCv")}
          </button>
        )}
      </div>

      {autofillOpen && <CvAutofillReview onClose={() => setAutofillOpen(false)} onDraftReady={handleDraftReady} />}

      <div className="rounded-lg border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted uppercase">{t("headline")}</span>
          <StatusIndicator status={headlineStatus} t={t} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <label className={labelClass}>
            <span>{t("headline")}</span>
            <input
              value={headlineDraft.headline}
              onChange={(e) => setHeadlineDraft((prev) => ({ ...prev, headline: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            <span>{t("yearsExperienceLabel")}</span>
            <input
              type="number"
              min={0}
              value={headlineDraft.yearsExperience}
              onChange={(e) => setHeadlineDraft((prev) => ({ ...prev, yearsExperience: e.target.value }))}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-white p-4">
        <div className="flex items-center justify-end">
          <StatusIndicator status={basicsStatus} t={t} />
        </div>
        <div className="mt-2 flex flex-col gap-4">
          <label className={labelClass}>
            <span>{t("fullName")}</span>
            <input
              value={basics.fullName}
              onChange={(e) => setBasics((prev) => ({ ...prev, fullName: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            <span>{t("email")}</span>
            <input value={profile.email} disabled className={`${inputClass} bg-paper text-muted`} />
          </label>
          <label className={labelClass}>
            <span>{t("phone")}</span>
            <input
              value={basics.phone}
              onChange={(e) => setBasics((prev) => ({ ...prev, phone: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            <span>{t("linkedinUrl")}</span>
            <input
              type="url"
              value={basics.linkedinUrl}
              onChange={(e) => setBasics((prev) => ({ ...prev, linkedinUrl: e.target.value }))}
              className={inputClass}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
