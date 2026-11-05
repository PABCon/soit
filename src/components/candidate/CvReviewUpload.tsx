"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { buttonClassName } from "@/components/Button";
import { reviewCvAction, type CreateCvReviewResult } from "@/app/[locale]/(candidate)/avaliar-cv/actions";
import { PENDING_CV_REVIEW_TOKEN_KEY } from "@/components/candidate/CvReviewClaimWatcher";

type Scored = Extract<CreateCvReviewResult, { ok: true }>;

/**
 * Upload a CV, see the headline score immediately. Two different
 * audiences land here now: an anonymous visitor (the original growth-loop
 * case — create an account to unlock the full breakdown) and an
 * already-logged-in candidate (reachable via the Rail's own "CV Score"
 * link). A real bug, caught by the user's own testing: a logged-in
 * candidate used to get the exact same "create an account" prompt as an
 * anonymous visitor, even though they already had one — `claimed` on the
 * action's result (set server-side, see reviewCvAction) now distinguishes
 * the two, and an already-claimed upload skips the prompt entirely and
 * goes straight to the full results.
 */
export function CvReviewUpload() {
  const t = useTranslations("cvReview");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scored, setScored] = useState<Scored | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await reviewCvAction(formData);
    if (!result.ok) {
      setBusy(false);
      setError(t(`error.${result.reason}`));
      return;
    }
    if (result.claimed) {
      router.push(`/avaliar-cv/resultado?token=${result.token}`);
      return;
    }
    // Belt-and-suspenders with the explicit `next=` links below: those
    // cover a direct click on this card's own CTAs, this covers a visitor
    // who instead logs in/registers through the site's main nav (a
    // separate component with no idea a review is in progress) —
    // CvReviewClaimWatcher, mounted once in the candidate shell, picks
    // this up and redirects the moment a session exists.
    try {
      localStorage.setItem(PENDING_CV_REVIEW_TOKEN_KEY, result.token);
    } catch {
      // Private browsing / blocked storage — the explicit next= links
      // still work, so this is a pure enhancement, never load-bearing.
    }
    setBusy(false);
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
