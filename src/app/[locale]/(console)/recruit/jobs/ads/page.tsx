import { redirect } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMyEmployerContext } from "@/lib/db/companies";
import { AdCreditPacks } from "@/components/console/AdCreditPacks";
import { TopEmployerCard } from "@/components/console/TopEmployerCard";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ purchase?: string; subscription?: string }>;
};

export default async function JobAdsPricingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { purchase, subscription } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });

  const ctx = await getMyEmployerContext();
  if (!ctx) return redirect({ href: "/employer/login", locale });

  return (
    <>
      <h1 className="text-2xl font-bold">{t("pricing")}</h1>

      {purchase === "success" && (
        <p className="mt-4 rounded-lg bg-mint/25 px-4 py-3 text-sm text-pine">{t("purchaseSuccess")}</p>
      )}
      {purchase === "canceled" && (
        <p className="mt-4 rounded-lg bg-paper px-4 py-3 text-sm text-muted">{t("purchaseCanceled")}</p>
      )}
      {subscription === "success" && (
        <p className="mt-4 rounded-lg bg-mint/25 px-4 py-3 text-sm text-pine">{t("subscriptionSuccess")}</p>
      )}
      {subscription === "canceled" && (
        <p className="mt-4 rounded-lg bg-paper px-4 py-3 text-sm text-muted">{t("subscriptionCanceled")}</p>
      )}

      <section className="mt-8 rounded-xl border border-line bg-paper/60 p-5">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t("freeTierLabel")}</p>
        <p className="mt-1 text-sm text-ink">{t("freeTierDescription")}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">{t("jobAdsHeading")}</h2>
        <p className="mt-1 text-sm text-muted">
          {t("adCreditsRemaining", { count: ctx.company.ad_credits_available })}
        </p>
        <div className="mt-4">
          <AdCreditPacks />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink">{t("topEmployerHeading")}</h2>
        <p className="mt-1 text-sm text-muted">{t("topEmployerHeadingSubtitle")}</p>
        <div className="mt-4 max-w-md">
          <TopEmployerCard active={ctx.company.top_employer_active} />
        </div>
      </section>
    </>
  );
}
