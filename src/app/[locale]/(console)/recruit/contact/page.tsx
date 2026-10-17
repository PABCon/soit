import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactForm } from "@/components/ContactForm";
import { ContactHelpTopics } from "@/components/ContactHelpTopics";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  // Same as every other page under (console): behind login, never indexed.
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");

  return (
    <>
      <h1 className="text-3xl font-bold lg:text-4xl">{t("title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("intro")}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <ContactForm />
        <ContactHelpTopics locale={locale} />
      </div>
    </>
  );
}
