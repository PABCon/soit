import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "developers" });
  return { title: t("title"), description: t("intro") };
}

const codeClass = "overflow-x-auto rounded-lg bg-paper px-3 py-2 text-xs";
const tableClass = "mt-3 w-full border-collapse text-xs";
const thClass = "border-b border-line py-1.5 pr-3 text-left font-semibold text-ink";
const tdClass = "border-b border-line py-1.5 pr-3 align-top";
const h2Class = "font-display mt-10 text-lg font-semibold text-ink";
const h3Class = "font-display mt-6 text-base font-semibold text-ink";

const JOB_FIELDS: { field: string; type: string; required: string; note: string }[] = [
  { field: "title", type: "string", required: "required", note: "" },
  { field: "description", type: "string", required: "required", note: "" },
  { field: "language", type: '"pt" | "en"', required: "required", note: "the ad's own text language" },
  { field: "seniority", type: '"junior" | "mid" | "senior" | "lead"', required: "required", note: "" },
  { field: "workModel", type: '"remote" | "hybrid" | "office"', required: "required", note: "" },
  { field: "categorySlug", type: "string", required: "required", note: "see GET /reference" },
  { field: "locationSlug", type: "string | null", required: "required unless workModel is remote", note: "see GET /reference" },
  { field: "salaryMin", type: "number", required: "required", note: "> 0" },
  { field: "salaryMax", type: "number", required: "required", note: "≥ salaryMin" },
  { field: "salaryPeriod", type: '"hour" | "day" | "month" | "year"', required: "required", note: "" },
  { field: "salaryMonths", type: "number | null", required: "only when salaryPeriod is “month”", note: "12–14" },
  {
    field: "employmentType",
    type: '"permanent" | "fixed_term" | "contractor" | "freelance" | "internship"',
    required: "required",
    note: "",
  },
  { field: "techTags", type: "{ slug, level?, required? }[]", required: "optional", note: "level: basic|intermediate|advanced|expert" },
  { field: "languages", type: "{ slug, level? }[]", required: "optional", note: "spoken-language requirement, not the ad's own language" },
  { field: "externalApplyUrl", type: "string", required: "optional", note: "" },
  { field: "expiresAt", type: "string | null", required: "optional", note: "yyyy-mm-dd; ignored if in the past" },
  { field: "publish", type: "boolean", required: "optional, default false", note: "false saves a draft" },
  { field: "salaryPublic", type: "boolean", required: "optional, default true", note: "hiding salary needs a paid plan" },
];

const ERRORS: { status: string; code: string; meaning: string }[] = [
  { status: "401", code: "missing_api_key", meaning: "No Authorization header sent" },
  { status: "401", code: "invalid_api_key", meaning: "The key doesn't exist or was revoked" },
  { status: "403", code: "not_top_employer", meaning: "The key's company doesn't currently have an active Top Employer subscription" },
  { status: "400", code: "invalid_json", meaning: "The request body isn't valid JSON" },
  { status: "400", code: "invalid_body", meaning: "A field failed validation — message names which one" },
  { status: "400", code: "unknown_category_slug", meaning: "categorySlug isn't one GET /reference returned" },
  { status: "400", code: "unknown_location_slug", meaning: "locationSlug isn't one GET /reference returned" },
  { status: "400", code: "unknown_tech_tag_slug", meaning: "a techTags[].slug isn't one GET /reference returned" },
  { status: "400", code: "unknown_language_slug", meaning: "a languages[].slug isn't one GET /reference returned" },
  { status: "404", code: "job_not_found", meaning: "No job with that id belongs to your company" },
  { status: "409", code: "job_has_applications", meaning: "DELETE refused — pause the job instead" },
];

