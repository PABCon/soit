import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SalaryCalculatorForm } from "@/components/candidate/SalaryCalculatorForm";
import { localeAlternates, socialMeta } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "salaryCalculator" });
  const title = t("pageTitle");
  const description = t("pageDescription");
  return {
    title,
    description,
    // SEO audit finding: this page (built explicitly as a lead-gen/SEO
    // surface — CLAUDE.md) had no canonical/hreflang at all, so it fell
    // back to the root layout's own `localeAlternates("/", locale)` and
    // risked being treated as a homepage duplicate instead of indexed on
    // its own.
    alternates: localeAlternates("/salario-liquido", locale),
    ...socialMeta({ title, description, url: `${SITE}/${locale}/salario-liquido` }),
  };
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
