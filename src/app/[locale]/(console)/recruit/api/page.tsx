import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMyEmployerContext } from "@/lib/db/companies";
import { getMyApiKey } from "@/lib/db/api-keys";
import { ApiKeyManager } from "@/components/console/ApiKeyManager";
import { ApiDocs } from "@/components/console/ApiDocs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type Props = { params: Promise<{ locale: string }> };

export default async function ApiPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });

  const ctx = await getMyEmployerContext();
  if (!ctx) return <p className="text-sm text-muted">{t("notEmployer")}</p>;

  if (!ctx.company.top_employer_active) {
    return (
      <>
        <h1 className="text-2xl font-bold">{t("apiHeading")}</h1>
        <div className="mt-4 max-w-lg rounded-xl border border-line bg-paper/60 p-6 text-center">
          <p className="text-sm text-ink">{t("apiUpsell")}</p>
          <Link
            href="/recruit/jobs/ads"
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-pine px-5 text-sm font-semibold text-white hover:bg-pine/90"
          >
            {t("pricing")}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold">{t("apiHeading")}</h1>
      <div className="mt-6">
        {ctx.role === "owner" ? (
          <ApiKeyManager existingKey={await getMyApiKey()} />
        ) : (
          <p className="text-sm text-muted">{t("ownerOnly")}</p>
        )}
      </div>
      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold">{t("apiDocsHeading")}</h2>
        <div className="mt-4">
          <ApiDocs baseUrl={SITE} />
        </div>
      </div>
    </>
  );
}
