import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Briefcase, Users, Building2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthSplitScreen } from "@/components/auth/AuthSplitScreen";
import { AuthHero } from "@/components/auth/AuthHero";

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
  const h = await getTranslations({ locale, namespace: "auth.employerLoginHero" });

  return (
    <AuthSplitScreen
      hero={
        <AuthHero
          eyebrow={h("eyebrow")}
          headlinePrefix={h("headlinePrefix")}
          headlineEmphasis={h("headlineEmphasis")}
          subtitle={h("subtitle")}
          bullets={[
            { Icon: Briefcase, title: h("bullet1Title"), desc: h("bullet1Desc") },
            { Icon: Users, title: h("bullet2Title"), desc: h("bullet2Desc") },
            { Icon: Building2, title: h("bullet3Title"), desc: h("bullet3Desc") },
          ]}
        />
      }
    >
      <h2 className="mb-6 text-2xl font-bold text-ink">{t("employerLoginTitle")}</h2>
      <Suspense>
        <AuthForm role="employer" mode="login" />
      </Suspense>
      <p className="mt-6 text-sm text-muted">
        {t("needAccount")}{" "}
        <Link href="/employer/register" className="font-medium text-pine hover:underline">
          {t("createAccount")}
        </Link>
      </p>
    </AuthSplitScreen>
  );
}
