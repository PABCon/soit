import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SalaryCalculatorForm } from "@/components/candidate/SalaryCalculatorForm";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "salaryCalculator" });
  return { title: t("pageTitle"), description: t("pageDescription") };
}

/** Salary Calculator (Portugal) — Phase 2 of a separate build spec
 *  (owner: Paulo Brás). Public, indexable, no login required (spec §10:
 *  "Free, ungated: the headline net number for any mode") — the lead-gen
 *  gate (PDF export, comparator, save-scenario) is Phase 5, not built
 *  yet, so everything on this page is ungated for now. Mode A only
 *  (contrato de trabalho); Modes B/C are Phases 3-4. */
export default async function SalaryCalculatorPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "salaryCalculator" });

  return (
    <>
      <h1 className="font-display text-2xl font-bold">{t("pageTitle")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t("pageIntro")}</p>
      <div className="mt-6">
        <SalaryCalculatorForm />
      </div>
    </>
  );
}
