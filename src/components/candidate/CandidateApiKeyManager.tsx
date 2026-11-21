"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Copy, Check } from "lucide-react";
import { generateCandidateApiKeyAction } from "@/app/[locale]/(candidate)/settings/actions";
import { buttonClassName } from "@/components/Button";
import type { CandidateApiKey } from "@/lib/db/candidate-api-keys";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const MCP_URL = `${SITE}/api/mcp/candidate`;

/** Candidate-side mirror of `src/components/console/ApiKeyManager.tsx` —
 *  same generate/reveal-once/copy shape, just candidate-scoped and free
 *  (no Top-Employer gate, no locked-upsell branch). Also shows the real
 *  MCP server URL this key authenticates against, since a candidate has
 *  no equivalent of the employer console's own `ApiDocs` reference page
 *  to point at. */
export function CandidateApiKeyManager({ existingKey }: { existingKey: CandidateApiKey | null }) {
  const t = useTranslations("settings");
  const format = useFormatter();
  const [key, setKey] = useState(existingKey);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  async function handleGenerate() {
    if (key && !window.confirm(t("apiKeyRegenerateWarning"))) return;
    setPending(true);
    const result = await generateCandidateApiKeyAction();
    setPending(false);
    setRevealedSecret(result.key);
    setKey({ id: "", keyPrefix: result.keyPrefix, createdAt: new Date().toISOString(), lastUsedAt: null, revokedAt: null });
  }

  async function handleCopyKey() {
    if (!revealedSecret) return;
    await navigator.clipboard.writeText(revealedSecret);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  async function handleCopyUrl() {
    await navigator.clipboard.writeText(MCP_URL);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-paper px-3 py-2.5 text-sm">
            {revealedSecret ?? (key ? `${key.keyPrefix}…` : t("apiKeyNeverUsed"))}
          </code>
          {revealedSecret && (
            <button
              type="button"
              onClick={handleCopyKey}
              aria-label={t("apiKeyCopy")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted hover:text-pine"
            >
              {copiedKey ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            </button>
          )}
        </div>
        <button type="button" onClick={handleGenerate} disabled={pending} className={buttonClassName({ className: "shrink-0" })}>
          {t("apiKeyGenerate")}
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

      <div className="mt-5 border-t border-line pt-5">
        <p className="text-xs font-medium text-muted">{t("apiKeyMcpUrl")}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-paper px-3 py-2.5 text-sm">{MCP_URL}</code>
          <button
            type="button"
            onClick={handleCopyUrl}
            aria-label={t("apiKeyCopy")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted hover:text-pine"
          >
            {copiedUrl ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">{t("apiKeyMcpHint")}</p>
      </div>
    </div>
  );
}
