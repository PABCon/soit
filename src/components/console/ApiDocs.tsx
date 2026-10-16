"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, List, Code2, Copy, Check } from "lucide-react";
import { Link } from "@/i18n/navigation";

const ENDPOINTS: { method: string; path: string; descKey: string; danger?: boolean }[] = [
  { method: "GET", path: "/api/v1/reference", descKey: "apiEndpointDescReference" },
  { method: "GET", path: "/api/v1/jobs", descKey: "apiEndpointDescList" },
  { method: "POST", path: "/api/v1/jobs", descKey: "apiEndpointDescCreate", danger: true },
  { method: "GET", path: "/api/v1/jobs/{id}", descKey: "apiEndpointDescGet" },
  { method: "PUT", path: "/api/v1/jobs/{id}", descKey: "apiEndpointDescUpdate" },
  { method: "DELETE", path: "/api/v1/jobs/{id}", descKey: "apiEndpointDescDelete", danger: true },
  { method: "POST", path: "/api/v1/jobs/{id}/pause", descKey: "apiEndpointDescPause" },
  { method: "POST", path: "/api/v1/jobs/{id}/publish", descKey: "apiEndpointDescPublish" },
];

function CardHeader({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine">{icon}</div>
        <div>
          <h2 className="font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-paper px-3 py-2.5 text-xs">{value}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted hover:text-pine"
      >
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

const EXAMPLE_CODE = `curl {baseUrl}/api/v1/jobs \\
  -X POST \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Senior Backend Engineer",
    "description": "...",
    "language": "en",
    "seniority": "senior",
    "workModel": "remote",
    "categorySlug": "backend",
    "salaryMin": 3500,
    "salaryMax": 5000,
    "salaryPeriod": "month",
    "salaryMonths": 14,
    "employmentType": "permanent",
    "techTags": [{"slug": "typescript", "level": "advanced", "required": true}],
    "publish": true
  }'`;

/** Round 32 restyle, per two reference images — real functionality
 *  unchanged (Phase 4, CLAUDE.md): "How it works" + Endpoints + one
 *  curl Example card, each with its own copy-to-clipboard control. The
 *  full field-by-field reference stays the public `/developers` page,
 *  linked from here, not duplicated. */
export function ApiDocs({ baseUrl }: { baseUrl: string }) {
  const t = useTranslations("console");
  const [codeCopied, setCodeCopied] = useState(false);
  const exampleCode = EXAMPLE_CODE.replace("{baseUrl}", baseUrl);

  return (
    <>
      <div className="rounded-xl border border-line bg-white p-6">
        <CardHeader
          icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
          title={t("apiDocsHeading")}
          subtitle={t("apiDocsSubtitle")}
          action={
            <Link href="/developers" target="_blank" className="shrink-0 text-sm font-medium text-pine hover:underline">
              {t("apiDocsFullReferenceLink")} ↗
            </Link>
          }
        />
        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">{t("apiDocsBaseUrl")}</h3>
            <div className="mt-1.5">
              <CopyField value={baseUrl} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">{t("apiDocsAuth")}</h3>
            <div className="mt-1.5">
              <CopyField value="Authorization: Bearer YOUR_KEY" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-6">
        <CardHeader
          icon={<List className="h-5 w-5" aria-hidden="true" />}
          title={t("apiDocsEndpoints")}
          subtitle={t("apiEndpointsSubtitle")}
        />
        <div className="mt-5 overflow-x-auto border-t border-line pt-5">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold tracking-wide text-muted uppercase">
                <th className="pb-2">{t("apiMethod")}</th>
                <th className="pb-2">{t("apiEndpoint")}</th>
                <th className="pb-2">{t("apiDescription")}</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr key={`${e.method} ${e.path}`} className="border-t border-line">
                  <td className="py-2.5 pr-3">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
                        e.danger ? "bg-error/10 text-error" : "bg-pine/10 text-pine"
                      }`}
                    >
                      {e.method}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-ink">{e.path}</td>
                  <td className="py-2.5 text-xs text-muted">{t(e.descKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-6">
        <CardHeader
          icon={<Code2 className="h-5 w-5" aria-hidden="true" />}
          title={t("apiExampleHeading")}
          subtitle={t("apiExampleSubtitle")}
          action={
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(exampleCode);
                setCodeCopied(true);
                setTimeout(() => setCodeCopied(false), 2000);
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted hover:text-pine"
            >
              {codeCopied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              {t("apiCopyCode")}
            </button>
          }
        />
        <pre className="mt-5 overflow-x-auto rounded-lg bg-paper px-4 py-3 text-xs">{exampleCode}</pre>
        <p className="mt-3 text-xs text-muted">{t("apiDocsPutNote")}</p>
      </div>
    </>
  );
}
