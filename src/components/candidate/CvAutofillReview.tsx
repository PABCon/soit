"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/Modal";
import { parseCvAction, type ParseCvResult } from "@/app/[locale]/(candidate)/profile/actions";

/**
 * §AI Pieces backlog, profile-depth phase — upload step only. Previously
 * this modal also owned its own review/edit/apply UI (a separate one-shot
 * screen); that's gone now. Once parsing succeeds, the draft is handed
 * straight up to `CandidateProfileForm` via `onDraftReady`, which prefills
 * the *same persistent, always-editable* Overview/Experience/Skills &
 * Education tab state a candidate would also use for manual entry —
 * reviewing an AI-derived result and reviewing/editing by hand are now the
 * exact same UI, closing the "can't edit after analysis" gap directly.
 */
export function CvAutofillReview({
  onClose,
  onDraftReady,
}: {
  onClose: () => void;
  onDraftReady: (data: Extract<ParseCvResult, { ok: true }>["data"]) => void;
}) {
  const t = useTranslations("cvAutofill");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await parseCvAction(formData);
    setBusy(false);
    if (!result.ok) {
      setError(t(`error.${result.reason}`));
      return;
    }
    onDraftReady(result.data);
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold">{t("title")}</h2>
      <div className="mt-4">
        <p className="text-sm text-muted">{t("uploadHint")}</p>
        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <label className="mt-4 inline-flex h-10 cursor-pointer items-center rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine/90">
          {busy ? t("analyzing") : t("chooseFile")}
          <input
            type="file"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      </div>
    </Modal>
  );
}
