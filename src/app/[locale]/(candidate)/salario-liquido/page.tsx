import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SalaryCalculatorForm } from "@/components/candidate/SalaryCalculatorForm";
import { localeAlternates, socialMeta } from "@/lib/seo";
import { decodeState } from "@/lib/salary-calculator/url-state";
import { calculateEmploymentNet } from "@/lib/salary-calculator/engine/mode-a";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ s?: string }>;
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const { s } = await searchParams;
  const t = await getTranslations({ locale, namespace: "salaryCalculator" });
  const title = t("pageTitle");

  // Growth plan (Nov 2026): a shared result link (built by the form's own
  // `handleShare()`) used to always preview with this page's generic,
  // mode-agnostic description — even though `?s=` already carries the
  // exact thing someone just calculated. Decoding it here (same state
  // this page already seeds the form from, client-side) lets the share
  // card say the real number. Employment-only for the description swap
  // (freelance/company "net" figures need their own framing — not worth
  // the extra complexity here); any mode still gets the real per-result
  // image via `/api/og/salary-result`, which handles all three.
  let description = t("pageDescription");
  if (s) {
    const state = decodeState(s);
    if (state?.mode === "employment") {
      try {
        const result = calculateEmploymentNet(state.profile, state.employmentInput);
        const amount = new Intl.NumberFormat(locale === "pt" ? "pt-PT" : "en-GB", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }).format(result.monthly.netIncludingMeal);
        description = t("shareDescriptionResult", { amount });
      } catch {
        // Malformed/out-of-range shared state — fall back to the generic description.
      }
    }
  }

  return {
    title,
    description,
    // SEO audit finding: this page (built explicitly as a lead-gen/SEO
    // surface — CLAUDE.md) had no canonical/hreflang at all, so it fell
    // back to the root layout's own `localeAlternates("/", locale)` and
    // risked being treated as a homepage duplicate instead of indexed on
    // its own.
    alternates: localeAlternates("/salario-liquido", locale),
    ...socialMeta({
      title,
      description,
      url: `${SITE}/${locale}/salario-liquido`,
      image: s ? `${SITE}/api/og/salary-result?s=${encodeURIComponent(s)}&locale=${locale}` : null,
      imageIsLandscape: true,
    }),
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
