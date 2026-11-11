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
  const t = await getTranslations({ locale, namespace: "empresaPropriaGuide" });
  const title = t("pageTitle");
  const description = t("pageDescription");
  return {
    title,
    description,
    alternates: localeAlternates("/guia/empresa-propria", locale),
    ...socialMeta({ title, description, url: `${SITE}/${locale}/guia/empresa-propria` }),
  };
}

const CORPORATE_TAX_SECTIONS = [
  ["ircTerm", "ircBody"],
  ["accountantTerm", "accountantBody"],
] as const;

const STANDALONE_SECTIONS = [
  ["gerenteHeading", "gerenteBody"],
] as const;

const OWNER_TRADEOFF_SECTIONS = [
  ["salaryVsDividendsTerm", "salaryVsDividendsBody"],
  ["legalReserveTerm", "legalReserveBody"],
] as const;

/** Company (Lda/B2B) guide (growth plan, Nov 2026) — third of three
 *  calculator-mode companion guides. Deliberately honest about who this
 *  is actually for (`fitHeading`/`fitBody`) rather than oversell it —
 *  it's a smaller, more advanced audience than the other two modes, and
 *  the guide says so directly instead of pretending every freelancer
 *  should incorporate. Every figure is the same already-verified rule
 *  data the calculator's engine uses (IRC 15%/19%, the 12×IAS gerente SS
 *  floor, the 28% flat dividend tax, the 5%/20% legal reserve). */
export default async function EmpresaPropriaGuidePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "empresaPropriaGuide" });

  const faqItems = [...CORPORATE_TAX_SECTIONS, ...STANDALONE_SECTIONS, ...OWNER_TRADEOFF_SECTIONS, ["fitHeading", "fitBody"] as const].map(
    ([question, answer]) => ({ question: t(question), answer: t(answer) }),
  );

  return (
    <article className="mx-auto max-w-2xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqPageJsonLd(faqItems)) }} />
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("heading")}</h1>

      <p className="mt-4 text-sm leading-relaxed text-ink">{t("introP1")}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink">{t("introP2")}</p>

      <h2 className="mt-8 font-display text-xl font-bold">{t("corporateTaxHeading")}</h2>
      <dl className="mt-4 space-y-5">
        {CORPORATE_TAX_SECTIONS.map(([term, body]) => (
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

      <dl className="mt-8 space-y-5">
        {OWNER_TRADEOFF_SECTIONS.map(([term, body]) => (
          <div key={term}>
            <dt className="font-semibold text-ink">{t(term)}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">{t(body)}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-8 font-display text-xl font-bold">{t("fitHeading")}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{t("fitBody")}</p>

      <div className="mt-10 rounded-2xl border border-line bg-paper p-6 text-center">
        <h2 className="font-display text-lg font-bold">{t("ctaHeading")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t("ctaBody")}</p>
        <Link href="/salario-liquido?mode=company" className={`mt-4 inline-block ${buttonClassName({ size: "md" })}`}>
          {t("ctaButton")}
        </Link>
        <p className="mx-auto mt-4 max-w-md text-xs text-muted">
          {t("terminationCta")}{" "}
          <Link href="/rescisao-contrato" className="font-medium text-pine hover:underline">
            {t("terminationCtaButton")}
          </Link>
        </p>
      </div>
    </article>
  );
}
