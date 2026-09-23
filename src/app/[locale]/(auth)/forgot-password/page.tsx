import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("forgotPasswordTitle"), robots: { index: false, follow: false } };
}

/** Role-agnostic (§6.4) — password reset doesn't care whether the email
 *  belongs to a candidate or an employer, so both login forms share this
 *  one page. */
export default async function ForgotPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-ink">{t("forgotPasswordTitle")}</h1>
      <ForgotPasswordForm />
    </>
  );
}
