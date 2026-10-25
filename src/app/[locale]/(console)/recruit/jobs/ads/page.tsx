import { redirect } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Coins, Crown, HelpCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyEmployerContext } from "@/lib/db/companies";
import { getCompanyInvoices } from "@/lib/stripe";
import { AdCreditPacks } from "@/components/console/AdCreditPacks";
import { TopEmployerCard } from "@/components/console/TopEmployerCard";
import { BillingHistory } from "@/components/console/BillingHistory";
import { buttonClassName } from "@/components/Button";

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

  const supabase = await createClient();
  const invoices = await getCompanyInvoices(ctx.company.stripe_customer_id);

  // Which plan an active Top Employer is actually billed on — surfaced
  // alongside the Active/Renews badge so a real subscriber (possibly still
  // grandfathered on an older Price — see scripts/stripe-setup.mjs) never
  // reads as "on the new advertised price" just because the card is active.
  const { data: activeSubscription } = ctx.company.top_employer_active
    ? await supabase
        .from("company_subscriptions")
        .select("billing_interval")
        .eq("company_id", ctx.company.id)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  // Same lookup for an active job-ads plan, scoped by plan_type since
  // company_subscriptions now holds both kinds of subscription.
  const jobAdsPlanActive = ctx.company.job_ad_slot_cap > 1;
  const { data: activeJobAdsSubscription } = jobAdsPlanActive
    ? await supabase
        .from("company_subscriptions")
        .select("current_period_end")
        .eq("company_id", ctx.company.id)
        .eq("plan_type", "job_ads")
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <>
      <h1 className="text-3xl font-bold lg:text-4xl">{t("pricing")}</h1>
      <p className="mt-1 text-muted">{t("pricingSubtitle")}</p>

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

      <section className="mt-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine">
              <Coins className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-ink">{t("jobAdsHeading")}</h2>
              <div className="flex items-center gap-1.5 text-sm text-muted">
                <span className={jobAdsPlanActive ? "font-medium text-pine" : ""}>
                  {t("adCreditsRemaining", { count: ctx.company.job_ad_slot_cap })}
                </span>
                <span title={t("adCreditsInfo")} aria-label={t("adCreditsInfo")}>
                  <HelpCircle className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
          <a href="#whats-included" className={buttonClassName({ variant: "secondary", size: "md" })}>
            <HelpCircle className="h-4 w-4" />
            {t("howCreditsWork")}
          </a>
        </div>
        <div className="mt-4">
          <AdCreditPacks
            active={jobAdsPlanActive}
            slotCap={ctx.company.job_ad_slot_cap}
            periodEnd={activeJobAdsSubscription?.current_period_end ?? null}
          />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <Crown className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">{t("topEmployerHeading")}</h2>
            <p className="text-sm text-muted">{t("topEmployerHeadingSubtitle")}</p>
          </div>
        </div>
        <div className="mt-4">
          <TopEmployerCard
            active={ctx.company.top_employer_active}
            periodEnd={ctx.company.top_employer_period_end}
            billingInterval={(activeSubscription?.billing_interval as "month" | "year" | null) ?? null}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink">{t("billingHistoryHeading")}</h2>
        <p className="mt-1 text-sm text-muted">{t("billingHistorySubtitle")}</p>
        <div className="mt-4">
          <BillingHistory
            invoices={invoices}
            locale={locale}
            canManageBilling={!!ctx.company.stripe_customer_id}
          />
        </div>
      </section>
    </>
  );
}
