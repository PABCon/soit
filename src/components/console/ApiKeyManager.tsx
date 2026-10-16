"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { KeyRound, Copy, Check } from "lucide-react";
import { generateApiKeyAction } from "@/app/[locale]/(console)/recruit/api/actions";
import { buttonClassName } from "@/components/Button";
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
    <div className="rounded-xl border border-line bg-white p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-semibold text-ink">{t("apiKeyCardHeading")}</h2>
          <p className="mt-1 text-sm text-muted">{t("apiKeyCardSubtitle")}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-paper px-3 py-2.5 text-sm">
            {revealedSecret ?? (key ? `${key.keyPrefix}…` : t("apiKeyNeverUsed"))}
          </code>
          {revealedSecret && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={t("apiKeyCopy")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted hover:text-pine"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          className={buttonClassName({ className: "shrink-0" })}
        >
          {key ? t("apiKeyGenerate") : t("apiKeyGenerate")}
        </button>
      </div>

      {revealedSecret && <p className="mt-2 text-xs text-muted">{t("apiKeyRevealOnce")}</p>}

      {key && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
          <span>
            {t("apiKeyCreatedAt")}: {format.dateTime(new Date(key.createdAt), { dateStyle: "medium" })}
          </span>
          <span>
            {key.lastUsedAt
              ? `${t("apiKeyLastUsedAt")}: ${format.dateTime(new Date(key.lastUsedAt), { dateStyle: "medium", timeStyle: "short" })}`
              : t("apiKeyNeverUsed")}
          </span>
        </div>
      )}
    </div>
  );
}
