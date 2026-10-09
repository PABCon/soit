"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { exportMyDataAction } from "@/app/[locale]/(candidate)/settings/actions";

/** GDPR data export / right to data portability (real-usage QA item).
 *  Generates the file entirely client-side from the server action's
 *  JSON response — no file is ever written server-side, nothing to
 *  clean up, and the download never leaves this one request. */
export function DataExportButton() {
  const t = useTranslations("settings");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setPending(true);
    setError(null);
    try {
      const data = await exportMyDataAction();
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
