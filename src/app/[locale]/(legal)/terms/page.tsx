import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JobDescriptionBody } from "@/components/JobDescriptionBody";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("termsTitle") };
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
      <p className="mt-2 text-xs text-muted">{t("lastUpdated")}</p>
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
