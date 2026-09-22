"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { applyAction } from "@/app/[locale]/(candidate)/jobs/[slug]/actions";
import type { ApplyResult } from "@/lib/db/applications";

type Props = {
  jobSlug: string;
  isCandidate: boolean;
  alreadyApplied: boolean;
};

const buttonClass =
  "mt-5 flex h-11 w-full items-center justify-center rounded-lg bg-pine text-sm font-semibold text-white hover:bg-pine/90 disabled:opacity-50";

export function ApplyForm({ jobSlug, isCandidate, alreadyApplied: initiallyApplied }: Props) {
  const t = useTranslations("apply");
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState(initiallyApplied);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      const result: ApplyResult = await applyAction(jobSlug, formData);
      if (result.ok) {
        setApplied(true);
        setOpen(false);
      } else {
        setError(t(`error.${result.reason}`));
      }
    } finally {
      setPending(false);
    }
  }

  if (applied) {
    return (
      <div className={`${buttonClass} bg-mint/25 text-pine`}>{t("alreadyApplied")}</div>
    );
  }

  if (!isCandidate) {
    return (
      <Link
        href={{ pathname: "/candidate/login", query: { next: `/jobs/${jobSlug}` } }}
        className={buttonClass}
      >
        {t("apply")}
      </Link>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
        {t("apply")}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("cv")}</span>
        <input
          type="file"
          name="cv"
          required
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="text-sm"
        />
        <span className="text-xs text-muted">{t("cvHint")}</span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("coverNote")}</span>
        <textarea
          name="coverNote"
          rows={3}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
        />
      </label>

      <button type="submit" disabled={pending} className={buttonClass}>
        {t("submit")}
      </button>
    </form>
  );
}
