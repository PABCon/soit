"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/Modal";
import { CvAutofillReview } from "@/components/candidate/CvAutofillReview";
import {
  dismissCvPromptAction,
  saveCandidateBasicsAction,
  saveCandidateSkillsAction,
  saveCandidateLanguagesAction,
  saveCandidateEducationAction,
  saveCandidateCertificationsAction,
  saveCandidateExperienceAction,
  type ParseCvResult,
} from "@/app/[locale]/(candidate)/profile/actions";

type AiDraft = Extract<ParseCvResult, { ok: true }>["data"];

/**
 * §AI Pieces backlog, phase 4 — original item 1's "first-login popup," now
 * CV-only (LinkedIn fetch dropped — see plan). "First login" is expressed
 * as "hasn't uploaded a CV and hasn't dismissed this yet" (`!cv_url &&
 * !cv_prompt_dismissed`) rather than a literal login-count check — simpler,
 * and self-correcting: a candidate who uploads later never sees it again
 * regardless of dismiss state. Client-only, same pattern `LoginMenu.tsx`
 * already uses to read the browser session and the candidate's own row.
 *
 * Unlike the profile page's own "Analyze my CV" (which hands the draft up
 * to the persistent, always-editable tabs for review), this popup can
 * appear on *any* page, with no tab UI to hand off to — so it applies the
 * AI draft directly via the same granular save actions the tabs
 * themselves use (no bespoke bundled-apply path resurrected), then
 * reloads. The result lands in the exact same tables either way, so
 * editing it afterward on `/profile` works identically regardless of
 * which entry point populated it.
 */
export function CvOnboardingPrompt() {
  const t = useTranslations("cvOnboarding");
  const [visible, setVisible] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    async function check() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: candidate } = await supabase
        .from("candidates")
        .select("cv_url, cv_prompt_dismissed")
        .maybeSingle();
      if (candidate && !candidate.cv_url && !candidate.cv_prompt_dismissed) setVisible(true);
    }
    check();
  }, []);

  async function skip() {
    setVisible(false);
    await dismissCvPromptAction();
  }

  async function applyDraft(data: AiDraft) {
    await Promise.all([
      saveCandidateBasicsAction(data.headline, data.yearsExperience),
      saveCandidateSkillsAction(data.matchedSkills.map((s) => ({ techTagId: s.techTagId, level: null }))),
      saveCandidateLanguagesAction(
        data.matchedLanguages.map((l) => ({ spokenLanguageId: l.spokenLanguageId, level: l.level })),
      ),
      saveCandidateEducationAction(data.education),
      saveCandidateCertificationsAction(data.certifications),
      saveCandidateExperienceAction(data.experience),
    ]);
    window.location.reload();
  }

  if (reviewOpen) {
    return <CvAutofillReview onClose={() => setReviewOpen(false)} onDraftReady={applyDraft} />;
  }

  if (!visible) return null;

  return (
    <Modal onClose={skip}>
      <h2 className="text-lg font-bold">{t("title")}</h2>
      <p className="mt-2 text-sm text-muted">{t("body")}</p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            setReviewOpen(true);
          }}
          className="h-10 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine/90"
        >
          {t("upload")}
        </button>
        <button
          type="button"
          onClick={skip}
          className="h-10 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink hover:border-muted"
        >
          {t("skip")}
        </button>
      </div>
    </Modal>
  );
}
