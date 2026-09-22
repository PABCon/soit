import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthForm } from "@/components/auth/AuthForm";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("employerLoginTitle"), robots: { index: false, follow: false } };
}

export default async function EmployerLoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-ink">{t("employerLoginTitle")}</h1>
      <AuthForm role="employer" mode="login" />
      <p className="mt-6 text-sm text-muted">
        {t("needAccount")}{" "}
        <Link href="/employer/register" className="font-medium text-pine hover:underline">
          {t("createAccount")}
        </Link>
      </p>
    </>
  );
}
