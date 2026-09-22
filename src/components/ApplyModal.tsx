"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { applyAction, applyAnonymousAction } from "@/app/[locale]/(candidate)/jobs/[slug]/actions";
import type { ApplyResult, AnonymousApplyResult } from "@/lib/db/applications";

type Props = {
  jobSlug: string;
  companyName: string;
  isCandidate: boolean;
  alreadyApplied: boolean;
  externalApplyUrl: string | null;
};

const buttonClass =
  "mt-5 flex h-11 w-full items-center justify-center rounded-lg bg-pine text-sm font-semibold text-white hover:bg-pine/90 disabled:opacity-50";
const inputClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="float-right -mt-2 -mr-2 text-xl text-muted hover:text-ink"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

export function ApplyModal({ jobSlug, companyName, isCandidate, alreadyApplied: initiallyApplied, externalApplyUrl }: Props) {
  const t = useTranslations("apply");
  const [modalOpen, setModalOpen] = useState(false);
  const [applied, setApplied] = useState(initiallyApplied);
  const [confirmation, setConfirmation] = useState<{ email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailHasAccount, setEmailHasAccount] = useState(false);
  const [pending, setPending] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEmailHasAccount(false);
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);

      if (isCandidate) {
        const result: ApplyResult = await applyAction(jobSlug, formData);
        if (result.ok) {
          setApplied(true);
          setModalOpen(false);
        } else {
          setError(t(`error.${result.reason}`));
        }
        return;
      }

      const result: AnonymousApplyResult = await applyAnonymousAction(jobSlug, formData);
      if (result.ok) {
        setConfirmation({ email });
      } else if (result.reason === "email_has_account") {
        setEmailHasAccount(true);
      } else {
        setError(t(`error.${result.reason}`));
      }
    } finally {
      setPending(false);
    }
  }

  if (externalApplyUrl) {
    return (
      <a href={externalApplyUrl} target="_blank" rel="noreferrer" className={buttonClass}>
        {t("apply")}
      </a>
    );
  }

  if (applied) {
    return <div className={`${buttonClass} bg-mint/25 text-pine`}>{t("alreadyApplied")}</div>;
  }

  return (
    <>
      <button type="button" onClick={() => setModalOpen(true)} className={buttonClass}>
        {t("apply")}
      </button>

      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)}>
          {confirmation ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint/25 text-2xl text-pine">
                ✓
              </div>
              <h2 className="mt-4 font-display text-lg font-bold text-ink">{t("doneTitle")}</h2>
              <p className="mt-2 text-sm text-muted">{t("doneSentTo", { company: companyName })}</p>
              <p className="mt-1 text-sm text-muted">{t("checkYourEmail")}</p>
              <Link
                href={{ pathname: "/candidate/register", query: { email: confirmation.email } }}
                className={buttonClass}
              >
                {t("createProfile")}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setApplied(true);
                }}
                className="mt-3 text-sm text-muted underline underline-offset-2"
              >
                {t("maybeLater")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <h2 className="mb-1 font-display text-lg font-bold text-ink">{t("modalTitle")}</h2>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              {emailHasAccount && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {t("error.email_has_account")}{" "}
                  <Link
                    href={{ pathname: "/candidate/login", query: { next: `/jobs/${jobSlug}` } }}
                    className="font-medium underline"
                  >
                    {t("logInToApply")}
                  </Link>
                </p>
              )}

              {!isCandidate && (
                <>
                  <label className={labelClass}>
                    <span>{t("fullName")}</span>
                    <input
                      name="fullName"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    <span>{t("email")}</span>
                    <input
                      type="email"
                      name="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </>
              )}

              <label className={labelClass}>
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

              <label className={labelClass}>
                <span>{t("coverNote")}</span>
                <textarea name="coverNote" rows={3} className="rounded-lg border border-line bg-white px-3 py-2 text-sm" />
              </label>

              {!isCandidate && (
                <label className="flex items-start gap-2 text-xs text-muted">
                  <input type="checkbox" required className="mt-0.5" />
                  {t("consent")}
                </label>
              )}

              <button type="submit" disabled={pending} className={buttonClass}>
                {t("submit")}
              </button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
