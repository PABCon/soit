import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JobDescriptionBody } from "@/components/JobDescriptionBody";
import { localeAlternates, socialMeta } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// SEO audit finding: predates the localeAlternates/socialMeta helpers —
// title-only, same gap already fixed on every other public page this pass.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  const title = t("termsTitle");
  const description = t("terms.intro");
  return {
    title,
    description,
    alternates: localeAlternates("/terms", locale),
    ...socialMeta({ title, description, url: `${SITE}/${locale}/terms` }),
  };
}

const h2Class = "font-display mt-8 text-lg font-semibold text-ink";

const SECTIONS = [
  "platform",
  "accounts",
  "rules",
  "obligations",
  "content",
  "payments",
  "ip",
  "termination",
  "disclaimer",
  "law",
  "changes",
  "contact",
] as const;

/** Real terms content, grounded in what this platform's two core rules (§1)
 *  and actually-built mechanisms (billing via Stripe, NIF verification, the
 *  candidate anonymize-on-delete flow) really are — replaces the old
 *  "this page is being prepared" placeholder. Per explicit instruction
 *  (follow-up round), no "AI-drafted/pending review" banner is shown here —
 *  that caveat is communicated to the coordinator/user directly instead. */
export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");

  return (
    <>
      <h1 className="text-3xl font-bold lg:text-4xl">{t("termsTitle")}</h1>
      <p className="mt-2 text-xs text-muted">{t("termsLastUpdated")}</p>
      <p className="mt-6 text-sm leading-relaxed text-muted">{t("terms.intro")}</p>
      {SECTIONS.map((key) => (
        <section key={key}>
          <h2 className={h2Class}>{t(`terms.${key}Heading`)}</h2>
          <div className="mt-2">
            <JobDescriptionBody description={t(`terms.${key}Body`)} />
          </div>
        </section>
      ))}
    </>
  );
}
