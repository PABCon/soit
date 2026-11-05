"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonClassName } from "@/components/Button";
import { reviewCvAction, type CreateCvReviewResult } from "@/app/[locale]/(candidate)/avaliar-cv/actions";

type Scored = Extract<CreateCvReviewResult, { ok: true }>;

/**
 * The public growth-loop entry point (§AI Pieces backlog, Track C): upload
 * a CV, see the headline score immediately, create an account to unlock
 * the full breakdown. No auth required for the upload itself — the whole
 * point is proving real value before asking for anything.
 */
export function CvReviewUpload() {
  const t = useTranslations("cvReview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scored, setScored] = useState<Scored | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await reviewCvAction(formData);
    setBusy(false);
    if (!result.ok) {
      setError(t(`error.${result.reason}`));
      return;
    }
    setScored(result);
  }

  if (scored) {
    const resultPath = `/avaliar-cv/resultado?token=${scored.token}`;
    return (
      <div className="rounded-2xl border border-line bg-paper p-8 text-center">
        <p className="text-sm font-medium text-muted">{t("scoreHeading")}</p>
        <p className="mt-1 font-display text-6xl font-bold text-pine">{scored.overallScore}</p>
        <p className="text-sm text-muted">/100</p>
        <p className="mx-auto mt-4 max-w-sm text-sm text-ink">{t("teaserBody")}</p>
        <Link
          href={{ pathname: "/candidate/register", query: { next: resultPath } }}
          className={`mt-6 inline-block ${buttonClassName({ size: "lg" })}`}
        >
          {t("createAccountCta")}
        </Link>
        <p className="mt-3 text-xs text-muted">
          {t("alreadyHaveAccount")}{" "}
          <Link href={{ pathname: "/candidate/login", query: { next: resultPath } }} className="font-medium text-pine hover:underline">
            {t("logIn")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-8 text-center">
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <label
        className={`inline-flex cursor-pointer items-center ${buttonClassName({ size: "lg" })} ${busy ? "pointer-events-none opacity-50" : ""}`}
      >
        {busy ? t("analyzing") : t("chooseFile")}
        <input
          type="file"
          accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </label>
      <p className="mt-3 text-xs text-muted">{t("uploadHint")}</p>
    </div>
  );
}
