"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deleteCandidateAccountAction } from "@/app/[locale]/(candidate)/settings/actions";

/** Candidate settings — "delete account" (real-usage QA item). A real,
 *  irreversible action: two-step confirmation (no modal library in this
 *  app — same inline-reveal pattern used elsewhere for destructive
 *  console actions) rather than a single click. See
 *  deleteCandidateAccount()'s own doc comment for what actually happens
 *  to the data. */
export function DeleteAccountSection() {
  const t = useTranslations("settings");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    const result = await deleteCandidateAccountAction();
    if (!result.ok) {
      setPending(false);
      setError(t("deleteAccountError"));
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-red-700 hover:underline"
      >
        {t("deleteAccount")}
      </button>
    );
  }

  return (
    <div className="max-w-sm rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-900">{t("deleteAccountConfirm")}</p>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleDelete}
          className="h-9 rounded-lg bg-red-700 px-3 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
        >
          {pending ? t("deleteAccountPending") : t("deleteAccountConfirmButton")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="h-9 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-paper"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