export default async function DevelopersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("developers");

  return (
    <>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">{t("intro")}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {t("getKeyIntro")}{" "}
        <Link href="/recruit/api" className="text-pine hover:underline">
          /recruit/api
        </Link>
        .
      </p>

      <h2 className={h2Class}>{t("authHeading")}</h2>
      <p className="mt-2 text-sm text-muted">{t("authBody")}</p>
      <pre className={`mt-2 ${codeClass}`}>Authorization: Bearer YOUR_KEY</pre>

      <h2 className={h2Class}>{t("baseUrlHeading")}</h2>
      <pre className={codeClass}>{SITE}</pre>

      <h2 className={h2Class}>{t("errorsHeading")}</h2>
      <p className="mt-2 text-sm text-muted">{t("errorsBody")}</p>
      <pre className={`mt-2 ${codeClass}`}>{`{ "error": "invalid_api_key", "message": "..." }`}</pre>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>HTTP</th>
              <th className={thClass}>error</th>
              <th className={thClass}>{t("colMeaning")}</th>
            </tr>
          </thead>
          <tbody>
            {ERRORS.map((e) => (
              <tr key={e.code}>
                <td className={`${tdClass} font-mono text-pine`}>{e.status}</td>
                <td className={`${tdClass} font-mono`}>{e.code}</td>
                <td className={tdClass}>{e.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className={h2Class}>{t("endpointsHeading")}</h2>

      <h3 className={h3Class}>GET /api/v1/reference</h3>
      <p className="mt-2 text-sm text-muted">{t("referenceBody")}</p>
      <pre className={`mt-2 ${codeClass}`}>
{`curl ${SITE}/api/v1/reference \\
  -H "Authorization: Bearer YOUR_KEY"`}
      </pre>
      <pre className={`mt-2 ${codeClass}`}>
{`{
  "categories": [{ "slug": "backend-development", "label": "Backend Development" }, ...],
  "locations": [{ "slug": "lisboa", "name": "Lisboa" }, ...],
  "techTags": [{ "slug": "typescript", "label": "TypeScript" }, ...],
  "languages": [{ "slug": "english", "label": "English" }, ...],
  "enums": {
    "seniority": ["junior", "mid", "senior", "lead"],
    "workModel": ["remote", "hybrid", "office"],
    "salaryPeriod": ["hour", "day", "month", "year"],
    "employmentType": ["permanent", "fixed_term", "contractor", "freelance", "internship"],
    "jobLanguage": ["pt", "en"],
    "skillLevel": ["basic", "intermediate", "advanced", "expert"]
  }
}`}
      </pre>

      <h3 className={h3Class}>GET /api/v1/jobs</h3>
      <p className="mt-2 text-sm text-muted">{t("listBody")}</p>
      <pre className={`mt-2 ${codeClass}`}>
{`curl ${SITE}/api/v1/jobs \\
  -H "Authorization: Bearer YOUR_KEY"`}
      </pre>
      <pre className={`mt-2 ${codeClass}`}>
{`{
  "jobs": [
    {
      "id": "...", "slug": "senior-backend-engineer-...", "title": "...",
      "status": "published", "language": "en",
      "publishedAt": "2026-10-01T00:00:00.000Z", "expiresAt": "2026-10-31T00:00:00.000Z",
      "path": "/en/jobs/...", "url": "${SITE}/en/jobs/..."
    }
  ]
}`}
      </pre>

      <h3 className={h3Class}>GET /api/v1/jobs/:id</h3>
      <p className="mt-2 text-sm text-muted">{t("detailBody")}</p>

      <h3 className={h3Class}>POST /api/v1/jobs</h3>
      <p className="mt-2 text-sm text-muted">{t("createBody")}</p>
      <pre className={`mt-2 ${codeClass}`}>
{`curl ${SITE}/api/v1/jobs \\
  -X POST \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Senior Backend Engineer",
    "description": "...",
    "language": "en",
    "seniority": "senior",
    "workModel": "remote",
    "categorySlug": "backend-development",
    "salaryMin": 3500,
    "salaryMax": 5000,
    "salaryPeriod": "month",
    "salaryMonths": 14,
    "employmentType": "permanent",
    "techTags": [{ "slug": "typescript", "level": "advanced", "required": true }],
    "publish": true
  }'`}
      </pre>
      <pre className={`mt-2 ${codeClass}`}>
{`{ "id": "...", "slug": "senior-backend-engineer-...", "url": "${SITE}/en/jobs/...", "status": "published" }`}
      </pre>

      <h3 className={h3Class}>PUT /api/v1/jobs/:id</h3>
      <p className="mt-2 text-sm text-muted">{t("updateBody")}</p>

      <h3 className={h3Class}>{t("jobFieldsHeading")}</h3>
      <p className="mt-2 text-sm text-muted">{t("jobFieldsBody")}</p>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>field</th>
              <th className={thClass}>type</th>
              <th className={thClass}>{t("colRequired")}</th>
              <th className={thClass}>{t("colNote")}</th>
            </tr>
          </thead>
          <tbody>
            {JOB_FIELDS.map((f) => (
              <tr key={f.field}>
                <td className={`${tdClass} font-mono text-pine`}>{f.field}</td>
                <td className={`${tdClass} font-mono text-muted`}>{f.type}</td>
                <td className={tdClass}>{f.required}</td>
                <td className={tdClass}>{f.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className={h3Class}>POST /api/v1/jobs/:id/pause · POST /api/v1/jobs/:id/publish</h3>
      <p className="mt-2 text-sm text-muted">{t("statusBody")}</p>
      <pre className={`mt-2 ${codeClass}`}>{`{ "ok": true }`}</pre>

      <h3 className={h3Class}>DELETE /api/v1/jobs/:id</h3>
      <p className="mt-2 text-sm text-muted">{t("deleteBody")}</p>
    </>
  );
}
