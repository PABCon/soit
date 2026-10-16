import { getTranslations, setRequestLocale } from "next-intl/server";
import { Lock, Zap, RefreshCw, Puzzle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getMyEmployerContext } from "@/lib/db/companies";
import { getMyApiKey } from "@/lib/db/api-keys";
import { buttonClassName } from "@/components/Button";
import { ApiKeyManager } from "@/components/console/ApiKeyManager";
import { ApiDocs } from "@/components/console/ApiDocs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type Props = { params: Promise<{ locale: string }> };

function IconChip({ children }: { children: React.ReactNode }) {
  return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine">{children}</div>;
}

export default async function ApiPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });

  const ctx = await getMyEmployerContext();
  if (!ctx) return <p className="text-sm text-muted">{t("notEmployer")}</p>;

  if (!ctx.company.top_employer_active) {
    const features = [
      { icon: <Zap className="h-5 w-5" aria-hidden="true" />, title: t("apiFeature1Title"), desc: t("apiFeature1Desc") },
      { icon: <RefreshCw className="h-5 w-5" aria-hidden="true" />, title: t("apiFeature2Title"), desc: t("apiFeature2Desc") },
      { icon: <Puzzle className="h-5 w-5" aria-hidden="true" />, title: t("apiFeature3Title"), desc: t("apiFeature3Desc") },
    ];
    return (
      <>
        <h1 className="text-3xl font-bold lg:text-4xl">{t("apiHeading")}</h1>
        <p className="mt-1 text-sm text-muted">{t("apiSubtitleLocked")}</p>

        <div className="mt-6 max-w-2xl rounded-xl border border-line bg-white p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-pine/10">
              <Lock className="h-6 w-6 text-pine" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold text-ink">{t("apiLockedHeading")}</h2>
              <p className="mt-1 text-sm text-muted">{t("apiLockedBody")}</p>
            </div>
          </div>

          <div className="mt-5 space-y-4 border-t border-line pt-5">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <IconChip>{f.icon}</IconChip>
                <div>
                  <p className="font-medium text-ink">{f.title}</p>
                  <p className="text-sm text-muted">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Link href="/recruit/jobs/ads" className={buttonClassName({ className: "mt-5" })}>
            {t("pricing")}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold lg:text-4xl">{t("apiHeading")}</h1>
      <p className="mt-1 text-sm text-muted">{t("apiSubtitleEnabled")}</p>

      <div className="mt-6 max-w-3xl space-y-6">
        {ctx.role === "owner" ? (
          <ApiKeyManager existingKey={await getMyApiKey()} />
        ) : (
          <p className="text-sm text-muted">{t("ownerOnly")}</p>
        )}
        <ApiDocs baseUrl={SITE} />
      </div>
    </>
  );
}
