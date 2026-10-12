import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Users, FileText, TrendingUp } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthSplitScreen } from "@/components/auth/AuthSplitScreen";
import { AuthHero } from "@/components/auth/AuthHero";
import { TopEmployerLogos } from "@/components/auth/TopEmployerLogos";
import { getTopEmployerCompanies } from "@/lib/db/companies";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("employerRegisterTitle"), robots: { index: false, follow: false } };
}

export default async function EmployerRegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });
  const h = await getTranslations({ locale, namespace: "auth.employerRegisterHero" });
  const topEmployers = await getTopEmployerCompanies();

  return (
    <AuthSplitScreen
      hero={
        <AuthHero
          eyebrow={h("eyebrow")}
          headlinePrefix={h("headlinePrefix")}
          headlineEmphasis={h("headlineEmphasis")}
          subtitle={h("subtitle")}
          bullets={[
            { Icon: Users, title: h("bullet1Title"), desc: h("bullet1Desc") },
            { Icon: FileText, title: h("bullet2Title"), desc: h("bullet2Desc") },
            { Icon: TrendingUp, title: h("bullet3Title"), desc: h("bullet3Desc") },
          ]}
        >
          <TopEmployerLogos
            companies={topEmployers}
            trustHeadline={h("trustHeadline")}
            viewAllCompanies={h("viewAllCompanies")}
          />
        </AuthHero>
      }
    >
      <h2 className="mb-6 text-2xl font-bold text-ink">{t("employerRegisterTitle")}</h2>
      <Suspense>
        <AuthForm role="employer" mode="register" />
      </Suspense>
      <p className="mt-6 text-sm text-muted">
        {t("alreadyHaveAccount")}{" "}
        <Link href="/employer/login" className="font-medium text-pine hover:underline">
          {t("logIn")}
        </Link>
      </p>
    </AuthSplitScreen>
  );
}
