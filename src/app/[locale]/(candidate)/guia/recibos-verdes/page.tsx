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
  const t = await getTranslations({ locale, namespace: "recibosVerdesGuide" });
  const title = t("pageTitle");
  const description = t("pageDescription");
  return {
    title,
    description,
    alternates: localeAlternates("/guia/recibos-verdes", locale),
    ...socialMeta({ title, description, url: `${SITE}/${locale}/guia/recibos-verdes` }),
  };
}

const TERM_ROWS = [
  ["ssTerm", "ssBody"],
  ["irsTerm", "irsBody"],
  ["vatTerm", "vatBody"],
] as const;

const FIRST_YEAR_ROWS = [
  ["firstYearSsTerm", "firstYearSsBody"],
  ["firstYearWithholdingTerm", "firstYearWithholdingBody"],
] as const;

const PITFALL_ROWS = [
  ["pitfall1Term", "pitfall1Body"],
  ["pitfall2Term", "pitfall2Body"],
  ["pitfall3Term", "pitfall3Body"],
  ["pitfall4Term", "pitfall4Body"],
] as const;

/** Recibos verdes guide (growth plan, Nov 2026) — a standalone, real-
 *  content page for the single biggest keyword cluster the user's own
 *  Keyword Planner research found after the calculator itself (~63k/mo
 *  estimated, PT). Deliberately the "what is this and how does it work"
 *  intent, not the "how do I issue one" navigational intent (that's
 *  Portal das Finanças' own territory — not winnable, not useful, per
 *  the research's own exclusions). Every figure here is the same already
 *  -verified rule data the calculator's engine uses
 *  (rules/2026/ss-independent.2026-01.json, cat-b.2026-01.json,
 *  vat.2026-01.json) — this is explaining what's already built and
 *  tested, not new domain research. Links into the calculator
 *  (?mode=freelance), and the calculator's own Mode B info panel links
 *  back here — a deliberate bidirectional pair, not a one-way funnel. */
export default async function RecibosVerdesGuidePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "recibosVerdesGuide" });

  const faqItems = [...TERM_ROWS, ...FIRST_YEAR_ROWS, ...PITFALL_ROWS].map(([question, answer]) => ({
    question: t(question),
    answer: t(answer),
  }));

  return (
    <article className="mx-auto max-w-2xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqPageJsonLd(faqItems)) }} />
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("heading")}</h1>

      <p className="mt-4 text-sm leading-relaxed text-ink">{t("introP1")}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink">{t("introP2")}</p>

      <h2 className="mt-8 font-display text-xl font-bold">{t("deductionsHeading")}</h2>
      <dl className="mt-4 space-y-5">
        {TERM_ROWS.map(([term, body]) => (
          <div key={term}>
            <dt className="font-semibold text-ink">{t(term)}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">{t(body)}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-8 font-display text-xl font-bold">{t("firstYearHeading")}</h2>
      <dl className="mt-4 space-y-5">
        {FIRST_YEAR_ROWS.map(([term, body]) => (
          <div key={term}>
            <dt className="font-semibold text-ink">{t(term)}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">{t(body)}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-8 font-display text-xl font-bold">{t("pitfallsHeading")}</h2>
      <dl className="mt-4 space-y-5">
        {PITFALL_ROWS.map(([term, body]) => (
          <div key={term}>
            <dt className="font-semibold text-ink">{t(term)}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">{t(body)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 rounded-2xl border border-line bg-paper p-6 text-center">
        <h2 className="font-display text-lg font-bold">{t("ctaHeading")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t("ctaBody")}</p>
        <Link href="/salario-liquido?mode=freelance" className={`mt-4 inline-block ${buttonClassName({ size: "md" })}`}>
          {t("ctaButton")}
        </Link>
      </div>
    </article>
  );
}
