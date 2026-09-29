"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/Modal";
import { CvAutofillReview } from "@/components/candidate/CvAutofillReview";
import { dismissCvPromptAction } from "@/app/[locale]/(candidate)/profile/actions";
import { getVocabClient } from "@/lib/db/tech-tags-client";

type TechTagOption = { id: string; label: string; aliases: string[] };
type SpokenLanguageOption = { id: string; slug: string; label: string };

/**
 * §AI Pieces backlog, phase 4 — original item 1's "first-login popup," now
 * CV-only (LinkedIn fetch dropped — see plan). "First login" is expressed
 * as "hasn't uploaded a CV and hasn't dismissed this yet" (`!cv_url &&
 * !cv_prompt_dismissed`) rather than a literal login-count check — simpler,
 * and self-correcting: a candidate who uploads later never sees it again
 * regardless of dismiss state. Client-only, same pattern `LoginMenu.tsx`
 * already uses to read the browser session and the candidate's own row.
 */
export function CvOnboardingPrompt() {
  const t = useTranslations("cvOnboarding");
  const [visible, setVisible] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [vocab, setVocab] = useState<{ techTags: TechTagOption[]; spokenLanguages: SpokenLanguageOption[] } | null>(
    null,
  );

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

  async function loadVocabAndReview() {
    if (!vocab) setVocab(await getVocabClient());
    setReviewOpen(true);
    setVisible(false);
  }

  async function skip() {
    setVisible(false);
    await dismissCvPromptAction();
  }

  if (reviewOpen && vocab) {
    return (
      <CvAutofillReview
        techTags={vocab.techTags}
        spokenLanguages={vocab.spokenLanguages}
        onClose={() => setReviewOpen(false)}
        onApplied={() => window.location.reload()}
      />
    );
  }

  if (!visible) return null;

  return (
    <Modal onClose={skip}>
      <h2 className="text-lg font-bold">{t("title")}</h2>
      <p className="mt-2 text-sm text-muted">{t("body")}</p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={loadVocabAndReview}
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
