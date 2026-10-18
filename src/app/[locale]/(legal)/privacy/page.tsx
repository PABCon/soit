import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JobDescriptionBody } from "@/components/JobDescriptionBody";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("privacyTitle") };
}

const h2Class = "font-display mt-8 text-lg font-semibold text-ink";

const SECTIONS = [
  "controller",
  "data",
  "bases",
  "cookies",
  "sharing",
  "transfers",
  "retention",
  "rights",
  "security",
  "changes",
  "contact",
] as const;

/** Real policy content, grounded in a direct codebase audit of what this app
 *  actually collects/stores/sends to third parties — replaces the old
 *  "this page is being prepared" placeholder. Per explicit instruction
 *  (follow-up round), no "AI-drafted/pending review" banner is shown here —
 *  that caveat is communicated to the coordinator/user directly instead. */
export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");

  return (
    <>
      <h1 className="text-3xl font-bold lg:text-4xl">{t("privacyTitle")}</h1>
      <p className="mt-2 text-xs text-muted">{t("lastUpdated")}</p>
      <p className="mt-6 text-sm leading-relaxed text-muted">{t("privacy.intro")}</p>
      {SECTIONS.map((key) => (
        <section key={key}>
          <h2 className={h2Class}>{t(`privacy.${key}Heading`)}</h2>
          <div className="mt-2">
            <JobDescriptionBody description={t(`privacy.${key}Body`)} />
          </div>
        </section>
      ))}
    </>
  );
}
