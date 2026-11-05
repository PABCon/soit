import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeAlternates, socialMeta } from "@/lib/seo";
import { CvReviewUpload } from "@/components/candidate/CvReviewUpload";

type Props = { params: Promise<{ locale: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cvReview" });
  const title = t("pageTitle");
  const description = t("pageDescription");
  return {
    title,
    description,
    alternates: localeAlternates("/avaliar-cv", locale),
    ...socialMeta({ title, description, url: `${SITE}/${locale}/avaliar-cv` }),
  };
}

const TIP_ROWS = [
  ["structureTerm", "structureBody"],
  ["impactTerm", "impactBody"],
  ["completenessTerm", "completenessBody"],
] as const;

/**
 * CV Quality Score / Review (growth plan, Track C) — public, no-auth-
 * required upload → instant score → "create an account to see the full
 * breakdown" gate (§AI Pieces backlog). Same tool-first/content-below
 * layout as /salario-liquido: the real feature up top, SEO-valuable
 * "what makes a good CV" explainer content underneath — not a separate
 * landing page bolted onto the tool, the same page doing both jobs.
 */
export default async function CvReviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "cvReview" });

  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("heading")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink">{t("introP1")}</p>

      <div className="mt-8">
        <CvReviewUpload />
      </div>

      <h2 className="mt-10 font-display text-xl font-bold">{t("tipsHeading")}</h2>
      <dl className="mt-4 space-y-5">
        {TIP_ROWS.map(([term, body]) => (
          <div key={term}>
            <dt className="font-semibold text-ink">{t(term)}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">{t(body)}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
