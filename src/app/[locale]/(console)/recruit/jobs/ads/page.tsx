import { redirect } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMyEmployerContext } from "@/lib/db/companies";
import { AdCreditPacks } from "@/components/console/AdCreditPacks";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ purchase?: string }>;
};

export default async function JobAdsPricingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { purchase } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });

  const ctx = await getMyEmployerContext();
  if (!ctx) return redirect({ href: "/employer/login", locale });

  return (
    <>
      <h1 className="text-2xl font-bold">{t("pricing")}</h1>
      <p className="mt-1 text-sm text-muted">
        {t("adCreditsRemaining", { count: ctx.company.ad_credits_available })}
      </p>

      {purchase === "success" && (
        <p className="mt-4 rounded-lg bg-mint/25 px-4 py-3 text-sm text-pine">{t("purchaseSuccess")}</p>
      )}
      {purchase === "canceled" && (
        <p className="mt-4 rounded-lg bg-paper px-4 py-3 text-sm text-muted">{t("purchaseCanceled")}</p>
      )}

      <div className="mt-6">
        <AdCreditPacks />
      </div>
    </>
  );
}
