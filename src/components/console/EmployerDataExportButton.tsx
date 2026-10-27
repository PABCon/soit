"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { exportMyEmployerDataAction } from "@/app/[locale]/(console)/recruit/settings/actions";

/** GDPR data export for an employer-side account (audit finding: this
 *  existed for candidates only). Mirrors the candidate-side
 *  DataExportButton exactly — generates the file entirely client-side
 *  from the server action's JSON response, nothing written server-side. */
export function EmployerDataExportButton() {
  const t = useTranslations("console");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setPending(true);
    setError(null);
    try {
      const data = await exportMyEmployerDataAction();
      if (!data) {
        setError(t("dataExportError"));
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `justit-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("dataExportError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleExport}
        disabled={pending}
        className="h-9 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-paper disabled:opacity-50"
      >
        {pending ? t("dataExportPending") : t("dataExportCta")}
      </button>
      <p className="mt-1.5 text-xs text-muted">{t("dataExportHint")}</p>
      {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}
    </div>
  );
}
