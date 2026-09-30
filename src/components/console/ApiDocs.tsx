import { useTranslations } from "next-intl";

const ENDPOINTS: { method: string; path: string }[] = [
  { method: "GET", path: "/api/v1/reference" },
  { method: "GET", path: "/api/v1/jobs" },
  { method: "POST", path: "/api/v1/jobs" },
  { method: "GET", path: "/api/v1/jobs/:id" },
  { method: "PUT", path: "/api/v1/jobs/:id" },
  { method: "DELETE", path: "/api/v1/jobs/:id" },
  { method: "POST", path: "/api/v1/jobs/:id/pause" },
  { method: "POST", path: "/api/v1/jobs/:id/publish" },
];

/** Plain, in-console docs for a single pilot integration — not a public
 *  developer portal. Code (curl, JSON) stays unlocalized on purpose. */
export function ApiDocs({ baseUrl }: { baseUrl: string }) {
  const t = useTranslations("console");

  return (
    <div className="max-w-2xl space-y-6 text-sm">
      <div>
        <h3 className="font-semibold text-ink">{t("apiDocsBaseUrl")}</h3>
        <code className="mt-1 block rounded bg-paper px-3 py-2 text-xs">{baseUrl}</code>
      </div>

      <div>
        <h3 className="font-semibold text-ink">{t("apiDocsAuth")}</h3>
        <code className="mt-1 block rounded bg-paper px-3 py-2 text-xs">Authorization: Bearer &lt;your key&gt;</code>
      </div>

      <div>
        <h3 className="font-semibold text-ink">{t("apiDocsEndpoints")}</h3>
        <table className="mt-2 w-full border-collapse text-xs">
          <tbody>
            {ENDPOINTS.map((e) => (
              <tr key={`${e.method} ${e.path}`} className="border-b border-line">
                <td className="py-1.5 pr-3 font-mono font-semibold text-pine">{e.method}</td>
                <td className="py-1.5 font-mono text-muted">{e.path}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="font-semibold text-ink">{t("apiDocsDiscover")}</h3>
        <pre className="mt-1 overflow-x-auto rounded bg-paper px-3 py-2 text-xs">
{`curl ${baseUrl}/api/v1/reference \\
  -H "Authorization: Bearer YOUR_KEY"`}
        </pre>
      </div>

      <div>
        <h3 className="font-semibold text-ink">{t("apiDocsCreate")}</h3>
        <pre className="mt-1 overflow-x-auto rounded bg-paper px-3 py-2 text-xs">
{`curl ${baseUrl}/api/v1/jobs \\
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
  }'`}
        </pre>
      </div>

      <p className="text-xs text-muted">{t("apiDocsPutNote")}</p>
    </div>
  );
}
