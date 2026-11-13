import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TerminationCalculatorForm } from "@/components/candidate/TerminationCalculatorForm";
import { localeAlternates, socialMeta } from "@/lib/seo";
import { safeJsonLd, faqPageJsonLd } from "@/lib/json-ld";

type Props = { params: Promise<{ locale: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const INFO_SECTIONS = [
  ["whatIsSeveranceTerm", "whatIsSeveranceBody"],
  ["whatIsMutualAgreementTerm", "whatIsMutualAgreementBody"],
  ["unemploymentEligibilityTerm", "unemploymentEligibilityBody"],
  ["taxExemptionTerm", "taxExemptionBody"],
  ["noticePeriodTerm", "noticePeriodBody"],
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "terminationCalculator" });
  const title = t("pageTitle");
  const description = t("pageDescription");
  return {
    title,
    description,
    alternates: localeAlternates("/rescisao-contrato", locale),
    ...socialMeta({ title, description, url: `${SITE}/${locale}/rescisao-contrato` }),
  };
}

/** Contract Termination Calculator (Portugal), scoped from real Keyword
 *  Planner data (demand skews dismissal/mútuo acordo, not resignation)
 *  and primary-source legal research (CT arts. 366º/344º/400º/401º/245º,
 *  CIRS art. 2º n.4 al. b)). A new, standalone, dedicated URL rather than
 *  a mode inside /salario-liquido: every real competitor in this keyword
 *  cluster uses its own dedicated page, and this is a conceptually
 *  different question ("what am I owed when I leave") from the salary
 *  calculator's own ("what does my pay become"). Reuses that tool's
 *  proven architecture (rules/engine split, shareable URL, mode-switcher
 *  UI) without sharing its page. FCT/FGCT deliberately excluded (real
 *  search demand exists but is employer/accounting-side, not candidate-
 *  facing); pre-October-2013 tenure explicitly unsupported rather than
 *  guessed at (see engine/seniority.ts). */
export default async function TerminationCalculatorPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "terminationCalculator" });

  const faqItems = INFO_SECTIONS.map(([question, answer]) => ({ question: t(question), answer: t(answer) }));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqPageJsonLd(faqItems)) }} />
      <h1 className="font-display text-2xl font-bold">{t("heading")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t("subtitle")}</p>
      <div className="mt-6">
        <TerminationCalculatorForm />
      </div>
    </>
  );
}
