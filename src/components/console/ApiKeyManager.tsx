"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { generateApiKeyAction } from "@/app/[locale]/(console)/recruit/api/actions";
import type { CompanyApiKey } from "@/lib/db/api-keys";

export function ApiKeyManager({ existingKey }: { existingKey: CompanyApiKey | null }) {
  const t = useTranslations("console");
  const format = useFormatter();
  const [key, setKey] = useState(existingKey);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (key && !window.confirm(t("apiKeyRegenerateWarning"))) return;
    setPending(true);
    const result = await generateApiKeyAction();
    setPending(false);
    setRevealedSecret(result.key);
    setKey({ id: "", keyPrefix: result.keyPrefix, createdAt: new Date().toISOString(), lastUsedAt: null, revokedAt: null });
  }

  async function handleCopy() {
    if (!revealedSecret) return;
    await navigator.clipboard.writeText(revealedSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-xl space-y-4">
      {revealedSecret ? (
        <div className="rounded-lg border border-pine/30 bg-mint/10 p-4">
          <p className="text-sm font-medium text-ink">{t("apiKeyRevealOnce")}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-white px-3 py-2 text-xs">{revealedSecret}</code>
            <button
              type="button"
              onClick={handleCopy}
              className="h-9 shrink-0 rounded-lg bg-pine px-3 text-xs font-medium text-white hover:bg-pine/90"
            >
              {copied ? t("apiKeyCopied") : t("apiKeyCopy")}
            </button>
          </div>
        </div>
      ) : key ? (
        <div className="rounded-lg border border-line bg-white p-4 text-sm">
          <p className="font-medium text-ink">
            {t("apiKeyLabel")}: <code>{key.keyPrefix}…</code>
          </p>
          <p className="mt-1 text-xs text-muted">
            {t("apiKeyCreatedAt")}: {format.dateTime(new Date(key.createdAt), { dateStyle: "medium" })}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {key.lastUsedAt
              ? `${t("apiKeyLastUsedAt")}: ${format.dateTime(new Date(key.lastUsedAt), { dateStyle: "medium", timeStyle: "short" })}`
              : t("apiKeyNeverUsed")}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">{t("apiKeyNeverUsed")}</p>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={pending}
        className="h-10 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
      >
        {t("apiKeyGenerate")}
      </button>
    </div>
  );
}
