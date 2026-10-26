"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link2, RefreshCw } from "lucide-react";
import { startJobImportAction } from "@/app/[locale]/(console)/recruit/jobs/import-actions";
import { buttonClassName } from "@/components/Button";

export type JobImportRunSummary = {
  sourceUrl: string;
  discoveredCount: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
};

export function JobImportCard({
  activeRun,
  canStart,
  cooldownUntil,
  locale,
}: {
  activeRun: JobImportRunSummary | null;
  canStart: boolean;
  cooldownUntil: string | null;
  locale: string;
}) {
  const t = useTranslations("console");
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setPending(true);
    try {
      const result = await startJobImportAction(url.trim());
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(t(`jobImportError.${result.reason}`));
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  if (activeRun) {
    const processed = activeRun.importedCount + activeRun.skippedCount + activeRun.failedCount;
    return (
      <div className="mb-6 rounded-xl border border-line bg-paper/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">{t("jobImportRunningHeading")}</p>
            <p className="mt-1 text-sm text-muted">
              {t("jobImportProgress", { imported: activeRun.importedCount, processed, total: activeRun.discoveredCount })}
            </p>
          </div>
          <button type="button" onClick={() => router.refresh()} className={buttonClassName({ variant: "secondary" })}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t("jobImportRefresh")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-line bg-white p-5">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-pine" />
        <p className="font-semibold text-ink">{t("jobImportHeading")}</p>
      </div>
      <p className="mt-1 text-sm text-muted">{t("jobImportSubtitle")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("jobImportUrlPlaceholder")}
          disabled={!canStart || pending}
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-muted disabled:bg-paper disabled:text-muted"
        />
        <button
          type="button"
          disabled={!canStart || pending || !url.trim()}
          onClick={submit}
          className={buttonClassName({ variant: "primary", className: pending || !canStart ? "opacity-50" : "" })}
        >
          {pending ? t("redirecting") : t("jobImportButton")}
        </button>
      </div>
      {!canStart && cooldownUntil && (
        <p className="mt-2 text-xs text-muted">
          {t("jobImportCooldown", { date: new Date(cooldownUntil).toLocaleString(locale === "pt" ? "pt-PT" : "en-GB") })}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
