import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonClassName } from "@/components/Button";
import { localeAlternates, socialMeta } from "@/lib/seo";
import { safeJsonLd, faqPageJsonLd } from "@/lib/json-ld";

type Props = { params: Promise<{ locale: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contratoTrabalhoGuide" });
  const title = t("pageTitle");
  const description = t("pageDescription");
  return {
    title,
    description,
    alternates: localeAlternates("/guia/contrato-trabalho", locale),
    ...socialMeta({ title, description, url: `${SITE}/${locale}/guia/contrato-trabalho` }),
  };
}

const SIMPLE_SECTIONS = [
  ["withholdingTerm", "withholdingBody"],
  ["ssTerm", "ssBody"],
] as const;

const STANDALONE_SECTIONS = [
  ["fourteenPaymentsHeading", "fourteenPaymentsBody"],
  ["mealAllowanceHeading", "mealAllowanceBody"],
  ["irsJovemHeading", "irsJovemBody"],
  ["contractTypesHeading", "contractTypesBody"],
  ["rightsHeading", "rightsBody"],
] as const;

/** Employment-contract guide (growth plan, Nov 2026) — companion to the
 *  recibos verdes guide, one per calculator mode. Deliberately written
 *  for both PT locals and people moving to Portugal for a job (the
 *  14-payments-a-year and meal-allowance sections exist specifically
 *  because those are genuinely unfamiliar to most people coming from
 *  abroad, not generic "how income tax works" filler). Every figure is
 *  the same already-verified rule data the calculator's engine uses
 *  (rules/2026/meta.json: SS 11%/23.75%, meal allowance €6.15 cash/€10.46
 *  card, IRS Jovem's real graduated exemption schedule). Bidirectional
 *  link with the calculator via the same `?mode=` deep link the recibos
 *  verdes guide introduced. */
export default async function ContratoTrabalhoGuidePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "contratoTrabalhoGuide" });

  const faqItems = [...SIMPLE_SECTIONS, ...STANDALONE_SECTIONS].map(([question, answer]) => ({
    question: t(question),
    answer: t(answer),
  }));

  return (
    <article className="mx-auto max-w-2xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqPageJsonLd(faqItems)) }} />
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("heading")}</h1>

      <p className="mt-4 text-sm leading-relaxed text-ink">{t("introP1")}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink">{t("introP2")}</p>

      <h2 className="mt-8 font-display text-xl font-bold">{t("payslipHeading")}</h2>
      <dl className="mt-4 space-y-5">
        {SIMPLE_SECTIONS.map(([term, body]) => (
          <div key={term}>
            <dt className="font-semibold text-ink">{t(term)}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">{t(body)}</dd>
          </div>
        ))}
      </dl>

      {STANDALONE_SECTIONS.map(([heading, body]) => (
        <div key={heading}>
          <h2 className="mt-8 font-display text-xl font-bold">{t(heading)}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{t(body)}</p>
        </div>
      ))}

      <div className="mt-10 rounded-2xl border border-line bg-paper p-6 text-center">
        <h2 className="font-display text-lg font-bold">{t("ctaHeading")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t("ctaBody")}</p>
        <Link href="/salario-liquido?mode=employment" className={`mt-4 inline-block ${buttonClassName({ size: "md" })}`}>
          {t("ctaButton")}
        </Link>
      </div>
    </article>
  );
}
