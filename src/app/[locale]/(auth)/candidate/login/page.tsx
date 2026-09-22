import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthForm } from "@/components/auth/AuthForm";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("candidateLoginTitle"), robots: { index: false, follow: false } };
}

export default async function CandidateLoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-ink">{t("candidateLoginTitle")}</h1>
      <Suspense>
        <AuthForm role="candidate" mode="login" />
      </Suspense>
      <p className="mt-6 text-sm text-muted">
        {t("needAccount")}{" "}
        <Link href="/candidate/register" className="font-medium text-pine hover:underline">
          {t("createAccount")}
        </Link>
      </p>
    </>
  );
}
